# Одноразовый перезапуск gpu-monitor.exe (после правок gpu-monitor.js).
# Запускается оторвано от сессии: ждёт, убивает старый монитор (pid 11468),
# стартует новый и убирает переименованный старый exe.
Start-Sleep 15
Stop-Process -Id 11468 -Force -ErrorAction SilentlyContinue
Start-Sleep 3
Start-Process -FilePath 'A:\PROJECTS\monitoring\gpu-monitor.exe' -WorkingDirectory 'A:\PROJECTS\monitoring'
Start-Sleep 8
Remove-Item 'A:\PROJECTS\monitoring\gpu-monitor.old.exe' -Force -ErrorAction SilentlyContinue
