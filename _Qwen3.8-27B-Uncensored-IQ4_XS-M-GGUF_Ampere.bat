@echo off
:: REMOVE CRACKLING: cap RTX 3090Ti peak draw at a balanced 250 Watts.
:: Use the global bus index (1), confirmed by nvidia-smi.
nvidia-smi -i 1 -pl 250

:: AUTO CLOCK: reset locked core clocks - the driver picks the boost itself.
nvidia-smi -i 1 -rgc

:: Force the console codepage back to UTF-8 after the NVIDIA utilities.
chcp 65001 > nul
cls

:: ISOLATION: hide the RTX 4060 from the AI server, Qwen 3.8 gets only the 3090Ti
:: (CUDA index 0 = physical GPU 1 in nvidia-smi)
set CUDA_VISIBLE_DEVICES=0

title llamAmpere Server: ATX-Swift-1.5-Qwen3.8-27B-Uncensored (IQ4_XS-M) v0.5

:: Full cleanup of stuck AI processes before start
taskkill /f /im freetoken.exe /im ft.exe /im python.exe /im llama-server.exe /im llama-cli.exe > nul 2>&1

:: NOTE: the .bat body is PURE ASCII on purpose. Under chcp 65001, cmd.exe
:: desyncs on multi-byte UTF-8 (3-byte chars, e.g. quotes) and can execute a
:: fragment of a Cyrillic line as a command (log: "'iva:' is not recognized" -
:: the tail of the comment line "Alternative:"). That is why all comments are
:: in English and the Russian banner lives in a UTF-8 file printed via PowerShell.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Encoding UTF8 'A:\LLM\banner_Qwen3.8-27B_Ampere.txt' | Write-Host" 2>nul

:: IMPORTANT: --mmproj is attached - Qwen3.8 vision model (mmproj-F16.gguf).
:: Max speed per v0.5 RECOMMENDED ("Pure speed"): KV cache tq5_0/turbo4.
:: Alternative: sjkvarn4/sjkvarn4 (SJ-KVaRN 4/4, "Balanced").
:: Prefill speedup: int8 Q*K attention (v0.5, off by default)
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
echo Server stopped or crashed. Check the log above.
echo =============================================================
pause
exit /b 0
