@echo off
chcp 65001 > nul
title llamAmpere Router: Qwen 3.8 27B + Coder 1.5B + Embedding + Reranker

:: УБИРАЕМ ТРЕСК: Ограничиваем пиковое потребление RTX 3090Ti до сбалансированных 300 Ватт.
:: Используем глобальный индекс шины (1), подтверждённый nvidia-smi.
nvidia-smi -i 1 -pl 300

:: АВТОЧАСТОТА: Сбрасываем фиксацию ядра - драйвер сам подбирает частоту (boost).
nvidia-smi -i 1 -rgc

:: Жестко сбрасываем кодировку консоли обратно в UTF-8 после вызова утилит NVIDIA
chcp 65001 > nul
cls

:: ВАЖНО: тело батника - только 2-байтовая кириллица (UTF-8), без трёхбайтовых
:: символов (кавычки-ёлочки, длинное тире, многоточие): cmd.exe под chcp 65001
:: на них десинхронизируется и исполняет хвост строки как команду.

:: ИЗОЛЯЦИЯ: Скрываем RTX 4060 для ИИ-сервера, отдавая модели только 3090Ti
:: (CUDA-индекс 0 = физический GPU 1 в nvidia-smi)
set CUDA_VISIBLE_DEVICES=0

:: Ускорение префилла: int8 Q*K-внимание (v0.5)
set GGML_CUDA_FA_I8QK=1

:: Полная очистка памяти от всех зависших ИИ-процессов перед стартом
taskkill /f /im freetoken.exe /im ft.exe /im python.exe /im llama-server.exe /im llama-cli.exe > nul 2>&1

echo =======================================================================
echo  Запуск LLM-роутера: llama-server (router mode)
echo  Модели (пресет A:\LLM\llamAmpere\router-models\pi-models.ini):
echo    1. qwen3.8-27b         - Qwen 3.8 27B Uncensored IQ4_XS-M + зрение (mmproj)
echo                            - контекст 192K, KV tq5_0/turbo4 + MTP, грузится при старте
echo    2. qwen2.5-coder-1.5b  - Qwen2.5 Coder 1.5B Q4_K_M (Tab-автодополнение)
echo                            - контекст 8K, 2 слота, грузится при старте
echo    3. qwen3-embedding-0.6b - Qwen3 Embedding 0.6B (роль embed в Continue)
echo                            - грузится по требованию (pi: /llama)
echo    4. qwen3-reranker-0.6b  - Qwen3 Reranker 0.6B (роль rerank в Continue)
echo                            - грузится по требованию (pi: /llama)
echo  Бэкенд: llamAmpere v0.5+ (Сборка под Windows 11, CUDA, sm_86)
echo  Дисковый кэш промптов: 24 GiB на A:\LLM\prompt-cache
echo  Конфигурация: RTX 3090Ti 24GB (CUDA-индекс 0) [RTX 4060 НЕ УЧАСТВУЕТ]
echo  Сетевой адрес: http://192.168.1.117 (порт 9931)
echo  Управление моделями: в pi команда /llama (загрузка/выгрузка по требованию)
echo =======================================================================
echo.

"A:\LLM\llamAmpere\build-win64-cuda\bin\llama-server.exe" ^
  --models-preset "A:\LLM\llamAmpere\router-models\pi-models.ini" ^
  --no-models-autoload ^
  --host "192.168.1.117" ^
  --port 9931 ^
  --cors-origins "*" ^
  --api-key "local-bypass" ^
  --cache-disk-path "A:\LLM\prompt-cache" ^
  --cache-disk-limit 24576

echo.
echo =============================================================
echo Сервер остановился или упал. Проверьте логи выше.
echo =============================================================
pause
exit /b 0
