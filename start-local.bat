@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Marinara Engine (Local Build)
color 0A
echo.
echo  +==========================================+
echo  ^| Marinara Engine - Local Build Launcher   ^|
echo  +==========================================+
echo.

:: This launcher intentionally does not run git or install dependencies.
:: It rebuilds the current local checkout before launch.

where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Please install Node.js 24 LTS or newer from https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node -v') do set "NODE_RAW=%%a"
set "NODE_MAJOR=!NODE_RAW:v=!"
if not defined NODE_MAJOR (
    echo  [ERROR] Could not determine Node.js version.
    pause
    exit /b 1
)
if !NODE_MAJOR! LSS 24 (
    echo  [ERROR] Node.js 24 LTS or newer is required. You have v!NODE_MAJOR!.
    echo  Please update Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

set "PNPM_DESCRIPTOR="
for /f "usebackq delims=" %%i in (`node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).packageManager?.replace(/^^pnpm@/, '') || ''"`) do set "PNPM_DESCRIPTOR=%%i"
if not defined PNPM_DESCRIPTOR (
    echo  [ERROR] Could not read the pinned pnpm descriptor from package.json.
    pause
    exit /b 1
)
set "PNPM_VERSION="
for /f "tokens=1 delims=+" %%i in ("!PNPM_DESCRIPTOR!") do set "PNPM_VERSION=%%i"
if not defined PNPM_VERSION (
    echo  [ERROR] The pinned pnpm descriptor in package.json has no version.
    pause
    exit /b 1
)
set "PNPM_RUNNER=pnpm"
set "CURRENT_PNPM_VERSION="

where corepack >nul 2>&1
if not errorlevel 1 (
    echo  [..] Aligning pnpm to %PNPM_VERSION% via Corepack...
    for /f "usebackq delims=" %%i in (`corepack pnpm@%PNPM_DESCRIPTOR% --version 2^>nul`) do set "CURRENT_PNPM_VERSION=%%i"
    if /I "!CURRENT_PNPM_VERSION!"=="%PNPM_VERSION%" (
        set "PNPM_RUNNER=corepack"
    ) else (
        set "CURRENT_PNPM_VERSION="
    )
)

if not defined CURRENT_PNPM_VERSION (
    where pnpm.cmd >nul 2>&1
    if not errorlevel 1 (
        for /f "usebackq delims=" %%i in (`pnpm.cmd --version 2^>nul`) do set "CURRENT_PNPM_VERSION=%%i"
        if /I "!CURRENT_PNPM_VERSION!"=="%PNPM_VERSION%" (
            echo  [..] Using installed pnpm !CURRENT_PNPM_VERSION!
        ) else (
            if defined CURRENT_PNPM_VERSION echo  [..] Installed pnpm !CURRENT_PNPM_VERSION! does not match required %PNPM_VERSION%; trying a pinned temporary runner...
            set "CURRENT_PNPM_VERSION="
        )
    )
)

if not defined CURRENT_PNPM_VERSION (
    echo  [..] Using temporary pnpm %PNPM_VERSION% via npx...
    for /f "usebackq delims=" %%i in (`npx --yes pnpm@%PNPM_VERSION% --version 2^>nul`) do set "CURRENT_PNPM_VERSION=%%i"
    if /I "!CURRENT_PNPM_VERSION!"=="%PNPM_VERSION%" (
        set "PNPM_RUNNER=npx"
    ) else (
        set "CURRENT_PNPM_VERSION="
    )
)

if not defined CURRENT_PNPM_VERSION (
    echo  [ERROR] Failed to make pnpm %PNPM_VERSION% available.
    echo          Node.js must provide Corepack or npx/npm.
    echo          Reinstall Node.js 24 LTS with npm enabled, or run: npm install -g pnpm@%PNPM_VERSION%
    pause
    exit /b 1
)

echo  [OK] Node.js found:
node -v
echo  [OK] pnpm !CURRENT_PNPM_VERSION! ready
echo.
echo  [..] Rebuilding local checkout...
call :run_pnpm build
if errorlevel 1 (
    echo.
    echo  [ERROR] Local build failed. Fix the build error above, then run this launcher again.
    echo.
    pause
    exit /b 1
)
echo  [OK] Local build completed
echo.

if not exist "packages\shared\dist\constants\defaults.js" (
    echo  [ERROR] Shared build output is missing.
    echo          Run: pnpm.cmd build
    echo.
    pause
    exit /b 1
)

if not exist "packages\server\dist\index.js" (
    echo  [ERROR] Server build output is missing.
    echo          Run: pnpm.cmd build
    echo.
    pause
    exit /b 1
)

if not exist "packages\client\dist\index.html" (
    echo  [ERROR] Client build output is missing.
    echo          Run: pnpm.cmd build
    echo.
    pause
    exit /b 1
)

:: Load .env if present (respects values already set by the caller)
if not exist .env goto :skip_env
for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" if not "%%B"=="" if not defined %%A set "%%A=%%~B"
)

:skip_env
set NODE_ENV=production
if not defined PORT set PORT=7860
if not defined HOST set HOST=127.0.0.1
if not defined SIDECAR_RUNTIME_INSTALL_ENABLED set SIDECAR_RUNTIME_INSTALL_ENABLED=true

set PROTOCOL=http
if defined SSL_CERT if defined SSL_KEY set PROTOCOL=https
set "BROWSER_HOST=%HOST%"
if "%BROWSER_HOST%"=="" set "BROWSER_HOST=127.0.0.1"
if "%BROWSER_HOST%"=="0.0.0.0" set "BROWSER_HOST=127.0.0.1"
if "%BROWSER_HOST%"=="::" set "BROWSER_HOST=127.0.0.1"

set "AUTO_OPEN_BROWSER_ENABLED=1"
if defined AUTO_OPEN_BROWSER (
    if /I "%AUTO_OPEN_BROWSER%"=="0" set "AUTO_OPEN_BROWSER_ENABLED="
    if /I "%AUTO_OPEN_BROWSER%"=="false" set "AUTO_OPEN_BROWSER_ENABLED="
    if /I "%AUTO_OPEN_BROWSER%"=="no" set "AUTO_OPEN_BROWSER_ENABLED="
    if /I "%AUTO_OPEN_BROWSER%"=="off" set "AUTO_OPEN_BROWSER_ENABLED="
)

node scripts\check-port-available.mjs
if errorlevel 1 (
    pause
    goto :eof
)

echo.
echo  ==========================================
echo    Starting local build on %PROTOCOL%://%HOST%:%PORT%
if not "%BROWSER_HOST%"=="%HOST%" echo    Local browser URL: %PROTOCOL%://%BROWSER_HOST%:%PORT%
echo    Press Ctrl+C to stop
echo  ==========================================
echo.

if defined AUTO_OPEN_BROWSER_ENABLED (
    start "" cmd /c "timeout /t 4 /nobreak >nul && start %PROTOCOL%://%BROWSER_HOST%:%PORT% || explorer %PROTOCOL%://%BROWSER_HOST%:%PORT%"
) else (
    echo  [OK] Auto-open disabled ^(AUTO_OPEN_BROWSER=%AUTO_OPEN_BROWSER%^)
)

cd packages\server
node dist/index.js
if errorlevel 1 (
    echo.
    echo  [ERROR] Server exited unexpectedly. See the error above.
    echo.
    pause
)
goto :eof

:run_pnpm
if /I "%PNPM_RUNNER%"=="corepack" (
    call corepack pnpm@%PNPM_DESCRIPTOR% --config.trustPolicy=off --config.confirmModulesPurge=false %*
) else (
    if /I "%PNPM_RUNNER%"=="npx" (
        call npx --yes pnpm@%PNPM_VERSION% --config.trustPolicy=off --config.confirmModulesPurge=false %*
    ) else (
        call pnpm.cmd --config.trustPolicy=off --config.confirmModulesPurge=false %*
    )
)
exit /b %errorlevel%
