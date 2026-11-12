---
description: Диагностика Continue (лог с ноутбука + проверка туннеля)
argument-hint: "[путь к continue-diag.log]"
---
Проведи диагностику плагина Continue (IntelliJ) + Qwen Autocomplete.

1. Прочитай лог: ${1:-A:\SOFT\plugins IDEA\continue-diag.log}
   (лог генерируется diagnostics-continue.bat на ноутбуке INNOTECH и копируется в A:\SOFT\plugins IDEA).
   Если в аргументе указан другой путь — используй его.
2. Сам проверь туннель с этой машины (раздел 7 лога может быть устаревшим):
   `powershell -NoProfile -Command "(Invoke-WebRequest -Uri 'https://lm.dimarassadnikov.netcraze.link/v1/models' -Headers @{Authorization='Bearer local-bypass'} -UseBasicParsing -TimeoutSec 20).StatusCode"`
   200 = туннель жив, 410 = туннель мёртв.
3. Проанализируй разделы лога:
   - Раздел 2 — конфиг: роли (chat/edit/apply, embed, autocomplete, rerank), параметры моделей.
   - Раздел 3 — core.log: ошибки загрузки конфига, статус индексирования, ошибки сессий.
   - Раздел 4 — события autocomplete: mtime файла (запросы были ПОСЛЕ обновления конфига?), selectedProfileId (должен быть профиль из config.yaml, а не «local»), maxPromptTokens (должен совпадать с tabAutocompleteOptions из конфига).
   - Раздел 7 — статус туннеля в момент снятия лога.
4. Сформулируй: корневая причина, что уже исправлено с прошлого раза, что делать дальше (по шагам).
5. Сохрани результат в заметку Obsidian (k:\Obsidian\Obsidian\Results), секция с итогом после слова «Готово».
