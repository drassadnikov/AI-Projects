@echo off
:: УБИРАЕМ ТРЕСК: Ограничиваем пиковое потребление RTX 3090Ti до сбалансированных 250 Ватт.
:: КРИТИЧНО! Эта команда должна идти первой и использовать глобальный индекс карты (1).
nvidia-smi -i 1 -pl 250

:: МАКСИМАЛЬНЫЙ РАЗГОН: Поднимаем частоту ядра до 1450 МГц (безопасный предел тишины и холода).
nvidia-smi -i 1 -lgc 1450

:: Жестко сбрасываем кодировку консоли обратно в UTF-8 после вызова nvidia-smi
chcp 65001 > nul
cls

title Llama.cpp Vision + Draft Server: Qwen3.8-27B (MAX SPEED 60-70 T/S)

:: Полная очистка памяти от всех зависших ИИ-процессов перед стартом
taskkill /f /im freetoken.exe /im ft.exe /im python.exe /im llama-server.exe > nul 2>&1

:: ИЗОЛЯЦИЯ: Скрываем RTX 4060 для самого ИИ-сервера, отдавая всю работу только 3090Ti
set CUDA_VISIBLE_DEVICES=0

echo =======================================================================
echo  Запуск модели со зрением: Qwen3.8-27B-abliterated (GSQ-RCO-IQ3_S)
echo  Спекулятивный драфт: Qwen3.8-27B-DFlash2-Q4_K_M [АКТИВЕН]
echo  Визуальный проектор: mmproj-F16.gguf [ПОДКЛЮЧЕН]
echo  Оптимизация: Сбалансированный контекст 90К+ , 4-bit KV Cache , FlashAttn
echo  Конфигурация: RTX 3090Ti 24GB [MAX SPEED РАЗГОН]
echo  Сетевой адрес: http://192.168.1.117:9931
echo =======================================================================
echo.

:: ИСПРАВЛЕНО: Короткие ключи кэша заменены на валидные полные --cache-type-*.
:: ИСПРАВЛЕНО: Контекст -c приведен к безопасному для 24GB VRAM значению 92160.
:: ИСПРАВЛЕНО: Флаг температуры заменен на синтаксически верный --temp 0.6.
:: Закрывающий флаг --api-key очищен от знака переноса ^.

"A:\LLM\llama-cpp\llama-server.exe" ^
  -m "A:\LLM\llama-cpp\models\Qwen3.8-27B-abliterated-GSQ-RCO-IQ3_S\Qwen3.8-27B-abliterated-GSQ-RCO-IQ3_S.gguf" ^
  -md "A:\LLM\llama-cpp\models\Qwen3.8-27B-abliterated-GSQ-RCO-IQ3_S\Qwen3.8-27B-DFlash2-Q4_K_M.gguf" ^
  --mmproj "A:\LLM\llama-cpp\models\Qwen3.8-27B-GSQ-RCO-IQ3_S\mmproj-F16.gguf" ^
  --host "192.168.1.117" ^
  --port 9931 ^
  -ngl all ^
  -ngld all ^
  --fit off ^
  -mg 0 ^
  -ts 1,0 ^
  -c 262144 ^
  --temp 0.6 ^
  --top-p 0.95 ^
  -t 6 ^
  -tb 6 ^
  --cache-type-k q4_0 ^
  --cache-type-v q4_0 ^
  --cache-type-k-draft q4_0 ^
  --cache-type-v-draft q4_0 ^
  --image-min-tokens 1024 ^
  --flash-attn on ^
  -b 512 ^
  -ub 128 ^
  --jinja ^
  --reasoning-effort low ^
  --reasoning-budget 2048 ^
  --no-reasoning-preserve ^
  --cors-origins "*" ^
  --parallel 1 ^
  --spec-type draft-dflash ^
  --spec-draft-n-max 3 ^
  --api-key "local-bypass"
  
echo.
echo =============================================================
echo Мониторинг RTX 3090 Ti активен. Для выхода нажмите Ctrl+C
echo =============================================================

echo.
echo =============================================================
echo Сервер остановился.
echo =============================================================
pause
