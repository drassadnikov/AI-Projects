#!/usr/bin/env node
/**
 * build-exe.js — собирает gpu-monitor.exe (Node Single Executable Application).
 *
 * Шаги:
 *   1. Генерирует SEA-бандл из launcher.js (sea-config.json → sea.bin).
 *   2. Копирует node.exe в gpu-monitor.exe.
 *   3. Вшивает бандл через postject (API):
 *      - имя ресурса: NODE_SEA_BLOB (именно его ищет Node через FindResourceA),
 *      - sentinelFuse: NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 —
 *        это fuse, с которым собран сам node.exe (src/node_sea_bin.cc).
 *        postject при инъекции переключает байт сентинела ":0" → ":1",
 *        и только тогда postject_has_resource() внутри Node возвращает true.
 *
 * Запуск: node build-exe.js  (или npm run build:exe)
 */
'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const exe = path.join(dir, 'gpu-monitor.exe');
const cfg = path.join(dir, 'sea-config.json');
const blobFile = path.join(dir, 'sea.bin');

const SENTINEL_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const RESOURCE_NAME = 'NODE_SEA_BLOB';

function sh(cmd) {
  console.log('$ ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}

// 1) SEA-бандл.
sh(`node --experimental-sea-config ${JSON.stringify(cfg)}`);

// 2) Чистая копия node.exe.
fs.copyFileSync(process.execPath, exe);

// 3) Инъекция SEA-бандла + контроль результата.
(async () => {
  const { inject } = require('postject');
  const blob = fs.readFileSync(blobFile);
  await inject(exe, RESOURCE_NAME, blob, { sentinelFuse: SENTINEL_FUSE });

  const buf = fs.readFileSync(exe);
  const magic = Buffer.from('NODE_SEA_BLOB');
  if (!buf.includes(magic)) {
    throw new Error('Магия ' + magic + ' не найдена в exe — инъекция не сработала');
  }
  const fuseIdx = buf.indexOf(Buffer.from(SENTINEL_FUSE));
  if (fuseIdx === -1 || buf[fuseIdx + SENTINEL_FUSE.length + 1] !== '1'.charCodeAt(0)) {
    throw new Error('Сентинел ' + SENTINEL_FUSE + ' не переключён на :1');
  }

  // 4) PE subsystem: CUI (3) → GUI (2) — exe стартует без консольного окна
  //    (приложение живёт в системном трее; см. TRAY_PS в gpu-monitor.js).
  const peOff = buf.readUInt32LE(0x3c);
  if (buf.toString('latin1', peOff, peOff + 4) !== 'PE\0\0') throw new Error('PE-сигнатура не найдена');
  const optOff = peOff + 4 + 20; // COFF-заголовок
  const subOff = optOff + 0x44; // Subsystem в optional header (PE32 и PE32+)
  const oldSub = buf.readUInt16LE(subOff);
  if (oldSub !== 2) {
    buf.writeUInt16LE(2, subOff); // IMAGE_SUBSYSTEM_WINDOWS_GUI
    fs.writeFileSync(exe, buf);
    console.log('PE subsystem: ' + oldSub + ' (консоль) -> 2 (GUI) — без окна при запуске');
  }
  console.log('Готово: ' + exe);
  console.log('Размер: ' + (buf.length / 1024 / 1024).toFixed(1) + ' МБ (node.exe + SEA-бандл)');
  console.log('Запуск: gpu-monitor.exe — браузер откроется сам после старта сервера.');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
