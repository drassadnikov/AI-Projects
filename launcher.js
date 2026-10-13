#!/usr/bin/env node
/**
 * launcher.js — точка входа для gpu-monitor.exe (сборка Node SEA).
 *
 * Делает две вещи:
 *   1. Поднимает сам дашборд (gpu-monitor.js из каталога, где лежит exe).
 *   2. После того как веб-сервер стал отвечать, открывает его в браузере
 *      (http://<host>:<port> — по умолчанию http://192.168.1.117:8787).
 *
 * Флаг --console открывает браузер не нужно — режим вывода в терминал.
 */
'use strict';

const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const EXE_DIR = path.dirname(process.execPath);
const APP = path.join(EXE_DIR, 'gpu-monitor.js');

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const host = argValue('--host') || '192.168.1.117';
const port = Number(argValue('--port') || 8787);
const consoleMode = process.argv.includes('--console');
const url = 'http://' + host + ':' + port + '/';

if (!fs.existsSync(APP)) {
  console.error('gpu-monitor.js не найден рядом с exe: ' + APP);
  process.exit(1);
}

// В SEA процесс.argv может не содержать «скриптовую» запись (argv[1]).
// gpu-monitor.js парсит аргументы начиная с argv[2], поэтому нормализуем:
// [exe, 'gpu-monitor.js', ...пользовательские аргументы].
(function normalizeArgv() {
  const raw = process.argv.slice(1);
  // Если argv[1] уже путь к скрипту — пользовательские аргументы идут с raw[1];
  // если argv[1] — первый флаг — все raw это аргументы.
  const userArgs = raw.length > 0 && !String(raw[0]).startsWith('-') ? raw.slice(1) : raw;
  process.argv = [process.argv[0], APP, ...userArgs];
})();

function waitForServer(serverUrl, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const req = http.get(serverUrl, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start >= timeoutMs) resolve(false);
        else setTimeout(tick, 300);
      });
    };
    tick();
  });
}

// Поднимать браузер только когда сервер реально стал отвечать.
if (!consoleMode) {
  waitForServer(url, 15000).then((ok) => {
    if (ok) {
      const browser = spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true });
      browser.unref();
      console.log('Открыто в браузере: ' + url);
    } else {
      console.log('Сервер не ответил за 15 с — браузер не открыт. Откройте вручную: ' + url);
    }
  });
}

// В SEA require() главного модуля умеет только built-in-модули;
// приложение грузим с диска через createRequire().
require('node:module').createRequire(APP)(APP);
