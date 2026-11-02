# Отложенный перезапуск gpu-monitor.exe: новая частота CPU (max P-state, как в диспетчере задач).
# Ждём завершения текущего запроса pi, потом: kill -> swap exe -> start -> запуск LLM-модели.
$ErrorActionPreference = 'Continue'
$log = 'A:\PROJECTS\monitoring\log\restart-cputime.log'
function L($m) { ('[' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '] ' + $m) | Out-File $log -Append -Encoding utf8 }

L 'start: ожидание 75 c (завершение текущего запроса pi)'
Start-Sleep 75

$mp = Get-Process gpu-monitor -ErrorAction SilentlyContinue
if ($mp) {
    L ('kill gpu-monitor.exe pid=' + $mp.Id)
    Stop-Process -Id $mp.Id -Force
    Start-Sleep 4
} else {
    L 'gpu-monitor.exe не найден (не запущен?)'
}

Remove-Item 'A:\PROJECTS\monitoring\gpu-monitor.old.exe' -Force -ErrorAction SilentlyContinue
Move-Item 'A:\PROJECTS\monitoring\gpu-monitor.exe' 'A:\PROJECTS\monitoring\gpu-monitor.old.exe' -Force
Move-Item 'A:\PROJECTS\monitoring\gpu-monitor.new.exe' 'A:\PROJECTS\monitoring\gpu-monitor.exe' -Force
L 'exe заменён на новую сборку'

Start-Process -FilePath 'A:\PROJECTS\monitoring\gpu-monitor.exe' -WorkingDirectory 'A:\PROJECTS\monitoring'
L 'новый gpu-monitor.exe запущен'

Start-Sleep 20
try {
    $r = Invoke-WebRequest -Uri 'http://192.168.1.117:8787/api/llm/start' -Method POST -UseBasicParsing -TimeoutSec 15
    L ('LLM start: ' + $r.StatusCode)
} catch {
    L ('LLM start: ОШИБКА ' + $_.Exception.Message)
}

Start-Sleep 8
try {
    $st = (Invoke-WebRequest -Uri 'http://192.168.1.117:8787/api/llm' -UseBasicParsing -TimeoutSec 10).Content
    L ('LLM status: ' + $st)
} catch {
    L ('LLM status: ОШИБКА ' + $_.Exception.Message)
}

Remove-Item 'A:\PROJECTS\monitoring\gpu-monitor.old.exe' -Force -ErrorAction SilentlyContinue
L 'готово: старый exe удалён'
