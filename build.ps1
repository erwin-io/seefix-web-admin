# shortcut: on this Windows box `ng` does not exit after finishing, so stop it once the bundle result is logged.
param([string]$Cmd = 'build')
$env:NG_CLI_ANALYTICS = 'false'
$log = Join-Path $env:TEMP 'seefix-ng.log'
$p = Start-Process node -ArgumentList (@('node_modules/@angular/cli/bin/ng.js') + $Cmd.Split(' ')) -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
$t = 0
while (-not $p.HasExited -and $t -lt 600) {
  Start-Sleep 2; $t += 2
  $text = (Get-Content $log, "$log.err" -Raw -ErrorAction SilentlyContinue) -join ''
  $done = if ($Cmd -like 'test*') { 'Test Files|bundle generation failed' } else { 'Application bundle generation (complete|failed)|All files pass linting|Lint errors found' }
  if ($text -match $done) { Start-Sleep 3; break }
}
if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
Get-Content $log, "$log.err" -ErrorAction SilentlyContinue
