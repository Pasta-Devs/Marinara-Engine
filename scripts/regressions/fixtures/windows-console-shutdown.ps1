param([string]$Root, [string]$Loader, [string]$DataDir, [int]$Port)
$ErrorActionPreference = 'Stop'
$progressFile = Join-Path $DataDir 'progress.log'
function Write-Phase([string]$Message) {
  Add-Content -Path $progressFile -Value ("{0:o} {1}" -f [DateTime]::UtcNow, $Message)
}
Write-Phase 'Compiling native console bindings'
# Isolate the native console event from the CI runner's own console.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ConsoleSignals {
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool FreeConsole();
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool AllocConsole();
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetConsoleCtrlHandler(IntPtr handler, bool add);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool GenerateConsoleCtrlEvent(uint signal, uint group);
}
'@
Write-Phase 'Allocating isolated console'
[ConsoleSignals]::FreeConsole() | Out-Null
if (-not [ConsoleSignals]::AllocConsole()) { throw 'Cannot allocate the test console' }
Write-Phase 'Console allocated'
$env:HOST = '127.0.0.1'
$env:PORT = [string]$Port
$env:DATA_DIR = $DataDir
$env:FILE_STORAGE_DIR = Join-Path $DataDir 'storage'
$env:NODE_ENV = 'production'
$env:MARINARA_LITE = 'true'
$env:LOG_LEVEL = 'info'
$env:LOG_DISABLE_REQUEST_LOGGING = 'false'
$env:AUTO_CREATE_DEFAULT_CONNECTION = 'false'
$env:AUTO_OPEN_BROWSER = 'false'
$outputFile = Join-Path $DataDir 'stdout.log'
$errorFile = Join-Path $DataDir 'stderr.log'
$nodeArgs = @((Join-Path $Root 'scripts/run-server.mjs'), '--import', $Loader, (Join-Path $Root 'packages/server/src/index.ts'))
$arguments = ($nodeArgs | ForEach-Object { '"' + $_ + '"' }) -join ' '
$server = $null
$socket = $null
try {
  Write-Phase 'Starting supervised production server'
  $server = Start-Process -FilePath (Get-Command node).Source -ArgumentList $arguments -NoNewWindow -PassThru -RedirectStandardOutput $outputFile -RedirectStandardError $errorFile
  Write-Phase "Supervisor started: $($server.Id)"
  # Set after spawn: keep this harness alive without passing an ignored Ctrl+C to the server.
  if (-not [ConsoleSignals]::SetConsoleCtrlHandler([IntPtr]::Zero, $true)) { throw 'Cannot protect the harness' }
  $deadline = [DateTime]::UtcNow.AddSeconds(25)
  do {
    Start-Sleep -Milliseconds 100
    $output = Get-Content $outputFile -Raw -ErrorAction SilentlyContinue
    if ($server.HasExited) { throw "Server exited before readiness: $output" }
  } until ($output -match 'Marinara Engine server listening' -or [DateTime]::UtcNow -gt $deadline)
  if ($output -notmatch 'Marinara Engine server listening') { throw "Server readiness timed out: $output" }
  Write-Phase 'Production server ready'
  # Keep app.close pending, making the premature hard-kill reliably observable.
  $socket = [Net.Sockets.TcpClient]::new('127.0.0.1', $Port)
  $request = [Text.Encoding]::ASCII.GetBytes("POST /api/chats HTTP/1.1`r`nHost: localhost`r`nContent-Type: application/json`r`nContent-Length: 10000`r`n`r`n{")
  $socket.GetStream().Write($request, 0, $request.Length)
  Start-Sleep -Milliseconds 200
  Write-Phase 'Sending native Ctrl+C'
  if (-not [ConsoleSignals]::GenerateConsoleCtrlEvent(0, 0)) { throw 'Native Ctrl+C delivery failed' }
  if (-not $server.WaitForExit(15000)) { throw 'Supervisor did not exit after Ctrl+C' }
  Write-Phase 'Supervisor exited after Ctrl+C'
  $output = Get-Content $outputFile -Raw
  if ($output -notmatch 'Received SIGINT; shutting down') { throw "No SIGINT reached production shutdown: $output" }
  if ($output -notmatch 'Shutdown complete') { throw "Graceful shutdown was interrupted: $output" }
  if ($output -match 'forcing exit now') { throw "Shutdown exceeded its deadline: $output" }
  $ready = ($output -split "`n" | Where-Object { $_ -match 'Marinara Engine server listening' } | Select-Object -First 1) | ConvertFrom-Json
  if (Get-Process -Id $ready.pid -ErrorAction SilentlyContinue) { throw 'Server survived its supervisor' }
  Write-Output 'Native Windows console Ctrl+C reached the server and completed graceful shutdown.'
} catch {
  Write-Phase ("Failure: " + $_.Exception.ToString())
  throw
} finally {
  Write-Phase 'Cleaning up fixture'
  if ($socket) { $socket.Dispose() }
  if ($server -and -not $server.HasExited) { & taskkill /PID $server.Id /T /F | Out-Null }
  if (Test-Path $errorFile) { Get-Content $errorFile | Write-Output }
  [ConsoleSignals]::FreeConsole() | Out-Null
  Write-Phase 'Fixture cleanup complete'
}
