# GPU Monitor: PowerShell — правые 60% экрана, pi из A:\PROJECTS
$ErrorActionPreference = 'SilentlyContinue'
$env:PATH = "$env:USERPROFILE\AppData\Roaming\npm;" + $env:PATH
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
Write-Host 'GPU Monitor: PowerShell в правой части экрана (60%). Запускаю pi из A:\PROJECTS ...'
Set-Location 'A:\PROJECTS'
$sideLog = 'A:\PROJECTS\monitoring\log\side-window.log'
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

