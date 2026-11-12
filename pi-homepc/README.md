# pi-homepc

Личный [pi](https://pi.dev) пакет пользователя HOME-PC (Windows).
Собирает в один installable-юнит все мои кастомные расширения.

## Что внутри

| Ресурс | Файл | Назначение |
|---|---|---|
| Extension | `extensions/obsidian-context.ts` | Перед ответом на ЛЮБОЙ промпт агент сначала анализирует md-заметки Obsidian-хранилища (`\\192.168.1.1\backup\Obsidian\Obsidian`) инструментом `obsidian` (files / search / read) и учитывает их в ответе. |
| Extension | `extensions/obsidian-auto-note.ts` | После каждого завершённого хода дописывает блок «prompt + result» в заметку `pi-log/session-<id>.md` в хранилище. Основная запись — прямой FS-write на шару (работает без приложения Obsidian), fallback — `obsidian` CLI. Ошибки не рвут сессию. |
| Extension | `extensions/git-stderr-guard.ts` | Постоянный фикс `fatal: not a git repository` в TUI: патчит `child_process.execSync`/`execFileSync` так, что git-команды без явного `stdio` получают `stdio: ["pipe","pipe","ignore"]` — stderr git больше не протекает в терминал. Живёт в локальном пакете, поэтому `pi update --extensions` его не перезаписывает. **Важно:** пакет `pi-homepc` должен быть ПЕРВЫМ в массиве `packages` в `settings.json` — иначе ESM-импорт `node:child_process` в bigpowers «заморозит» оригинальный `execSync` до патча (см. «Порядок загрузки»). |
| Пакет (вендор) | `packages/pi-obsidian/` | Вендор `@bacnh85/pi-obsidian` 0.9.0 + HOME-PC патч guard: read-only bash (ls, du, wc, cat, head, tail, find, grep, ...) на vault РАЗРЕШЁН; блокируются только write-команды и неизвестные команды, обращающиеся к vault. Сегментный анализ составных команд (`;`/`|`/`&&`) — цепочки вида `ls C:/x; du -sh K:/vault` больше не блокируются целиком. npm-пакет из `packages` в `settings.json` исключён. |
| Config | `config/` | Полный снапшот настроек pi (HOME-PC): `settings.json`, `models.json`, `mcp.json`, `auth.json`, `provider-keys.json`, `models-store.json`, `APPEND_SYSTEM.md`, `extensions/pi-fff.json`, `prompts/diag-continue.md` |

## Вендор `packages/pi-obsidian` (guard на vault)

`@bacnh85/pi-obsidian` не имеет настроек («Zero env vars»): его bash-guard
консервативно блокирует ЛЮБУЮ составную bash-команду (`;`, `|`, `&`, `$`, `()`)
и любые «неизвестные» команды (du, wc, ...), если команда упоминает путь vault.
Команда из-за этого умирала целиком — вместе с не-vault частями.

Решение: пакет завендорен в `packages/pi-obsidian/` (полная копия 0.9.0),
патч в `extensions/index.ts`:
- `isVaultFilesystemBashCommand` теперь разбивает команду на сегменты
  (`splitShellSegments`, quote-aware) и проверяет каждый отдельно;
- read-only команды (`READONLY_COMMANDS`: ls, find, cat, head, tail, grep, rg,
  du, wc, file, stat, diff, sort, ...) разрешены на путях vault;
- write-команды (cp, mv, rm, touch, mkdir, rmdir, tee, unlink, truncate,
  sed -i, перенаправление `>`) и неизвестные команды, обращающиеся к vault,
  по-прежнему блокируются; redirect в vault блокирует любую команду.

Тест: `node guard-test.mjs` (в корне `packages/pi-obsidian/`) — 18 кейсов.

Обновление вендора: перескопировать файлы из
`C:\Users\HOME-PC\.pi\agent\npm\node_modules\@bacnh85\pi-obsidian\` и заново
наложить патч (маркер комментария `HOME-PC vendoring patch`).

`node_modules` в `packages/pi-obsidian/` — symlink на
`C:\Users\HOME-PC\.pi\agent\npm\node_modules` (resolving `typebox`).

## Установка

```bash
# локальный путь (личный, персональный scope → ~/.pi/agent/settings.json)
pi install A:/PROJECTS/pi-homepc

# посмотреть установленные
pi list

# удалить
pi remove A:/PROJECTS/pi-homepc
```

Локальный пакет загружается по пути без копирования. Если `A:\` недоступна —
пакет не загрузится (проверь шар).

## Порядок загрузки (важно для git-stderr-guard)

pi загружает каждое расширение через `jiti.import()` (async-ESM). ESM-импорт
`import { execSync } from "node:child_process"` в другом расширении (например,
в `bigpowers/omp-hooks.ts`) «замораживает» CJS-экспорт `node:child_process` в
момент ПЕРВОГО `import()` этого модуля. Если какое-то расширение загрузится
ДО `git-stderr-guard`, его `execSync`-биндинг сохранит оригинальную функцию и
патч для него не сработает — `fatal: not a git repository` снова будет
протекать в TUI.

Поэтому:

1. `A:\PROJECTS\pi-homepc` должен быть **ПЕРВЫМ** элементом массива `packages`
   в `C:\Users\HOME-PC\.pi\agent\settings.json`.
2. Если порядок случайно сломали, guard сам напишет предупреждение в
   `%TEMP%\pi-git-stderr-guard.log` — по нему легко диагностировать регрессию.

Проверено 2026-11-02: порядок «guard первым» убирает утечку, «guard последним»
воспроизводит её.

## Настройки (`config/`)

Зеркало локальной директории pi (`C:\Users\HOME-PC\.pi`), снапшот от 2026-10-26:

```
config/
├── models.json                  # ~/.pi/models.json (кастомные провайдеры)
└── agent/                       # ~/.pi/agent
    ├── APPEND_SYSTEM.md         # системный addendum
    ├── settings.json            # основные настройки
    ├── models.json              # модели агента
    ├── models-store.json        # хранилище моделей
    ├── mcp.json                 # MCP-серверы
    ├── auth.json                # авторизация провайдеров
    ├── provider-keys.json       # ключи провайдеров
    ├── extensions/pi-fff.json   # конфиг расширения pi-fff
    └── prompts/diag-continue.md # prompt-шаблон /diag-continue
```

Восстановление:

```powershell
# Windows
Copy-Item -Recurse pi-homepc/config/agent/* $env:USERPROFILE\.pi\agent\
Copy-Item pi-homepc/config/models.json $env:USERPROFILE\.pi\models.json
```

НЕ включено: `npm/node_modules` (ставится по `package.json`), `sessions/`,
`memories/`, `web-search-cache/`, `session-hoarder/`, `bin/` — кэши и данные,
не настройки.

`auth.json` и `provider-keys.json` содержат ключи — при публикации пакета
в npm или открытии репозитория секреты проверить.

## Издание (опционально)

Пакет помечен `private: true` — `npm publish` заблокирован, пока флаг не убрать.
Для публикации: убери `private`, пожелай имя в npm-registry (например
`@homepc/pi`), затем `npm publish`. `keywords: ["pi-package"]` уже на месте —
пакет будет виден в [Pi package gallery](https://pi.dev/packages).

## Зависимости

- `@earendil-works/pi-coding-agent: *` — declared в `peerDependencies`
  (host-provided пакет, поставляется самим pi, не бандлится).
- Node built-ins: `node:fs`, `node:path`, `node:child_process` (в auto-note).

## Важно при переносе

Оба расширения захардкожены под хранилище `\\192.168.1.1\backup\Obsidian\Obsidian`.
При переносе на другую машину/хранилище поправь константы `VAULT` (auto-note)
и путь в `GUIDELINE` (context) — или вынеси в настройк