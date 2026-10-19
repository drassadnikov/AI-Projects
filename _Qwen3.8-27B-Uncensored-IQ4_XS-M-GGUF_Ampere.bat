@echo off
:: УБИРАЕМ ТРЕСК: Ограничиваем пиковое потребление RTX 3090Ti до сбалансированных 250 Ватт.
:: Используем глобальный индекс шины (1), подтверждённый nvidia-smi.
nvidia-smi -i 1 -pl 250

:: АВТОЧАСТОТА: Сбрасываем фиксацию ядра - драйвер сам подбирает частоту (boost).
nvidia-smi -i 1 -rgc

:: Жестко сбрасываем кодировку консоли обратно в UTF-8 после вызова утилит NVIDIA
chcp 65001 > nul
cls

:: ВАЖНО: тело батника - только 2-байтовая кириллица (UTF-8), без трёхбайтовых
:: символов (кавычки-ёлочки, длинное тире, многоточие): cmd.exe под chcp 65001
:: на них десинхронизируется и исполняет хвост строки как команду (в логе было:
:: 'ива:' is not recognized - хвост комментария "Альтернатива:").

:: ИЗОЛЯЦИЯ: Скрываем RTX 4060 для ИИ-сервера, отдавая Qwen 3.8 только 3090Ti
:: (CUDA-индекс 0 = физический GPU 1 в nvidia-smi)
set CUDA_VISIBLE_DEVICES=0

title llamAmpere Server: ATX-Swift-1.5-Qwen3.8-27B-Uncensored (IQ4_XS-M) v0.5

:: Полная очистка памяти от всех зависших ИИ-процессов перед стартом
taskkill /f /im freetoken.exe /im ft.exe /im python.exe /im llama-server.exe /im llama-cli.exe > nul 2>&1

echo =======================================================================
echo  Запуск модели: ATX-Swift-1.5-Qwen3.8-27B-Uncensored (IQ4_XS-M)
echo  Бэкенд: llamAmpere v0.5+ (Сборка под Windows 11, CUDA, sm_86)
echo  Спекулятивный драфт: Нативная MTP-голова [ВКЛЮЧЕНО ПО УМОЛЧАНИЮ]
echo  Оптимизация: Контекст 110K (110592) на 1 слот, KV-кэш: tq5_0/turbo4 (Pure speed, макс. скорость)
echo  Reasoning-preserve: ВЫКЛЮЧЕНО (--no-reasoning-preserve - экономит токены в длинных сессиях)
echo  Дисковый кэш промптов: 24 GiB на A:\LLM\prompt-cache
echo  Конфигурация: RTX 3090Ti 24GB (CUDA-индекс 0) [RTX 4060 НЕ УЧАСТВУЕТ]
echo  Сетевой адрес: http://192.168.1.117:9931
echo =======================================================================
echo.

:: ВАЖНО: Флаг --mmproj подключён - модель Qwen3.8 со зрением (mmproj-F16.gguf).
:: Максимальная скорость по v0.5 RECOMMENDED (вариант "Pure speed"): KV-кэш tq5_0/turbo4.
:: Альтернатива: sjkvarn4/sjkvarn4 (SJ-KVaRN 4/4, вариант "Balanced").
:: Ускорение префилла: int8 Q*K-внимание (v0.5, по умолчанию выключено)
set GGML_CUDA_FA_I8QK=1
"A:\LLM\llamAmpere\build-win64-cuda\bin\llama-server.exe" ^
  -m "A:\LLM\llamAmpere\models\Qwen3.8-27B-Uncensored-IQ4_XS-M-GGUF\ATX-Swift-1.5-Qwen3.8-27B-Uncensored-IQ4_XS-M.gguf" ^
  --mmproj "A:\LLM\llamAmpere\models\Qwen3.8-27B-Uncensored-IQ4_XS-M-GGUF\mmproj-F16.gguf" ^
  --image-min-tokens 1024 ^
  --host "192.168.1.117" ^
  --port 9931 ^
  -c 110592 ^
  -ngl 99 ^
  -fa on ^
  -ctk tq5_0 ^
  -ctv turbo4 ^
  -b 4096 ^
  -ub 1024 ^
  --parallel 1 ^
  --cors-origins "*" ^
  --api-key "local-bypass" ^
  --no-reasoning-preserve ^
  --cache-disk-path "A:\LLM\prompt-cache" ^
  --cache-disk-limit 24576

echo.
echo =============================================================
echo Сервер остановился или упал. Проверьте логи выше.
echo =============================================================
pause
exit /b 0
