@echo off
:: УБИРАЕМ ТРЕСК: Ограничиваем пиковое потребление RTX 3090Ti до сбалансированных 250 Ватт.
:: Используем глобальный индекс шины (1), подтверждённый nvidia-smi.
nvidia-smi -i 1 -pl 250

:: МАКСИМАЛЬНЫЙ РАЗГОН: Фиксируем частоту ядра на 1450 МГц (выше base 1395, ниже boost 1695)
:: для баланса скорости и стабильности вольтажа.
nvidia-smi -i 1 -lgc 1450

:: Жестко сбрасываем кодировку консоли обратно в UTF-8 после вызова утилит NVIDIA
chcp 65001 > nul
cls

:: ИЗОЛЯЦИЯ: Скрываем RTX 4060 для ИИ-сервера, отдавая Qwen 3.8 только 3090Ti
:: (CUDA-индекс 0 = физический GPU 1 в nvidia-smi, порядок определяется драйвером)
set CUDA_VISIBLE_DEVICES=0

title Llama.cpp Vision + DFlash Server: Qwen3.8-27B (MAX SPEED 60-70 T/S)

:: Полная очистка памяти от всех зависших ИИ-процессов перед стартом
taskkill /f /im freetoken.exe /im ft.exe /im python.exe /im llama-server.exe /im llama-cli.exe > nul 2>&1

echo =======================================================================
echo  Запуск модели со зрением: Qwen3.8-27B-abliterated (GSQ-RCO-IQ3_S)
echo  Спекулятивный драфт: Внешняя модель DFlash 2 [УСПЕШНО АКТИВИРОВАНА]
echo  Визуальный проектор: mmproj-F16.gguf [ПОДКЛЮЧЕН]
echo  Оптимизация: Контекст 128K (Максимум для 24GB VRAM), 4-bit KV Cache, FlashAttn
echo  КЭШ КОНТЕКСТА: Continuous Batching (--cont-batching) [ВКЛЮЧЕН]
echo  МАКСИМАЛЬНЫЙ РАЗГОН SPEED: Temp 0.1 , Draft N Max 5 [АКТИВИРОВАНО]
echo  МНОГОПОТОЧНОСТЬ: 1 слот (128K контекст), Continuous Batching для очереди
echo  Конфигурация: RTX 3090Ti 24GB (Индекс 1) [RTX 4060 НЕ УЧАСТВУЕТ]
echo  Сетевой адрес: http://192.168.1.117:9931
echo =======================================================================
echo.

"A:\LLM\llama-cpp\llama-server.exe" ^
  -m "A:\LLM\llama-cpp\models\Qwen3.8-27B-abliterated-GSQ-RCO-IQ3_S\Qwen3.8-27B-abliterated-GSQ-RCO-IQ3_S.gguf" ^
  -md "A:\LLM\llama-cpp\models\Qwen3.8-27B-abliterated-GSQ-RCO-IQ3_S\Qwen3.8-27B-DFlash2-Q4_K_M.gguf" ^
  --mmproj "A:\LLM\llama-cpp\models\Qwen3.8-27B-abliterated-GSQ-RCO-IQ3_S\mmproj-F16.gguf" ^
  --host "192.168.1.117" ^
  --port 9931 ^
  -ngl all ^
  -ngld all ^
  --fit off ^
  -mg 0 ^
  -c 131072 ^
  --temp 0.1 ^
  --top-p 0.95 ^
  -t 6 ^
  -tb 6 ^
  --cache-type-k q4_0 ^
  --cache-type-v q4_0 ^
  --cache-type-k-draft q4_0 ^
  --cache-type-v-draft q4_0 ^
  --image-min-tokens 1024 ^
  --flash-attn on ^
  -b 2048 ^
  -ub 512 ^
  --jinja ^
  --reasoning-effort low ^
  --reasoning-budget 2048 ^
  --no-reasoning-preserve ^
  --cors-origins "*" ^
  --parallel 1 ^
  --cont-batching ^
  --spec-type draft-dflash ^
  --spec-draft-n-max 5 ^
  --api-key "local-bypass"
  
echo.
echo =============================================================
echo Сервер остановился или упал. Проверьте логи выше.
echo =============================================================
pause
