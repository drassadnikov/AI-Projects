#!/usr/bin/env node
/**
 * gpu-monitor.js — онлайн-мониторинг NVIDIA GPU (RTX 3090 Ti) + управление LLM-моделью.
 *
 * Верхняя часть: графики (загрузка, температура, мощность (W), частота (MHz)) и карточки метрик:
 * VRAM, вентилятор, лимит мощности и процессы на GPU (pmon: sm%/mem% на процесс).
 * Нижняя часть: живой лог LLM-модели (запуск/остановка батника прямо из браузера) и
 * встроенный интерактивный PowerShell (xterm.js + node-pty/ConPTY), который сам запускает
 * команду pi из A:\PROJECTS.
 *
 * Зависимости: Node.js 18+, nvidia-smi (идёт с драйвером NVIDIA) и node-pty
 * (встроенный терминал; для --console достаточно Node + nvidia-smi).
 *
 * Запуск:
 *   node gpu-monitor.js                     # веб-дашборд http://192.168.1.117:8787
 *   node gpu-monitor.js --console           # вывод GPU-метрик в терминал
 *   node gpu-monitor.js --bat "A:\LLM\_Run_Qwen3.8-27B-GSQ-RCO-IQ3_S.bat"
 *   node gpu-monitor.js --port 9000 --interval 500
 */

'use strict';

// GUI-сборка (exe без консоли): у stdout/stderr может не быть реальной консоли —
// не даём ошибкам стрима ронять процесс.
try { process.stdout.on('error', () => {}); } catch {}
try { process.stderr.on('error', () => {}); } catch {}

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
// node-pty — ConPTY-консоль для встроенного PowerShell. Не требуется для --console.
let pty = null;
try {
  pty = require('node-pty');
} catch {
  console.warn('node-pty не найден: встроенный терминал недоступен (npm install node-pty).');
}
const DEFAULT_TERM_CWD = 'A:\\PROJECTS';

const FIELDS = [
  'name',
  'utilization.gpu',
  'temperature.gpu',
  'power.draw',
  'clocks.sm',
  'fan.speed',
  'power.limit',
  'memory.used',
  'memory.total',
];

const HISTORY_SIZE = 300; // ~5 минут истории при опросе раз в секунду
const DEFAULT_BAT = 'A:\\LLM\\_Run_Qwen3.8-27B-GSQ-RCO-IQ3_S.bat';
const STATE_FILE = path.join(__dirname, 'state.json');

function parseArgs(argv) {
  const opts = { port: 8787, host: '192.168.1.117', gpu: null, console: false, noTray: false, intervalMs: 1000, bat: DEFAULT_BAT, batsDir: null, termCwd: DEFAULT_TERM_CWD };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') opts.port = Number(argv[++i]);
    else if (a === '--host') opts.host = argv[++i];
    else if (a === '--gpu') opts.gpu = Number(argv[++i]);
    else if (a === '--interval') opts.intervalMs = Number(argv[++i]);
    else if (a === '--bat') opts.bat = argv[++i];
    else if (a === '--bats-dir') opts.batsDir = argv[++i];
    else if (a === '--term-cwd') opts.termCwd = argv[++i];
    else if (a === '--console') opts.console = true;
    else if (a === '--no-tray') opts.noTray = true;
    else if (a === '-h' || a === '--help') {
      console.log('node gpu-monitor.js [--host 192.168.1.117] [--port 8787] [--gpu <idx>] [--console] [--interval 1000] [--bat <path>] [--bats-dir <dir>];');
      console.log('  --bat — батник LLM-модели (по умолчанию ' + DEFAULT_BAT + ')');
      console.log('  --bats-dir — каталог .bat-файлов для выбора (по умолчанию — каталог --bat)');
      process.exit(0);
    }
  }
  return opts;
}

function findNvidiaSmi() {
  const candidates = [
    'nvidia-smi',
    'C:\\Windows\\System32\\nvidia-smi.exe',
    (process.env['ProgramFiles'] || 'C:\\Program Files') + '\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe',
    (process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)') + '\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe',
  ];
  for (const c of candidates) {
    if (c === 'nvidia-smi') return c; // доверимся PATH
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/** Один опрос nvidia-smi: возвращает массив всех GPU. */
function sampleGpus(smiPath) {
  const args = ['--query-gpu=' + FIELDS.join(','), '--format=csv,noheader,nounits'];
  const res = spawnSync(smiPath, args, { encoding: 'utf8', timeout: 8000, windowsHide: true });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || '').trim() || 'nvidia-smi exited with code ' + res.status);
  }
  return res.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((s) => s.trim());
      const g = {};
      for (let i = 0; i < FIELDS.length; i++) {
        if (FIELDS[i] === 'name') {
          g.name = parts[i];
          continue;
        }
        const n = Number(parts[i]);
        g[FIELDS[i]] = Number.isFinite(n) ? n : null; // "[N/A]" -> null
      }
      return g;
    });
}

/**
 * Процессы на выбранном GPU через pmon (sm% / mem% — доля видеопамяти на процесс).
 * Вывод:  gpu  pid  type  sm  mem  enc  dec  jpg  ofa  command
 */
function pmonProcesses(smiPath, gpuIdx) {
  const res = spawnSync(smiPath, ['pmon', '-c', '1', '-s', 'u'], {
    encoding: 'utf8',
    timeout: 8000,
    windowsHide: true,
  });
  if (res.error || res.status !== 0) return [];
  const out = [];
  for (const raw of res.stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 10) continue;
    if (Number(parts[0]) !== gpuIdx) continue;
    const sm = parts[3] === '-' ? null : Number(parts[3]);
    const mem = parts[4] === '-' ? null : Number(parts[4]);
    out.push({
      pid: Number(parts[1]),
      sm,
      mem,
      command: parts.slice(9).join(' '),
    });
  }
  return out;
}



/** Авто-выбор 3090 Ti по имени, иначе первый GPU. */
function pickGpuIndex(gpus, wanted) {
  if (wanted != null && Number.isInteger(wanted) && wanted >= 0 && wanted < gpus.length) return wanted;
  const auto = gpus.findIndex((g) => /3090\s*ti/i.test(g.name || ''));
  return auto !== -1 ? auto : 0;
}

class Sampler {
  constructor({ smiPath, intervalMs, gpuIndex, onSample, augment }) {
    this.smiPath = smiPath;
    this.gpuIndex = gpuIndex;
    this.onSample = onSample || null;
    this.augment = augment || null;
    this.gpus = [];
    this.gpuIdx = 0;
    this.latest = null;
    this.error = null;
    this.history = [];
    this._timer = setInterval(() => this.tick(), intervalMs);
    this.tick();
  }

  stop() {
    clearInterval(this._timer);
  }

  tick() {
    let gpus;
    try {
      gpus = sampleGpus(this.smiPath);
    } catch (e) {
      this.error = e.message || String(e);
      return;
    }
    this.gpus = gpus;
    const idx = pickGpuIndex(gpus, this.gpuIndex);
    this.gpuIdx = idx;
    const g = gpus[idx];
    let processes = [];
    try {
      processes = pmonProcesses(this.smiPath, idx);
    } catch {
      processes = [];
    }
    this.latest = {
      t: Date.now(),
      name: g.name,
      util: g['utilization.gpu'],
      temp: g['temperature.gpu'],
      power: g['power.draw'],
      clock: g['clocks.sm'],
      fan: g['fan.speed'],
      powerLimit: g['power.limit'],
      memUsed: g['memory.used'],
      memTotal: g['memory.total'],
      processes,
    };
    this.error = null;
    if (this.augment) this.augment(this.latest);
    this.history.push(this.latest);
    if (this.history.length > HISTORY_SIZE) this.history.shift();
    if (this.onSample) this.onSample(this.latest, this);
  }
}

const LHM_DLL = 'C:\\Program Files\\LibreHardwareMonitor\\LibreHardwareMonitorLib.dll';

/**
 * Скрипт скрытого процесса с датчиками GPU (LibreHardwareMonitor).
 * Запрос — из help.txt: температурные сенсоры «GPU Core», «GPU Hot Spot»,
 * «GPU Memory Junction». Каждый тик печатает в stdout по JSON-строке на GPU:
 * {"name":"NVIDIA GeForce RTX 3090 Ti","core":37.0,"hotspot":45.1,"memory":38.0}
 */
const HOTSPOT_PS = `param([string]$DllPath, [int]$IntervalMs)
$ErrorActionPreference = 'Stop'
Add-Type -Path $DllPath
$computer = New-Object LibreHardwareMonitor.Hardware.Computer
$computer.IsGpuEnabled = $true
$computer.Open()
try {
    while ($true) {
        foreach ($hardware in $computer.Hardware) {
            if ($hardware.HardwareType -match "Gpu") {
                $hardware.Update()
                $sensors = $hardware.Sensors
                $core = $sensors | Where-Object {
                    $_.SensorType -eq "Temperature" -and $_.Name -eq "GPU Core"
                } | Select-Object -First 1
                $hotspot = $sensors | Where-Object {
                    $_.SensorType -eq "Temperature" -and $_.Name -eq "GPU Hot Spot"
                } | Select-Object -First 1
                $memory = $sensors | Where-Object {
                    $_.SensorType -eq "Temperature" -and $_.Name -eq "GPU Memory Junction"
                } | Select-Object -First 1
                $coreV = $null
                if ($core) { $coreV = [math]::Round($core.Value, 1) }
                $hotspotV = $null
                if ($hotspot) { $hotspotV = [math]::Round($hotspot.Value, 1) }
                $memV = $null
                if ($memory) { $memV = [math]::Round($memory.Value, 1) }
                [Console]::WriteLine(([pscustomobject]@{
                    name = $hardware.Name
                    core = $coreV
                    hotspot = $hotspotV
                    memory = $memV
                } | ConvertTo-Json -Compress))
            }
        }
        Start-Sleep -Milliseconds $IntervalMs
    }
} finally {
    $computer.Close()
}
`;

/**
 * Опрос датчиков GPU (LibreHardwareMonitor) скрытым PowerShell-процессом.
 * nvidia-smi не отдаёт температуру «горячей точки» — это отдельный источник.
 */
class HotspotPoller {
  constructor({ intervalMs = 2000 } = {}) {
    this.intervalMs = intervalMs;
    this.proc = null;
    this.byName = new Map();
    this.error = null;
  }

  start() {
    if (this.proc) return;
    if (!fs.existsSync(LHM_DLL)) {
      this.error = 'LibreHardwareMonitor не найден: ' + LHM_DLL;
      console.warn('Hotspot: ' + this.error);
      return;
    }
    try {
      const tmp = path.join(os.tmpdir(), 'gpu-monitor-hotspot.ps1');
      fs.writeFileSync(tmp, '\uFEFF' + HOTSPOT_PS, 'utf8');
      const psPath = path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      this.proc = spawn(psPath, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', tmp, LHM_DLL, String(this.intervalMs)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let buf = '';
      this.proc.stdout.on('data', (d) => {
        buf += d.toString('utf8');
        let i;
        while ((i = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          try {
            const j = JSON.parse(line);
            if (j && j.name) this.byName.set(j.name, j);
          } catch {}
        }
      });
      this.proc.stderr.on('data', (d) => {
        const msg = d.toString('utf8').trim().split(/\r?\n/)[0];
        if (msg && !this.error) {
          this.error = msg;
          console.warn('Hotspot: ' + msg);
        }
      });
      this.proc.on('close', (code) => {
        this.proc = null;
        if (code !== 0) console.warn('Hotspot: процесс датчиков завершился (код ' + code + ')');
      });
      this.proc.on('error', (e) => {
        this.proc = null;
        if (!this.error) this.error = e.message;
      });
      console.log('Hotspot: опрос запущен (LibreHardwareMonitor, ' + this.intervalMs + ' мс)');
    } catch (e) {
      this.proc = null;
      this.error = e.message || String(e);
      console.warn('Hotspot: не удалось запустить: ' + this.error);
    }
  }

  /** Значение «горячей точки» для GPU с именем gpuName (авто-выбор как в мониторе). */
  valueFor(gpuName) {
    let hit = this.byName.get(gpuName);
    if (!hit) {
      for (const [name, v] of this.byName) {
        if (/3090\s*ti/i.test(name)) { hit = v; break; }
      }
    }
    if (!hit && this.byName.size) hit = this.byName.values().next().value;
    return hit && hit.hotspot != null ? Number(hit.hotspot) : null;
  }

  stop() {
    if (this.proc) {
      try { this.proc.kill(); } catch {}
      this.proc = null;
    }
  }
}


/**
 * Управление LLM-моделью: запуск/остановка батника + живой буфер лога.
 */
class LlmManager {
  constructor(batPath, opts) {
    opts = opts || {};
    this.batPath = batPath;
    this.maxLines = opts.maxLines || 5000;
    this.onPersist = opts.onPersist || null;
    this.proc = null;
    this._stopRequested = false;
    this.running = false;
    this.startedAt = null;
    this.exitCode = null;
    this.nextId = 1;
    this.lines = [];
    this._partial = { out: '', err: '' };
    this.genPoints = []; // точки {n, t} по строкам «n_gen = N» для средней скорости
    this.ctxTokens = null; // текущее использование контекста (n_tokens из «release»-строк)
    this.ctxLimit = null;  // лимит контекста (n_ctx_slot)
  }

  /** Сменить батник (с проверкой файла). Применяется с следующего запуска. */
  setBat(p) {
    if (typeof p !== 'string' || !p.trim()) throw new Error('пустой путь к батнику');
    if (!/\.(bat|cmd)$/i.test(p)) throw new Error('нужен файл .bat или .cmd: ' + p);
    if (!fs.existsSync(p)) throw new Error('файл не найден: ' + p);
    this.batPath = p;
    if (this.onPersist) this.onPersist(p);
  }

  state() {
    return {
      running: this.running,
      pid: this.proc ? this.proc.pid : null,
      startedAt: this.startedAt,
      exitCode: this.exitCode,
      stoppedByUser: !this.running && this._stopRequested,
      // Средняя скорость генерации по строкам лога «n_gen = N»:
      // (N_конец − N_начало) / Δt в окне последних ~60 с.
      tokensPerSec: this._genTps(),
      ctxTokens: this.ctxTokens,
      ctxLimit: this.ctxLimit,
      bat: this.batPath,
      batExists: fs.existsSync(this.batPath),
      logCount: this.lines.length,
    };
  }

  pushLine(stream, text) {
    this.lines.push({ id: this.nextId++, ts: Date.now(), stream, text });
    this._parseCtx(text);
    this._parseGen(text);
    if (this.lines.length > this.maxLines) {
      this.lines.splice(0, this.lines.length - this.maxLines);
    }
  }

  /** Строка llama-server: «n_gen = N, tg = X t/s, tg_3s = Y t/s» —
   *  N — накопленное число сгенерированных токенов (выводится раз в ~3 с).
   *  Собираем точки {n, t} для средней скорости по строкам лога (окно ~60 с). */
  _parseGen(text) {
    const m = /n_gen\s*=\s*(\d+),\s*tg\s*=\s*[\d.]+\s*t\/s/.exec(text);
    if (!m) return;
    const n = Number(m[1]);
    const now = Date.now();
    const last = this.genPoints[this.genPoints.length - 1];
    if (last && n < last.n) this.genPoints.length = 0; // новый запрос — счётчик обнулился
    this.genPoints.push({ n, t: now });
    while (this.genPoints.length > 1 && now - this.genPoints[0].t > 60000) this.genPoints.shift();
  }

  /** Средняя скорость генерации (токенов/с) по окну последних строк «n_gen». */
  _genTps() {
    const p = this.genPoints;
    if (p.length < 2) return null;
    const first = p[0];
    const last = p[p.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt < 1) return null; // окно меньше секунды — среднее пока недостоверно
    return (last.n - first.n) / dt;
  }


  /** Контекст: «n_ctx_slot = N» (лимит) и «release: … stop processing: n_tokens = N» (текущее). */
  _parseCtx(text) {
    let m = /n_ctx_slot\s*=\s*(\d+)/.exec(text);
    if (m) this.ctxLimit = Number(m[1]);
    m = /n_tokens\s*=\s*(\d+),\s*truncated/.exec(text);
    if (m) this.ctxTokens = Number(m[1]);
  }

  /** Строки с id > n. oldestId нужен клиенту, чтобы понять, что старые строки потеряны. */
  logAfter(n) {
    return {
      lines: this.lines.filter((l) => l.id > n),
      latestId: this.nextId - 1,
      oldestId: this.lines.length ? this.lines[0].id : this.nextId,
    };
  }

  onData(stream, chunk) {
    let s = this._partial[stream] + chunk.toString('utf8');
    const parts = s.split(/\r?\n/);
    this._partial[stream] = parts.pop();
    for (const p of parts) this.pushLine(stream, p);
  }

  start() {
    if (this.running) throw new Error('модель уже запущена');
    if (!fs.existsSync(this.batPath)) throw new Error('батник не найден: ' + this.batPath);
    // Windows-системные пути впереди: чтобы cmd.exe нашёл свои утилиты (timeout, taskkill,
    const env = { ...process.env };
    env.PATH = ['C:\\Windows\\System32', 'C:\\Windows'].join(';') + ';' + (env.PATH || '');
    const cmd = spawn('cmd.exe', ['/d', '/s', '/c', this.batPath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });
    this.proc = cmd;
    this.running = true;
    this.startedAt = Date.now();
    this.exitCode = null;
    this._stopRequested = false;
    this._partial = { out: '', err: '' };
    this.genPoints = [];
    this.ctxTokens = null;
    this.ctxLimit = null;
    if (this.onPersist) this.onPersist(this.batPath);
    this.pushLine('sys', 'Запуск: ' + this.batPath + ' (pid ' + cmd.pid + ')');
    cmd.stdout.on('data', (d) => this.onData('out', d));
    cmd.stderr.on('data', (d) => this.onData('err', d));
    cmd.on('error', (e) => {
      this.running = false;
      this.pushLine('err', 'Ошибка запуска: ' + e.message);
    });
    cmd.on('close', (code, signal) => {
      this.running = false;
      this.exitCode = this._stopRequested ? -1 : (code != null ? code : -1);
      this.pushLine('sys', this._stopRequested
        ? 'Процесс остановлен по запросу'
        : 'Процесс завершился (код ' + this.exitCode + (signal ? ', signal ' + signal : '') + ')');
    });
    return cmd.pid;
  }

  stop() {
    if (!this.running || !this.proc) return { ok: false, error: 'модель не запущена' };
    const pid = this.proc.pid;
    this._stopRequested = true;
    this.pushLine('sys', 'Остановка: taskkill /f /t /pid ' + pid);
    try {
      const res = spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], {
        windowsHide: true,
        timeout: 8000,
      });
      if (res.status !== 0 && !res.error) {
        this.pushLine('err', 'taskkill: ' + (res.stderr || res.stdout || '').trim());
      }
    } catch (e) {
      this.pushLine('err', 'taskkill не выполнен: ' + (e.message || e));
    }
    return { ok: true, pid };
  }
}

/**
 * Встроенный интерактивный PowerShell: реальная консоль (ConPTY через node-pty),
 * которая сама запускает команду pi из A:\PROJECTS (powershell -NoExit -Command pi).
 *
 * Транспортировка без WebSocket: вывод — SSE-поток GET /api/term/out (base64-чанки),
 * ввод — POST /api/term/in, размер — POST /api/term/resize. Для новых клиентов
 * досылаются последние historyMax байт истории, чтобы переоткрытая вкладка видела вывод.
 */
// Автозапуск pi: проверяем команду и при отсутствии показываем понятную подсказку
// вместо молчаливого промпта (PATH pty уже дополнен npm-каталогом в start()).
const PI_AUTO_CMD =
  "if (Get-Command pi -ErrorAction SilentlyContinue) { pi --tui-mode fullscreen } else { Write-Host '[gpu-monitor] pi не найден в PATH. Установить: npm install -g @earendil-works/pi-coding-agent' -ForegroundColor Yellow }";
class PtyTerm {
  constructor(cwd, opts) {
    opts = opts || {};
    this.cwd = cwd;
    this.shell = 'powershell.exe';
    this.autoCommand = opts.autoCommand || 'pi';
    this.historyMax = opts.historyMax || 512 * 1024;
    this.proc = null;
    this.running = false;
    this.startedAt = null;
    this.exitCode = null;
    this._stopRequested = false;
    this._subs = new Set(); // ответы SSE
    this._history = []; // base64-чанки
    this._historySize = 0;
  }

  state() {
    return {
      running: this.running,
      pid: this.proc ? this.proc.pid : null,
      shell: this.shell,
      autoCommand: this.autoCommand,
      cwd: this.cwd,
      startedAt: this.startedAt,
      exitCode: this.exitCode,
      stoppedByUser: !this.running && this._stopRequested,
      historyBytes: this._historySize,
    };
  }

  _emit(data, event) {
    // Без имени события — это обычный "message" (его ловит EventSource.onmessage).
    // Именное 'event: data' браузер доставлял бы только addEventListener('data') —
    // живые кадры молча терялись, replay (прямые 'data:'-фреймы) работал.
    let frame = '';
    if (event) frame += 'event: ' + event + '\n';
    frame += 'data: ' + data + '\n\n';
    for (const res of this._subs) {
      try {
        res.write(frame);
      } catch {
        this._subs.delete(res);
      }
    }
  }

  _onData(d) {
    const buf = Buffer.from(d);
    const b64 = buf.toString('base64');
    this._history.push(b64);
    this._historySize += buf.length;
    while (this._historySize > this.historyMax && this._history.length) {
      this._historySize -= Buffer.byteLength(Buffer.from(this._history.shift(), 'base64'));
    }
    this._emit(b64);
  }

  start(cols, rows) {
    if (!pty) throw new Error('node-pty не установлен: npm install node-pty');
    if (this.running) throw new Error('терминал уже запущен');
    // Windows-системные пути впереди: чтобы PowerShell нашёл свои утилиты.
    const env = { ...process.env };
    // Системные Windows-пути + npm-каталог (где живёт pi) в начале PATH: так `pi`
    // находится, даже если PATH процесса сервера собран не полностью.
    const npmDir = path.join(process.env.USERPROFILE || 'C:\\Users', 'AppData', 'Roaming', 'npm');
    env.PATH = ['C:\\Windows\\System32', 'C:\\Windows', npmDir].filter(Boolean).join(';') + ';' + (env.PATH || '');
    const proc = pty.spawn(
      this.shell,
      ['-NoProfile', '-NoLogo', '-NoExit', '-Command', PI_AUTO_CMD],
      {
        name: 'xterm-256color',
        cols: cols || 120,
        rows: rows || 30,
        cwd: this.cwd,
        env,
      }
    );
    this.proc = proc;
    this.running = true;
    this.startedAt = Date.now();
    this.exitCode = null;
    this._stopRequested = false;
    this._history = [];
    this._historySize = 0;
    proc.onData((d) => this._onData(d));
    proc.onExit(({ exitCode }) => {
      this.running = false;
      this.exitCode = this._stopRequested ? -1 : exitCode;
      this.proc = null;
      this._emit(JSON.stringify({ code: this.exitCode, stoppedByUser: this._stopRequested }), 'exit');
    });
    return proc.pid;
  }

  write(text) {
    if (!this.running || !this.proc) throw new Error('терминал не запущен');
    const s = String(text);
    if (!s) return;
    this.proc.write(s);
  }

  resize(cols, rows) {
    if (!this.running || !this.proc) throw new Error('терминал не запущен');
    const c = Math.max(2, Math.min(500, Number(cols) || 80));
    const r = Math.max(2, Math.min(200, Number(rows) || 24));
    this.proc.resize(c, r);
  }

  replay() {
    return this._history.slice();
  }
  subscribe(res) {
    this._subs.add(res);
    return () => this._subs.delete(res);
  }

  stop() {
    if (!this.running || !this.proc) return { ok: false, error: 'терминал не запущен' };
    const pid = this.proc.pid;
    this._stopRequested = true;
    try {
      this.proc.kill();
    } catch (e) {
      console.error('Не удалось остановить терминал: ' + e.message);
    }
    return { ok: true, pid };
  }
}





function fmt(v, d) {
  return v == null ? '--' : Number(v).toFixed(d == null ? 0 : d);
}

function consoleLine(s) {
  const ts = new Date(s.t).toLocaleTimeString('ru-RU');
  const mem =
    s.memUsed != null && s.memTotal
      ? (s.memUsed / 1024).toFixed(1) + '/' + (s.memTotal / 1024).toFixed(1) + ' GB'
      : '--';
  const procs = s.processes && s.processes.length
    ? ' | процессы: ' + s.processes.map((p) => p.command + ' mem=' + fmt(p.mem) + '%').join(', ')
    : '';
  console.log(
    '[' + ts + '] ' + s.name +
    ' | загрузка ' + fmt(s.util) + '%' +
    ' | ' + fmt(s.temp) + '°C' +
    ' | hot ' + fmt(s.hotspot, 1) + '°C' +
    ' | ' + fmt(s.power, 1) + ' W' +
    ' | ' + fmt(s.clock) + ' MHz' +
    ' | VRAM ' + mem +
    ' | вентилятор ' + fmt(s.fan) + '%' +
    procs
  );
}
/** Сохранение/чтение state.json (последний выбранный батник). */
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(s) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
  } catch (e) {
    console.error('Не удалось сохранить ' + STATE_FILE + ': ' + e.message);
  }
}

/** .bat/.cmd файлы в каталоге (не рекурсивно). */
function listBats(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => /\.(bat|cmd)$/i.test(f))
      .map((f) => {
        const full = path.join(dir, f);
        return { name: f, path: full };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  } catch {
    return [];
  }
}

/** Скрипт, который сам перемещает окно PowerShell в правые 60% экрана. */
const SIDE_PS = `# GPU Monitor: PowerShell — правые 60% экрана, pi из A:\\PROJECTS
$ErrorActionPreference = 'SilentlyContinue'
$env:PATH = "$env:USERPROFILE\\AppData\\Roaming\\npm;" + $env:PATH
# Шрифт окна консоли: Cascadia Mono 12 (в conhost применяется на лету;
 # Windows Terminal берёт шрифт/схему из своих настроек).
try {
  $f = $Host.UI.RawUI.Font
  $f.Face = 'Cascadia Mono'
  $f.Size = 12
  $Host.UI.RawUI.Font = $f
} catch {}
$Host.UI.RawUI.WindowTitle = 'GPU Monitor - PowerShell'
try {
  Add-Type -AssemblyName System.Windows.Forms
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $w = [int]($screen.Width * 0.6)
  $x = $screen.Right - $w
  $y = $screen.Top
  $h = $screen.Height
  $sig = '
[DllImport("user32.dll")]
public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);'
  $u32 = Add-Type -MemberDefinition $sig -Name User32Side -Namespace Win32Side -PassThru
  $hWnd = [System.Console]::WindowHandle
  if ($hWnd -ne [IntPtr]::Zero) {
    [void]$u32::MoveWindow($hWnd, $x, $y, $w, $h, $true)
    [void]$u32::SetForegroundWindow($hWnd)
  }
} catch {}
Write-Host ''
Write-Host 'GPU Monitor: PowerShell в правой части экрана (60%). Запускаю pi из A:\\PROJECTS ...'
Set-Location 'A:\\PROJECTS'
$sideLog = 'A:\\PROJECTS\\monitoring\\log\\side-window.log'
function LogSide($m) { try { ('[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] ' + $m) | Out-File $sideLog -Append -Encoding utf8 } catch {} }
LogSide ('side-powershell started; PATH head: ' + (($env:PATH -split ';') | Select-Object -First 4) -join '; ')
$piCmd = Get-Command 'pi' -ErrorAction SilentlyContinue
if ($piCmd) {
  LogSide ('pi found: ' + $piCmd.Source)
  pi
} else {
  $nodeCmd = Get-Command 'node' -ErrorAction SilentlyContinue
  LogSide ('pi NOT FOUND; node: ' + $(if ($nodeCmd) { $nodeCmd.Source } else { 'not found' }))
  Write-Host 'Ошибка: pi не найден в PATH. Установить: npm install -g @earendil-works/pi-coding-agent' -ForegroundColor Yellow
}

`;

const SIDE_PS_FILE = path.join(__dirname, 'side-powershell.ps1');

/**
 * Живое ли сейчас боковое окно PowerShell (side-powershell.ps1)?
 * Ищем процесс по строке запуска: не храним pid окна, открытого в другой
 * вкладке/режиме — окно, которое уже открыто, не дублируется, а закрытое
 * пользователь снова поднимет при следующем заходе на страницу.
 */
function findSideWindow() {
  try {
    const res = spawnSync(
      'wmic',
      ['process', 'where', "name='powershell.exe' and commandline like '%side-powershell.ps1%'", 'get', 'processid', '/format:list'],
      { encoding: 'utf8', timeout: 8000, windowsHide: true },
    );
    const pids = [];
    for (const l of (res.stdout || '').split(/\r?\n/)) {
      const m = l.match(/ProcessId=(\d+)/);
      if (m) pids.push(Number(m[1]));
    }
    return pids.length ? { running: true, pid: pids[0] } : { running: false, pid: null };
  } catch (e) {
    return { running: false, pid: null, error: e.message };
  }
}

/** Открывает видимое PowerShell-окно: реальная консоль, правые 60% экрана, автозапуск pi. */
function openSidePowerShell() {
  try {
    fs.writeFileSync(SIDE_PS_FILE, '\uFEFF' + SIDE_PS, 'utf8');
  } catch (e) {
    throw new Error('не удалось создать ' + SIDE_PS_FILE + ': ' + e.message);
  }
  // Отдельное окно: запуск через wt.exe (Windows Terminal), чтобы боковая консоль
  // не терялась во вкладке уже открытого WT-окна пользователя. wt.exe не найден —
  // запасной путь через `start` (консоль всё равно откроется в WT).
  const psPath = path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const wtPath = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'wt.exe');
  const psArgs = [psPath, '-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', SIDE_PS_FILE];
  let child;
  if (fs.existsSync(wtPath)) {
    child = spawn(wtPath, ['-d', 'A:\\PROJECTS'].concat(psArgs), { windowsHide: true, stdio: 'ignore' });
  } else {
    child = spawn('cmd.exe', ['/c', 'start'].concat(psArgs), { windowsHide: true, stdio: 'ignore' });
  }
  child.on('error', () => {});
  child.unref();
}


/** Скрипт для иконки в системном трее: скрытый PowerShell + WinForms NotifyIcon.
 *  Двойной клик / «Открыть панель» — браузер, «Выход» — POST /api/shutdown.
 *  Если основной процесс умирает — иконка удаляет сама себя. */
const TRAY_PS = `param([string]$Url, [string]$Title, [int]$ParentPid)
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Иконка: «π» на тёмном фоне (32x32).
$bmp = New-Object System.Drawing.Bitmap 32, 32
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(13, 17, 23))
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(240, 144, 130))
$font = New-Object System.Drawing.Font('Georgia', 20, [System.Drawing.FontStyle]::Bold)
$size = $g.MeasureString('π', $font)
$g.DrawString('π', $font, $brush, ((32 - $size.Width) / 2), ((32 - $size.Height) / 2))
$g.Dispose()
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())

$ni = New-Object System.Windows.Forms.NotifyIcon
$ni.Icon = $icon
$ni.Text = $Title
$ni.Visible = $true

$script:exitRequested = $false
$ctx = New-Object System.Windows.Forms.ContextMenuStrip
$miOpen = $ctx.Items.Add('Открыть панель')
$miOpen.Add_Click({ Start-Process $Url })  # .Add() на ToolStripMenuItem не существует — только Add_Click
$miExit = $ctx.Items.Add('Выход')
$miExit.Add_Click({
  $ok = $false
  try { Invoke-WebRequest -Uri ($Url + 'api/shutdown') -Method POST -UseBasicParsing -TimeoutSec 5 | Out-Null; $ok = $true } catch {}
  if (-not $ok) {
    try { taskkill /F /IM llama-server.exe /T 2>$null | Out-Null } catch {}
    try { Stop-Process -Id $ParentPid -Force -ErrorAction SilentlyContinue } catch {}
  }
  $script:exitRequested = $true
})
$ni.ContextMenuStrip = $ctx
Register-ObjectEvent -InputObject $ni -EventName DoubleClick -Action { Start-Process $Url } | Out-Null
$ni.ShowBalloonTip(5000, $Title, 'Мониторинг запущен. Панель: ' + $Url, [System.Windows.Forms.ToolTipIcon]::Info)

# Основной цикл: DoEvents() держит иконку отзывчивой,
# опрос родительского процесса — самоочистка иконки.
while ($true) {
  [System.Windows.Forms.Application]::DoEvents()
  Start-Sleep -Milliseconds 500
  if ($script:exitRequested) { break }
  $p = Get-Process -Id $ParentPid -ErrorAction SilentlyContinue
  if (-not $p) { break }
}
$ni.Visible = $false
$ni.Dispose()
$bmp.Dispose()
`;

let trayProc = null;

/** Поднимает скрытый процесс иконки в трее (отдельно от GUI-окна). */
function startTrayHelper(url, title) {
  try {
    const tmp = path.join(os.tmpdir(), 'gpu-monitor-tray.ps1');
    fs.writeFileSync(tmp, '\uFEFF' + TRAY_PS, 'utf8');
    const psPath = path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    // ВАЖНО: без detached — на Windows (Node 24) detached-запуск powershell.exe
    // (DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP) приводит к мгновенному
    // завершению процесса кодом 0 БЕЗ выполнения скрипта — иконка не появляется.
    // Без detached дочерний процесс попадает в job-объект libuv и корректно
    // завершается вместе с основным процессом (плюс самоочистка по ParentPid).
    trayProc = spawn(psPath, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', tmp, url, title, String(process.pid)], { windowsHide: true, stdio: 'ignore' });
    trayProc.on('error', () => {});
    trayProc.unref();
    console.log('Трей: иконка добавлена (панель ' + url + ')');
  } catch (e) {
    console.error('Трей: не удалось запустить: ' + (e.message || e));
  }
}

/** Останавливает все процессы llama-server.exe (вместе с дочерними). */
function killLlamaServers() {
  if (process.platform !== 'win32') return;
  try {
    const res = spawnSync('taskkill', ['/F', '/IM', 'llama-server.exe', '/T'], { windowsHide: true, timeout: 8000 });
    console.log(res.status === 0 ? 'llama-server.exe: остановлены все процессы' : 'llama-server.exe: запущенных процессов не найдено');
  } catch (e) {
    console.error('llama-server: ' + (e.message || e));
  }
}

/** Останавливает боковое окно PowerShell с pi (side-powershell.ps1). */
function killSidePowerShell() {
  if (process.platform !== 'win32') return;
  try {
    const res = spawnSync('wmic', ['process', 'where', "name='powershell.exe' and commandline like '%side-powershell.ps1%'", 'get', 'processid', '/format:list'], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    const pids = [];
    for (const l of (res.stdout || '').split(/\r?\n/)) {
      const m = l.match(/ProcessId=(\d+)/);
      if (m) pids.push(Number(m[1]));
    }
    for (const pid of pids) {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 8000 });
      console.log('Боковое окно PowerShell (pi): остановлено, pid ' + pid);
    }
    if (!pids.length) console.log('Боковое окно PowerShell (pi): не найдено.');
  } catch (e) {
    console.error('Боковое окно: ' + (e.message || e));
  }
}

/** GUI-режим (без консоли): выводим console.* в monitor.log. */
function enableFileLogging() {
  const logPath = path.join(__dirname, 'monitor.log');
  let stream;
  try {
    stream = fs.createWriteStream(logPath, { flags: 'a' });
  } catch {
    return;
  }
  stream.on('error', () => {});
  const line = (lvl, args) => {
    try {
      const s = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
      stream.write('[' + new Date().toISOString() + '] ' + lvl + ': ' + s + '\n');
    } catch {}
  };
  console.log = (...a) => line('info', a);
  console.info = (...a) => line('info', a);
  console.warn = (...a) => line('warn', a);
  console.error = (...a) => line('error', a);
}

// Версия статических ассетов — cache-busting для кэшированного xterm.js в браузере.
const ASSET_V = '20260930a';
const PAGE = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GPU Monitor</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/xterm/xterm.css">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; background: #0d1117; color: #e6edf3; }
  .wrap { margin: 0 auto; padding: 20px 16px 40px; }
  header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; flex: none; }
  .dot.err { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
  .dot.idle { background: #8b949e; box-shadow: none; }
  h1 { font-size: 20px; margin: 0; font-weight: 600; }
  h1 #gname { color: #4fc3f7; }
  .sub { color: #8b949e; font-size: 13px; margin-left: auto; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }
  .card { background: #161b22; border: 1px solid #21262d; border-radius: 10px; padding: 12px 14px; }
  .card .label { font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: .06em; }
  .card .value { font-size: 30px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .card .unit { font-size: 14px; color: #8b949e; font-weight: 400; }
  .bar { height: 6px; background: #21262d; border-radius: 3px; margin-top: 8px; overflow: hidden; }
  .bar-fill { height: 100%; width: 0%; background: #4fc3f7; border-radius: 3px; transition: width .5s; }
  .note { font-size: 11px; color: #6e7681; margin-top: 6px; }
  .charts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px; }
  .panel { background: #161b22; border: 1px solid #21262d; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
  .panel .title { font-size: 12px; color: #8b949e; margin-bottom: 6px; }
  canvas { width: 100%; height: 130px; display: block; }
  .foot { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }
  .foot .card { margin-bottom: 0; }
  .llm-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .foot .card .value { font-size: 22px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #21262d; color: #c9d1d9; font-variant-numeric: tabular-nums; }
  th { color: #8b949e; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
  .errbox { display: none; background: #2d1517; border: 1px solid #ef4444; color: #ffb4b4; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; font-size: 13px; }
  .llm-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .llm-status { font-size: 13px; color: #c9d1d9; }
  .llm-btns { margin-left: auto; display: flex; gap: 8px; }
  button { background: #21262d; color: #e6edf3; border: 1px solid #30363d; border-radius: 8px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
  button:hover:not(:disabled) { background: #30363d; }
  button:disabled { opacity: .45; cursor: default; }
  .btn-go { background: #238636; border-color: #2ea043; color: #fff; }
  .btn-go:hover:not(:disabled) { background: #2ea043; }
  .btn-stop { background: #da3633; border-color: #f85149; color: #fff; }
  .btn-stop:hover:not(:disabled) { background: #f85149; }
  .log-btns { margin: 0 0 8px; }
  .log-col .llm-stats { margin-top: 10px; gap: 8px; }
  .log-col .llm-stats .card { padding: 10px 12px; }
  .log-col .llm-stats .card .value { font-size: 24px; }
.log { background: #010409; border: 1px solid #21262d; border-radius: 8px; padding: 10px 12px; height: 420px; overflow-y: auto; font-family: 'Cascadia Mono', Consolas, monospace; font-size: 16px; line-height: 1.19; }
  .log .l-out { color: #c9d1d9; white-space: pre-wrap; word-break: break-word; }
  .log .l-err { color: #7ec8f7; white-space: pre-wrap; word-break: break-word; }
  .log .l-sys { color: #7ee787; white-space: pre-wrap; word-break: break-word; }
  .log .ts { color: #546a83; margin-right: 8px; }
  /* Подсветка синтаксиса в логе LLM */
  .log .hl-url { color: #7ee787; text-decoration: underline; }
  .log .hl-path { color: #a5d6ff; }
  .log .hl-ts { color: #546a83; }
  .log .hl-num { color: #f7b955; }
  .log .hl-key { color: #79c0ff; }
  .log .hl-str { color: #a5d6ff; }
  .log .hl-bool { color: #ff7b72; }
  .log .hl-kw-err { color: #ff7b72; font-weight: 700; }
  .log .hl-kw-warn { color: #ffd54f; font-weight: 700; }
  .log .hl-kw-ok { color: #7ee787; }
  .log .hl-kw-info { color: #8b949e; }
  .bat-row { display: flex; align-items: center; gap: 8px; margin: 10px 0 4px; flex-wrap: wrap; }
  .bat-label { font-size: 13px; color: #8b949e; }
  .bat-row select { background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 8px; padding: 6px 8px; font-size: 13px; max-width: 340px; }
  .bat-row input { background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 8px; padding: 6px 8px; font-size: 13px; flex: 1; min-width: 220px; }
  .bat-current { font-size: 12px; color: #8b949e; margin: 0 0 8px; word-break: break-all; }
  .panel-llm { max-width: none; }
  .llm-cols { display: flex; flex-wrap: wrap; gap: 12px; align-items: stretch; }
  .log-col { flex: 1 1 0; min-width: 340px; }
  .term-col { flex: 1 1 0; min-width: 340px; display: flex; flex-direction: column; min-height: 448px; }
  .term-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .term-status { font-size: 13px; color: #c9d1d9; }
  .term-wrap { position: relative; flex: 1; min-height: 408px; display: flex; }
  .term-box { flex: 1; background: #010409; border: 1px solid #21262d; border-radius: 8px; padding: 4px 6px; }
  .term-box .xterm { height: 100%; }
  .log-wrap { position: relative; }
  #btn-log-end, #btn-term-end { position: absolute; right: 10px; bottom: 10px; display: none; background: #21262d; color: #e6edf3; border: 1px solid #30363d; border-radius: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer; z-index: 2; }
  #btn-log-end:hover, #btn-term-end:hover { background: #30363d; }
  @media (max-width: 720px) { .cards, .charts, .foot { grid-template-columns: 1fr 1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="dot" id="dot"></div>
    <h1>GPU Monitor <span id="gname"></span></h1>
    <div class="sub" id="updated"></div>
  </header>
  <div class="errbox" id="errbox"></div>

  <div class="charts">
    <div class="panel"><div class="title">Загрузка, % — последние 2 минуты</div><canvas id="c-util"></canvas></div>
    <div class="panel"><div class="title">Температура (ядро и горячая точка), °C — последние 2 минуты</div><canvas id="c-temp"></canvas></div>
    <div class="panel"><div class="title">Мощность, W — последние 2 минуты</div><canvas id="c-power"></canvas></div>
    <div class="panel"><div class="title">Частота, MHz — последние 2 минуты</div><canvas id="c-clock"></canvas></div>
  </div>

  <div class="cards">
    <div class="card"><div class="label">Загрузка GPU</div><div class="value" id="v-util">—</div><div class="unit">%</div></div>
    <div class="card"><div class="label">Температура</div><div class="value" id="v-temp">—</div><div class="unit">°C</div></div>
    <div class="card"><div class="label">Температура горячей точки</div><div class="value" id="v-hotspot">—</div><div class="unit">°C</div></div>
    <div class="card"><div class="label">Частота (SM)</div><div class="value" id="v-clock">—</div><div class="unit">MHz</div></div>
  </div>

  <div class="foot">
    <div class="card">
      <div class="label">Выделенная память GPU</div>
      <div class="value" id="v-mem">—</div><div class="unit">GB</div>
      <div class="bar"><div class="bar-fill" id="mem-bar"></div></div>
    </div>
    <div class="card">
      <div class="label">Вентилятор</div>
      <div class="value" id="v-fan">—</div><div class="unit">%</div>
      <div class="note">NVML отдаёт долю от максимума; RPM для этой карты не доступен</div>
    </div>
    <div class="card"><div class="label">Мощность</div><div class="value" id="v-power">—</div><div class="unit">W</div></div>
    <div class="card"><div class="label">Лимит мощности</div><div class="value" id="v-limit">—</div><div class="unit">W</div></div>
  </div>

  <div class="panel">
    <div class="title">Процессы на GPU (доля VRAM на процесс)</div>
    <table>
      <thead><tr><th>PID</th><th>SM, %</th><th>Память, %</th><th>Процесс</th></tr></thead>
      <tbody id="proc-body"><tr><td colspan="4">—</td></tr></tbody>
    </table>
  </div>

  <div class="panel panel-llm">
    <div class="llm-head">
      <div class="dot idle" id="llm-dot"></div>
      <div class="llm-status" id="llm-status">Не запущена</div>
    </div>
    <div class="bat-row">
      <span class="bat-label">LLM-модель:</span>
      <select id="bat-select"></select>
      <input id="bat-custom" type="text" placeholder="A:\\путь\\к\\скрипту.bat" hidden>
      <button id="btn-bat">Применить</button>
    </div>
    <div class="bat-current" id="bat-current">—</div>
    <div class="llm-cols">
      <div class="log-col">
        <div class="llm-btns log-btns">
          <button id="btn-start" class="btn-go">▶ Запустить модель</button>
          <button id="btn-stop" class="btn-stop" disabled>⏹ Остановить</button>
        </div>
        <div class="log-wrap">
          <div class="log" id="log"></div>
          <button id="btn-log-end" title="Прокрутить к последней строке и следовать за логом">⬇ К концу</button>
        </div>
        <div class="llm-stats">
          <div class="card"><div class="label">Скорость, tok/s</div><div class="value" id="v-tokps">—</div><div class="unit">средняя · генерация (n_gen)</div></div>
          <div class="card"><div class="label">Контекст</div><div class="value" id="v-ctx">—</div><div class="unit">токенов: занято / лимит</div></div>
        </div>
      </div>
      <div class="term-col">
        <div class="term-head">
          <div class="dot idle" id="term-dot"></div>
          <div class="term-status" id="term-status">Pi-агент — не запущен</div>
          <div class="llm-btns">
            <button id="btn-term-start" class="btn-go" title="Запустить Pi-агент: он сам запустит pi из A:\PROJECTS">▶ Запустить</button>
            <button id="btn-term-stop" class="btn-stop" disabled>⏹ Остановить</button>
          </div>
        </div>
        <div class="term-wrap">
          <div class="term-box" id="term-box"></div>
          <button id="btn-term-end" title="Прокрутить к последней строке и следовать за выводом">⬇ К концу</button>
        </div>
      </div>
    </div>
  </div>

</div>
<script src="/xterm/xterm.js?v=${ASSET_V}"></script>
<script src="/xterm/addon-fit.js?v=${ASSET_V}"></script>
<script src="/xterm/logre.js?v=${ASSET_V}"></script>
<script>
(function () {
  'use strict';
  var WINDOW_MS = 120000;
  var CHARTS = [
    { key: 'util',  cv: 'c-util',  color: '#4fc3f7', min: 0,   max: 100 },
    { key: 'temp',  cv: 'c-temp',  color: '#ff7043', min: 20,  max: 90, extra: { key: 'hotspot', color: '#ff5252' } },
    { key: 'power', cv: 'c-power', color: '#ffd54f', min: 0,   max: 500 },
    { key: 'clock', cv: 'c-clock', color: '#81c784', min: 400, max: 2300 }
  ];

  function fmt(v, d) { return v == null ? '—' : Number(v).toFixed(d == null ? 0 : d); }
  function setText(id, txt) { document.getElementById(id).textContent = txt; }
  function fmtK(v) { v = Number(v); return v >= 1000 ? (v / 1000).toFixed(1) + 'K' : String(v); }

  function sizeCanvas(cv) {
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function drawChart(cv, hist, cfg, now) {
    var s = sizeCanvas(cv);
    var ctx = s.ctx, W = s.w, H = s.h;
    ctx.clearRect(0, 0, W, H);
    var t0 = now - WINDOW_MS, t1 = now;
    var lo = cfg.min, hi = cfg.max;
    var px = function (t) { return (t - t0) / (t1 - t0) * W; };
    var py = function (v) { return H - 4 - (v - lo) / (hi - lo) * (H - 8); };

    ctx.strokeStyle = '#21262d';
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.lineWidth = 1;
    for (var g = 0; g <= 4; g++) {
      var yv = lo + (hi - lo) * g / 4;
      var y = py(yv);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillText(String(Math.round(yv)), 3, Math.max(10, y - 3));
    }

    var pts = [];
    for (var i = 0; i < hist.length; i++) {
      var smp = hist[i];
      if (smp.t < t0) continue;
      var val = smp[cfg.key];
      if (val == null) {
        if (pts.length) { stroke(pts, ctx, cfg.color, true); pts = []; }
        continue;
      }
      pts.push([px(smp.t), py(val)]);
    }
    if (pts.length) stroke(pts, ctx, cfg.color, true);
    if (cfg.extra) {
      var pts2 = [];
      for (var i2 = 0; i2 < hist.length; i2++) {
        var smp2 = hist[i2];
        if (smp2.t < t0) continue;
        var v2 = smp2[cfg.extra.key];
        if (v2 == null) {
          if (pts2.length) stroke(pts2, ctx, cfg.extra.color, false);
          pts2 = [];
          continue;
        }
        pts2.push([px(smp2.t), py(v2)]);
      }
      if (pts2.length) stroke(pts2, ctx, cfg.extra.color, false);
    }

    function stroke(pts, ctx, color, fillArea) {
      ctx.strokeStyle = color;
      ctx.lineWidth = fillArea ? 2 : 1.5;
      ctx.beginPath();
      for (var k = 0; k < pts.length; k++) {
        if (k) ctx.lineTo(pts[k][0], pts[k][1]);
        else ctx.moveTo(pts[k][0], pts[k][1]);
      }
      ctx.stroke();
      if (fillArea) {
        ctx.lineTo(pts[pts.length - 1][0], H);
        ctx.lineTo(pts[0][0], H);
        ctx.closePath();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function renderProcs(list) {
    var tb = document.getElementById('proc-body');
    tb.innerHTML = '';
    if (!list || !list.length) {
      var tr0 = document.createElement('tr');
      var td0 = document.createElement('td');
      td0.colSpan = 4;
      td0.textContent = 'Процессы на GPU не обнаружены';
      tr0.appendChild(td0);
      tb.appendChild(tr0);
      return;
    }
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var tr = document.createElement('tr');
      var cells = [String(p.pid), fmt(p.sm), fmt(p.mem), p.command];
      for (var j = 0; j < cells.length; j++) {
        var td = document.createElement('td');
        td.textContent = cells[j];
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
  }

  function gpuTick() {
    fetch('/api/stats')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var dot = document.getElementById('dot');
        var errbox = document.getElementById('errbox');
        if (d.error) {
          dot.className = 'dot err';
          errbox.style.display = 'block';
          errbox.textContent = 'Ошибка: ' + d.error;
        } else {
          dot.className = 'dot';
          errbox.style.display = 'none';
        }
        var L = d.latest;
        if (!L) return;
        setText('gname', L.name);
        document.title = 'GPU Monitor — ' + L.name;
        setText('v-util', fmt(L.util));
        setText('v-temp', fmt(L.temp));
        setText('v-hotspot', fmt(L.hotspot, 1));
        setText('v-power', fmt(L.power, 1));
        setText('v-clock', fmt(L.clock));
        if (L.memUsed != null && L.memTotal) {
          setText('v-mem', (L.memUsed / 1024).toFixed(1) + ' / ' + (L.memTotal / 1024).toFixed(1));
          var pct = Math.min(100, Math.round(L.memUsed / L.memTotal * 100));
          var bar = document.getElementById('mem-bar');
          bar.style.width = pct + '%';
          bar.style.background = pct >= 90 ? '#ef4444' : (pct >= 70 ? '#ffd54f' : '#4fc3f7');
        }
        setText('v-fan', fmt(L.fan));
        setText('v-limit', fmt(L.powerLimit));
        setText('updated', 'обновлено ' + new Date(L.t).toLocaleTimeString('ru-RU'));
        renderProcs(L.processes);
        var now = Date.now();
        for (var i = 0; i < CHARTS.length; i++) {
          drawChart(document.getElementById(CHARTS[i].cv), d.history, CHARTS[i], now);
        }
      })
      .catch(function (e) {
        document.getElementById('dot').className = 'dot err';
        var eb = document.getElementById('errbox');
        eb.style.display = 'block';
        eb.textContent = 'Нет связи с сервером: ' + e;
      });
  }

  // Подсветка синтаксиса: LOG_RE загружен из /xterm/logre.js (глобальный window.LOG_RE).

  function logHighlightClass(m) {
    if (m[1]) return 'hl-url';
    if (m[2]) return 'hl-path';
    if (m[3]) return 'hl-ts';
    if (m[4]) return 'hl-num';
    if (m[5]) return 'hl-key';
    if (m[6]) return 'hl-kw-err';
    if (m[7]) return 'hl-kw-warn';
    if (m[8]) return 'hl-kw-ok';
    if (m[9]) return 'hl-kw-info';
    if (m[10]) return 'hl-bool';
    return 'hl-str';
  }

  function appendHighlight(container, text) {
    LOG_RE.lastIndex = 0;
    var last = 0;
    var m;
    while ((m = LOG_RE.exec(text)) !== null) {
      if (m.index > last) {
        var p = document.createElement('span');
        p.textContent = text.slice(last, m.index);
        container.appendChild(p);
      }
      var s = document.createElement('span');
      s.className = logHighlightClass(m);
      s.textContent = m[0];
      container.appendChild(s);
      last = m.index + m[0].length;
      if (m[0].length === 0) LOG_RE.lastIndex++;
    }
    if (last < text.length) {
      var tail = document.createElement('span');
      tail.textContent = text.slice(last);
      container.appendChild(tail);
    }
  }

  function appendLogLine(l) {
    var box = document.getElementById('log');
    var div = document.createElement('div');
    div.className = 'l-' + l.stream;
    var ts = document.createElement('span');
    ts.className = 'ts';
    ts.textContent = new Date(l.ts).toLocaleTimeString('ru-RU');
    var txt = document.createElement('span');
    appendHighlight(txt, l.text === '' ? ' ' : l.text);
    div.appendChild(ts);
    div.appendChild(txt);
    box.appendChild(div);
    while (box.children.length > 2000) box.removeChild(box.firstChild);
  }


  var logId = 0;
  var logFollow = true;
  var logFirstRender = true;

  function scrollLogToEnd() {
    var box = document.getElementById('log');
    box.scrollTop = box.scrollHeight;
  }

  function logScrollHandler() {
    var box = document.getElementById('log');
    var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    logFollow = atBottom;
    document.getElementById('btn-log-end').style.display = atBottom ? 'none' : 'block';
  }

  function logTick() {
    fetch('/api/log?after=' + logId)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var box = document.getElementById('log');
        if (logId > 0 && d.oldestId > logId + 1) {
          box.innerHTML = '';
          appendLogLine({ ts: Date.now(), stream: 'sys', text: '[старые строки отброшены — показаны только последние]' });
        }
        var hasNew = d.lines.length > 0;
        for (var i = 0; i < d.lines.length; i++) appendLogLine(d.lines[i]);
        if (d.latestId > logId) logId = d.latestId;
        if (logFirstRender) {
          logFirstRender = false;
          scrollLogToEnd();
        } else if (hasNew && logFollow) {
          scrollLogToEnd();
        }
        logScrollHandler();
      })
      .catch(function () {});
  }

  function llmTick() {
    fetch('/api/llm')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var dot = document.getElementById('llm-dot');
        var status = document.getElementById('llm-status');
        if (d.running) {
          dot.className = 'dot';
          status.textContent = 'Запущена · pid ' + d.pid + ' · с ' + new Date(d.startedAt).toLocaleTimeString('ru-RU') + ' · строк лога: ' + d.logCount;
        } else if (d.stoppedByUser) {
          dot.className = 'dot idle';
          status.textContent = 'Остановлена';
        } else if (d.exitCode != null) {
          dot.className = 'dot err';
          status.textContent = 'Остановлена (код ' + d.exitCode + ')';
        } else {
          dot.className = 'dot idle';
          status.textContent = d.batExists ? 'Не запущена' : 'Не запущена · батник не найден: ' + d.bat;
        }
        document.getElementById('btn-start').disabled = d.running;
        document.getElementById('btn-stop').disabled = !d.running;
        setText('bat-current', 'Текущий: ' + d.bat + (d.batExists ? '' : '  (ФАЙЛ НЕ НАЙДЕН)'));
        setText('v-tokps', d.tokensPerSec == null ? '—' : Number(d.tokensPerSec).toFixed(1));
        setText('v-ctx', d.ctxTokens == null ? '—' : fmtK(d.ctxTokens) + (d.ctxLimit ? ' / ' + fmtK(d.ctxLimit) : ''));
      })
      .catch(function () {});
  }

  function doStart() {
    var btn = document.getElementById('btn-start');
    btn.disabled = true;
    btn.textContent = 'Запуск…';
    fetch('/api/llm/start', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) appendLogLine({ ts: Date.now(), stream: 'err', text: 'Ошибка запуска: ' + d.error });
        btn.textContent = '▶ Запустить модель';
        logFollow = true;
        scrollLogToEnd();
        document.getElementById('btn-log-end').style.display = 'none';
        llmTick();
      })
      .catch(function (e) {
        btn.textContent = '▶ Запустить модель';
        appendLogLine({ ts: Date.now(), stream: 'err', text: 'Ошибка запроса: ' + e });
      });
  }

  function doStop() {
    var btn = document.getElementById('btn-stop');
    btn.disabled = true;
    btn.textContent = 'Остановка…';
    fetch('/api/llm/stop', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.textContent = '⏹ Остановить';
        llmTick();
      })
      .catch(function (e) {
        btn.textContent = '⏹ Остановить';
        appendLogLine({ ts: Date.now(), stream: 'err', text: 'Ошибка запроса: ' + e });
      });
  }

  function loadBats() {
    fetch('/api/bats')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var sel = document.getElementById('bat-select');
        var custom = document.getElementById('bat-custom');
        sel.innerHTML = '';
        for (var i = 0; i < d.bats.length; i++) {
          var o = document.createElement('option');
          o.value = d.bats[i].path;
          o.textContent = d.bats[i].name;
          sel.appendChild(o);
        }
        var oc = document.createElement('option');
        oc.value = '__custom__';
        oc.textContent = 'Свой путь…';
        sel.appendChild(oc);
        var cur = d.current;
        var found = null;
        for (var k = 0; k < sel.options.length; k++) {
          if (sel.options[k].value === cur) { found = sel.options[k]; break; }
        }
        if (found) {
          sel.value = cur;
          custom.hidden = true;
        } else {
          sel.value = '__custom__';
          custom.value = cur || '';
          custom.hidden = false;
        }
      })
      .catch(function () {});
  }

  function doApplyBat() {
    var sel = document.getElementById('bat-select');
    var custom = document.getElementById('bat-custom');
    var p = sel.value === '__custom__' ? custom.value.trim() : sel.value;
    if (!p) {
      appendLogLine({ ts: Date.now(), stream: 'err', text: 'Укажите путь к .bat файлу' });
      return;
    }
    var btn = document.getElementById('btn-bat');
    btn.disabled = true;
    fetch('/api/llm/bat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: p })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) appendLogLine({ ts: Date.now(), stream: 'err', text: 'Не удалось установить батник: ' + d.error });
        else { loadBats(); llmTick(); }
      })
      .catch(function (e) {
        appendLogLine({ ts: Date.now(), stream: 'err', text: 'Ошибка запроса: ' + e });
      })
      .then(function () { btn.disabled = false; });
  }


  document.getElementById('bat-select').onchange = function () {
    document.getElementById('bat-custom').hidden = this.value !== '__custom__';
  };
  document.getElementById('btn-bat').onclick = doApplyBat;
  document.getElementById('btn-log-end').onclick = function () {
    logFollow = true;
    scrollLogToEnd();
    this.style.display = 'none';
  };

  // Автозапуск встроенного терминала: при загрузке страницы, если он не запущен —
  // стартует сам (pi в нём запускается автоматически).
  fetch('/api/term')
    .then(function (r) { return r.json(); })
    .then(function (d) { if (!d.running) doTermStart(); })
    .catch(function () {});

  // === Встроенный PowerShell (xterm.js + SSE) ===
  var xterm = null;
  var xtermFit = null;
  var termSse = null;
  var termDecoder = null;
  var termRunning = false;
  var termLastPing = 0;
  var termAtBottom = true; // терминал у нижней границы скроллбека
  function termUpdateEndBtn() {
    var btn = document.getElementById('btn-term-end');
    if (btn) btn.style.display = termAtBottom ? 'none' : 'block';
  }

  // Явный автоскролл: если пользователь в конце терминала — после каждого вывода
  // принудительно удерживаем вид у последней строки (страховка от того,
  // что встроенный автоскролл xterm «отваливается» в долгоживущей сессии).
  function termFollow() {
    if (!xterm || !termAtBottom) return;
    var b = xterm.buffer.active;
    if (b.viewportY < b.length - xterm.rows) xterm.scrollToBottom();
  }
  function termInit() {
    if (typeof Terminal === 'undefined') {
      document.getElementById('term-status').textContent = 'xterm.js не загружен (нет /xterm/xterm.js)';
      return;
    }
    xterm = new Terminal({
      cursorBlink: true, fontSize: 16, lineHeight: 1.2, wordWrap: true,
      fontFamily: "'Cascadia Mono', Consolas, monospace",
      scrollback: 2000,
      theme: {
        // Цветовая схема Windows 11 Terminal «Campbell»
        background: '#0C0C0C',
        foreground: '#CCCCCC',
        cursor: '#FFFFFF',
        black: '#0C0C0C', red: '#C50F1F', green: '#13A10E', yellow: '#C19C00',
        blue: '#0037DA', magenta: '#881798', cyan: '#3A96DD', white: '#CCCCCC',
        brightBlack: '#767676', brightRed: '#E74856', brightGreen: '#16C60C',
        brightYellow: '#F9F1A5', brightBlue: '#3B78FF', brightMagenta: '#B4009E',
        brightCyan: '#21D4FD', brightWhite: '#FFFFFF'
      }
    });
    // UMD-сборка @xterm/addon-fit в браузере вешает на window.FitAddon не класс,
    // а namespace-объект { FitAddon: [class] } — разбираем обе формы.
    var FitCtor = (typeof FitAddon !== 'undefined') ? (FitAddon.FitAddon || FitAddon) : null;
    xtermFit = FitCtor ? new FitCtor() : null;
    if (xtermFit) xterm.loadAddon(xtermFit);
    xterm.open(document.getElementById('term-box'));
    // Ctrl+V: пропускаем нативный вставленный браузером текст — xterm отправит его
    // терминалу как bracketed paste (pi включает режим DEC 2004). Без этого xterm
    // сам шлёт \x16 (pi его игнорирует) и блокирует событие paste браузера.
    xterm.attachCustomKeyEventHandler(function (e) {
      if (e.type === 'keydown' && e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey &&
          (e.key === 'v' || e.key === 'V')) return false;
      return true;
    });
    // Мышь: на Windows (ConPTY) собственные последовательности режимов мыши pi
    // (?1000h-?1006h) поглощаются conhost и в xterm не доходят — xterm не знает,
    // что мышь включена, и не передаёт клики/колесо терминалу. Включаем
    // mouse-reporting прямо в xterm (только клиентская сторона): клики,
    // drag-выделение и колесо уходят pi SGR-последовательностями; pi сам
    // подсвечивает выделение и копирует его в системный буфер обмена.
    xterm.write('\\x1b[?1000h\\x1b[?1002h\\x1b[?1003h\\x1b[?1004h\\x1b[?1006h');
    // Колесо — через кастомный обработчик: иначе при включённом mouse-режиме
    // xterm сначала скроллит собственный scrollback и передаёт событие только
    // когда скроллить некуда — вьюпорт pi почти никогда бы не скроллировался.
    xterm.attachCustomWheelEventHandler(function (e) {
      termSend(e.deltaY < 0 ? '\\x1b[<64;10;10M' : '\\x1b[<65;10;10M');
      return false;
    });
    window.__xterm = xterm; // для диагностики/тестов
    try { xtermFit.fit(); } catch (e) {}
    // Позицию отслеживаем по DOM-скроллу .xterm-viewport: публичный xterm.onScroll
    // в этой сборке xterm НЕ срабатывает при скролле колесом/ползунком
    // (wheel → Viewport._handleScroll → onRequestScrollLines с suppressScrollEvent: true,
    // и BufferService.scrollLines в этом случае не генерирует onScroll-событие).
    // DOM-событие scroll на viewport-элементе при этом срабатывает всегда.
    var vpEl = document.querySelector('.xterm-viewport');
    function termSyncAtBottom() {
      if (!vpEl) return true;
      termAtBottom = vpEl.scrollTop + vpEl.clientHeight >= vpEl.scrollHeight - 4;
      termUpdateEndBtn();
      return termAtBottom;
    }
    if (vpEl) vpEl.addEventListener('scroll', function () { termSyncAtBottom(); });
    xterm.onScroll(function () { termSyncAtBottom(); });
    xterm.onData(function (d) { termSend(d); });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        if (!xterm) return;
        try {
          xtermFit.fit();
          termResize();
        } catch (e) {}
      });
      ro.observe(document.getElementById('term-box'));
    }
  }

  function termSysLine(text) {
    if (xterm) xterm.write('\\r\\n\\x1b[90m' + text + '\\x1b[0m\\r\\n');
  }

  function termSend(text) {
    if (!text) return;
    if (!termRunning) termTick();
    fetch('/api/term/in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.error) termSysLine('Ошибка ввода: ' + d.error); })
      .catch(function (e) { termSysLine('Ошибка запроса: ' + e); });
  }

  function termResize() {
    if (!termRunning || !xterm) return;
    fetch('/api/term/resize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cols: xterm.cols, rows: xterm.rows })
    }).catch(function () {});
  }

  function termConnect() {
    if (termSse) { try { termSse.close(); } catch (e) {} termSse = null; }
    termDecoder = new TextDecoder('utf-8');
    termSse = new EventSource('/api/term/out');
    termLastPing = Date.now();
    termSse.addEventListener('hello', function (e) {
      termLastPing = Date.now();
      try {
        var st = JSON.parse(e.data);
        termRunning = st.running;
        termTick();
      } catch (err) {}
      // replay будет доставлен — синхронизируем offset поллинга, чтобы не дублировать чанки
      fetch('/api/term/history?total=1')
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d) termHistOffset = d.total; })
        .catch(function () {});
    });
    termSse.addEventListener('ping', function () { termLastPing = Date.now(); });
    termSse.addEventListener('exit', function (e) {
      termRunning = false;
      termLastPing = Date.now();
      try {
        var d = JSON.parse(e.data);
        termSysLine(d.stoppedByUser ? 'Терминал остановлен' : 'Процесс завершился (код ' + d.code + ')');
      } catch (err) {
        termSysLine('Процесс завершился');
      }
      termTick();
    });
    termSse.onmessage = function (e) {
      termLastPing = Date.now();
      if (!xterm || !e.data) return;
      var bin = atob(e.data);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var s = termDecoder.decode(bytes, { stream: true });
      if (s) { xterm.write(s); termFollow(); }
    };
    termSse.onerror = function () {
      if (termSse && termSse.readyState === 2) {
        try { termSse.close(); } catch (e) {}
        termSse = null;
        if (xterm) xterm.clear();
        termSysLine('SSE-поток терминала закрыт — переподключение');
        termConnect();
      }
    };
  }
  // Страховка: если SSE-поток молчит дольше 40 с (пинг сервера приходит каждые 10 с) —
  // принудительно переподключаемся, чтобы экран не застревал на старом состоянии.
  var termWatchdogOn = false;
  if (!termWatchdogOn) {
    termWatchdogOn = true;
    setInterval(function () {
      if (termSse && termLastPing && Date.now() - termLastPing > 40000) {
        try { termSse.close(); } catch (e) {}
        termSse = null;
        if (xterm) xterm.clear();
        termSysLine('SSE-поток молчит — переподключение');
        termConnect();
      }
    }, 5000);
  }

  // Fallback-поллинг: если SSE-поток «завис» (данных и пингов нет >12 с), подтягиваем
  // новые чанки PTY-истории напрямую — экран остаётся живым без переподключения.
  var termHistOffset = 0;
  var termPollDecoder = new TextDecoder('utf-8');
  setInterval(function () {
    if (!xterm || !termRunning) return;
    if (termLastPing && Date.now() - termLastPing < 12000) return;
    fetch('/api/term/history?after=' + termHistOffset)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d) return;
        termHistOffset = d.total;
        if (!d.chunks || !d.chunks.length) return;
        if (d.dropped) xterm.clear();
        for (var i = 0; i < d.chunks.length; i++) {
          var bin = atob(d.chunks[i]);
          var bytes = new Uint8Array(bin.length);
          for (var j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
          var s = termPollDecoder.decode(bytes, { stream: true });
          if (s) xterm.write(s);
        }
        termFollow();
      })
      .catch(function () {});
  }, 2000);

  function termTick() {
    fetch('/api/term')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var dot = document.getElementById('term-dot');
        var status = document.getElementById('term-status');
        if (d.running) {
          termRunning = true;
          dot.className = 'dot';
          status.textContent = 'Pi-агент · pid ' + d.pid + ' · cwd ' + d.cwd + ' · авто: ' + d.autoCommand;
        } else if (d.stoppedByUser) {
          termRunning = false;
          dot.className = 'dot idle';
          status.textContent = 'Остановлен';
        } else if (d.exitCode != null) {
          termRunning = false;
          dot.className = 'dot err';
          status.textContent = 'Процесс завершился (код ' + d.exitCode + ')';
        } else {
          termRunning = false;
          dot.className = 'dot idle';
          status.textContent = 'Pi-агент — не запущен';
        }
        document.getElementById('btn-term-start').disabled = d.running;
        document.getElementById('btn-term-stop').disabled = !d.running;
      })
      .catch(function () {});
  }

  function doTermStart() {
    var btn = document.getElementById('btn-term-start');
    btn.disabled = true;
    btn.textContent = 'Запуск…';
    if (xterm) {
      xterm.clear();
      termAtBottom = true;
      termUpdateEndBtn();
      try { xtermFit.fit(); } catch (e) {}
    }
    fetch('/api/term/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cols: xterm ? xterm.cols : 120, rows: xterm ? xterm.rows : 30 })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) {
          termSysLine('Ошибка запуска: ' + d.error);
        } else {
          termSysLine('Запущен (pid ' + d.pid + ') — ' + d.cwd + ', авто: ' + d.autoCommand);
          termRunning = true;
        }
        termConnect();
        termTick();
        btn.textContent = '▶ Запустить';
      })
      .catch(function (e) {
        termSysLine('Ошибка запроса: ' + e);
        btn.textContent = '▶ Запустить';
        termTick();
      });
  }

  function doTermStop() {
    var btn = document.getElementById('btn-term-stop');
    btn.disabled = true;
    fetch('/api/term/stop', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) termSysLine('Ошибка остановки: ' + d.error);
        termTick();
      })
      .catch(function (e) { termSysLine('Ошибка запроса: ' + e); })
      .then(function () { btn.textContent = '⏹ Остановить'; });
  }

  document.getElementById('btn-term-start').onclick = doTermStart;
  document.getElementById('btn-term-stop').onclick = doTermStop;
  document.getElementById('btn-term-end').onclick = function () {
    termAtBottom = true;
    if (xterm) { try { xterm.scrollToBottom(); } catch (e) {} }
    this.style.display = 'none';
  };


  document.getElementById('btn-start').onclick = doStart;
  document.getElementById('btn-stop').onclick = doStop;

  // Все опросы регистрируются до инициализации терминала: сбой терминала
  // не должен останавливать живой лог LLM и статусы.
  gpuTick();
  setInterval(gpuTick, 1000);
  llmTick();
  loadBats();
  setInterval(llmTick, 2000);
  logTick();
  setInterval(logTick, 1000);
  termTick();
  setInterval(termTick, 2000);
  try {
    termInit();
    termConnect();
  } catch (e) {
    document.getElementById('term-status').textContent = 'Ошибка терминала: ' + e;
  }
})();
</script>
</body>
</html>
`;

function serve(opts, sampler, llm, term, onShutdown) {
  const server = http.createServer((req, res) => {
    let pathname;
    let query = {};
    try {
      const u = new URL(req.url, 'http://localhost');
      pathname = u.pathname;
      u.searchParams.forEach((v, k) => { query[k] = v; });
    } catch {
      pathname = req.url || '/';
    }

    if (req.method === 'GET' && pathname === '/api/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(
        JSON.stringify({
          ok: !sampler.error,
          error: sampler.error,
          latest: sampler.latest,
          history: sampler.history,
          gpus: sampler.gpus.map((g) => g.name),
        })
      );
      return;
    }

    if (req.method === 'GET' && pathname === '/api/log') {
      const after = Math.max(0, Number(query.after) || 0);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(llm.logAfter(after)));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/llm') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(llm.state()));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/bats') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ dir: opts.batsDir, current: llm.batPath, bats: listBats(opts.batsDir) }));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/llm/bat') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 16000) req.destroy();
      });
      req.on('end', () => {
        let p = null;
        try {
          p = JSON.parse(body).path;
        } catch {}
        if (typeof p !== 'string' || !p.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'пустой путь' }));
          return;
        }
        try {
          llm.setBat(p.trim());
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, bat: llm.batPath }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/terminal/open') {
      try {
        openSidePowerShell();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
      }
      return;
    }

    if (req.method === 'GET' && pathname === '/api/term') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(term.state()));
      return;
    }
    if (req.method === 'GET' && pathname === '/api/terminal') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ sideWindow: findSideWindow() }));
      return;
    }



    if (req.method === 'POST' && pathname === '/api/term/start') {
        let cols = 120;
        let rows = 30;
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 16000) req.destroy(); });
        req.on('end', () => {
          try {
            const b = JSON.parse(body);
            if (Number.isInteger(b.cols)) cols = b.cols;
            if (Number.isInteger(b.rows)) rows = b.rows;
          } catch {
            // без тела — стандартный размер
          }
          try {
            const pid = term.start(cols, rows);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, pid, cwd: term.cwd, autoCommand: term.autoCommand }));
          } catch (e) {
            res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
          }
        });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/term/stop') {
      const r = term.stop();
      res.writeHead(r.ok ? 200 : 409, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(r));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/term/out') {
      // SSE-поток вывода терминала: base64-чанки (обычные data-фреймы),
      // event: hello — состояние, event: exit — завершился процесс.
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('event: hello\ndata: ' + JSON.stringify(term.state()) + '\n\n');
      for (const chunk of term.replay()) res.write('data: ' + chunk + '\n\n');
      const off = term.subscribe(res);
      const keepalive = setInterval(() => { try { res.write('event: ping\ndata: 1\n\n'); } catch {} }, 10000);
      req.on('close', () => {
        clearInterval(keepalive);
        off();
      });
      return;
    }
    if (req.method === 'POST' && pathname === '/api/term/in') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 16000) req.destroy();
      });
      req.on('end', () => {
        let text = null;
        try {
          text = JSON.parse(body).text;
        } catch {
          // нет JSON — пусто
        }
        if (typeof text !== 'string' || !text.length) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'пустая строка' }));
          return;
        }
        try {
          term.write(text);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
        }
      });
      return;
    }
    // GET /api/term/history?after=N — чанки PTY-истории начиная с индекса N (fallback-поллинг,
    // если SSE-поток в браузере «завис»). total=1 — только счётчик чанков для синхронизации offset.
    if (req.method === 'GET' && pathname === '/api/term/history') {
      const total = term._history.length;
      const m = /after=(\d+)/.exec(req.url);
      let a = m ? parseInt(m[1], 10) : 0;
      a = Math.max(0, Math.min(isFinite(a) ? a : 0, total));
      const onlyTotal = req.url.indexOf('total=1') !== -1;
      if (onlyTotal) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ total: total, after: a, chunks: [], dropped: false }));
        return;
      }
      let chunks = term._history.slice(a);
      let size = 0;
      for (let i = 0; i < chunks.length; i++) size += Buffer.byteLength(Buffer.from(chunks[i], 'base64'));
      let dropped = false;
      if (size > 256 * 1024) {
        const tail = [];
        let s2 = 0;
        for (let i = chunks.length - 1; i >= 0 && s2 <= 256 * 1024; i--) {
          tail.unshift(chunks[i]);
          s2 += Buffer.byteLength(Buffer.from(chunks[i], 'base64'));
        }
        chunks = tail;
        dropped = true;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ total: total, after: a, chunks: chunks, dropped: dropped }));
      return;
    }
    if (req.method === 'POST' && pathname === '/api/term/resize') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 4096) req.destroy();
      });
      req.on('end', () => {
        let cols = 80;
        let rows = 24;
        try {
          const b = JSON.parse(body);
          if (Number.isInteger(b.cols)) cols = b.cols;
          if (Number.isInteger(b.rows)) rows = b.rows;
        } catch {
          // без тела — без изменения
        }
        try {
          term.resize(cols, rows);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
        }
      });
      return;
    }



    if (req.method === 'POST' && pathname === '/api/llm/start') {
      try {
        const pid = llm.start();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, pid }));
      } catch (e) {
        res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/llm/stop') {
      const r = llm.stop();
      res.writeHead(r.ok ? 200 : 409, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(r));
      return;
    }

    // Favicon: логотип pi.dev (SVG; отдаём и под /favicon.ico).
    if (req.method === 'GET' && (pathname === '/favicon.svg' || pathname === '/favicon.ico')) {
      const fav = path.join(__dirname, 'web', 'favicon.svg');
      if (fs.existsSync(fav)) {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
        res.end(fs.readFileSync(fav));
        return;
      }
    }

    // Остановка всего приложения (из трея): убивает llama-server.exe и сессии pi.
    if (req.method === 'POST' && pathname === '/api/shutdown') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
      setTimeout(() => { if (onShutdown) onShutdown('api/shutdown'); }, 50);
      return;
    }

    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(PAGE);
      return;
    }

    // Статика: xterm.js + css + fit-аддон (vendored в ./web).
    if (req.method === 'GET' && pathname.startsWith('/xterm/')) {
      const WEB_ROOT = path.join(__dirname, 'web');
      const rel = pathname.slice('/xterm/'.length);
      const file = path.join(WEB_ROOT, rel);
      if (!file.startsWith(WEB_ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(file).toLowerCase();
      const mime = ext === '.js' ? 'application/javascript; charset=utf-8'
        : ext === '.css' ? 'text/css; charset=utf-8'
        : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
      res.end(fs.readFileSync(file));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
  server.on('error', (e) => {
    console.error('Ошибка сервера: ' + e.message);
    process.exit(1);
  });
  server.listen(opts.port, opts.host, () => {
    console.log('Веб-дашборд: http://' + opts.host + ':' + opts.port);
  });
}

function main() {
  const opts = parseArgs(process.argv);
  const smi = findNvidiaSmi();
  if (!smi) {
    console.error('nvidia-smi не найден. Установите драйвер NVIDIA.');
    process.exit(1);
  }
  // Горячая точка GPU: nvidia-smi её не отдаёт — отдельный скрытый процесс
  // LibreHardwareMonitor (запрос из help.txt: датчик «GPU Hot Spot»).
  const hotspot = new HotspotPoller({ intervalMs: 2000 });
  hotspot.start();

  let noted = false;
  const state = loadState();
  let initialBat = opts.bat;
  if (state.lastBat && fs.existsSync(state.lastBat)) {
    initialBat = state.lastBat;
    console.log('Использую последний батник из ' + STATE_FILE + ': ' + initialBat);
  }
  opts.batsDir = opts.batsDir || path.dirname(initialBat);
  const llm = new LlmManager(initialBat, {
    onPersist: (p) => {
      const s = loadState();
      s.lastBat = p;
      saveState(s);
    },
  });
  const sampler = new Sampler({
    smiPath: smi,
    intervalMs: opts.intervalMs,
    gpuIndex: opts.gpu,
    augment: (s) => { s.hotspot = hotspot.valueFor(s.name); },
    onSample: (s, samp) => {
      if (!noted) {
        noted = true;
        console.log('GPU в системе: ' + samp.gpus.map((g, i) => i + ': ' + g.name).join(', '));
        console.log('Мониторинг: ' + s.name + ' (опрос ' + opts.intervalMs + ' мс)');
        console.log('LLM-батник: ' + llm.batPath + (fs.existsSync(llm.batPath) ? '' : ' (ФАЙЛ НЕ НАЙДЕН)'));
        console.log('Каталог батников: ' + opts.batsDir + ' (найдено: ' + listBats(opts.batsDir).length + ')');
        if (!opts.console) console.log('Откройте в браузере: http://' + opts.host + ':' + opts.port);
      }
      if (opts.console) consoleLine(s);
    },
  });

  const term = new PtyTerm(opts.termCwd, {});

  // GUI-режим: exe запущен без консоли (окна нет) — приложение живёт в системном трее.
  const isTty = !!(process.stdout && process.stdout.isTTY);
  const isSeaExe = process.execPath.toLowerCase().endsWith('gpu-monitor.exe');
  const guiMode = process.platform === 'win32' && !opts.console && isSeaExe && !isTty;
  if (guiMode) enableFileLogging();

  let shuttingDown = false;
  const shutdown = (reason) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('Остановка (' + reason + ')…');
    try { if (trayProc) trayProc.kill(); } catch {}
    if (llm.running && llm.proc) llm.stop();
    killLlamaServers();
    if (term.running && term.proc) {
      const tpid = term.proc.pid;
      term.stop();
      try { spawnSync('taskkill', ['/PID', String(tpid), '/T', '/F'], { windowsHide: true, timeout: 5000 }); } catch {}
    }
    killSidePowerShell();
    sampler.stop();
    hotspot.stop();
    console.log('Остановлено: модель, llama-server.exe, сессии pi (встроенный терминал и боковое окно).');
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // Страховка при принудительном завершении (taskkill /F, «Завершить задачу»):
  // llama-server.exe и сессии pi не должны остаться висеть.
  process.on('exit', () => {
    if (shuttingDown) return;
    try {
      if (term.proc) spawnSync('taskkill', ['/PID', String(term.proc.pid), '/T', '/F'], { windowsHide: true, timeout: 3000 });
      if (llm.proc) spawnSync('taskkill', ['/PID', String(llm.proc.pid), '/T', '/F'], { windowsHide: true, timeout: 3000 });
      killLlamaServers();
      killSidePowerShell();
    } catch {}
  });

  if (!opts.console) serve(opts, sampler, llm, term, shutdown);

  if (guiMode && !opts.noTray) {
    const url = 'http://' + opts.host + ':' + opts.port + '/';
    startTrayHelper(url, 'GPU Monitor');
  }
}

main();