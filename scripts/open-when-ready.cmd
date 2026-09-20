@echo off
:: Opens the Marinara Engine URL in the default browser only once the server answers /api/health.
:: Usage: open-when-ready.cmd <url> [max-seconds]
:: The launcher used to open the browser after a fixed 4 seconds, which lands on a connection error
:: while the file store is still loading; polling readiness removes that wait and the manual reload.
setlocal
set "URL=%~1"
set "MAX_SECONDS=%~2"
if "%URL%"=="" exit /b 2
if "%MAX_SECONDS%"=="" set "MAX_SECONDS=900"
set /a "ATTEMPTS=%MAX_SECONDS%/2"
if %ATTEMPTS% LSS 1 set "ATTEMPTS=1"
where curl >nul 2>&1 || goto :no_curl
for /l %%i in (1,1,%ATTEMPTS%) do (
    curl -k -s -f -o nul --max-time 3 "%URL%/api/health" >nul 2>&1 && goto :ready
    ping -n 3 127.0.0.1 >nul
)
echo  [WARN] Marinara Engine did not answer within %MAX_SECONDS% seconds; open %URL% manually.
exit /b 1

:no_curl
:: Without curl there is no cheap readiness probe; keep the old fixed delay (ping sleeps without needing a console).
ping -n 5 127.0.0.1 >nul
goto :ready

:ready
if defined OPEN_WHEN_READY_DRY_RUN (
    echo READY %URL%
    exit /b 0
)
start "" "%URL%" || explorer "%URL%"
exit /b 0
