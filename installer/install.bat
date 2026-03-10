@echo off
setlocal enabledelayedexpansion
title Marinara Engine — Installer
color 0A

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   Marinara Engine — Windows Installer     ║
echo  ║   v1.3.0                                  ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ── Choose install location ──
set "INSTALL_DIR=%USERPROFILE%\Marinara-Engine"
set "USER_INPUT="
set /p "USER_INPUT=  Install location [%INSTALL_DIR%]: "
if not "%USER_INPUT%"=="" set "INSTALL_DIR=%USER_INPUT%"

:: ── Check prerequisites ──
echo.
echo  [..] Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Please install Node.js 20+ from https://nodejs.org
    echo  Then re-run this installer.
    echo.
    pause
    exit /b 1
)

for /f "tokens=2 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a

if not defined NODE_MAJOR (
    echo.
    echo  [ERROR] Unable to determine Node.js version from "node -v".
    echo  Please ensure Node.js is correctly installed and in PATH,
    echo  then re-run this installer.
    echo.
    pause
    exit /b 1
)

if %NODE_MAJOR% LSS 20 (
    echo.
    echo  [ERROR] Detected Node.js version is too old:
    node -v
    echo  Marinara Engine requires Node.js 20 or newer.
    echo  Please install the latest Node.js 20+ from https://nodejs.org
    echo  and then re-run this installer.
    echo.
    pause
    exit /b 1
)
echo  [OK] Node.js found: 
node -v

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Git is not installed or not in PATH.
    echo  Please install Git from https://git-scm.com/download/win
    echo  Then re-run this installer.
    echo.
    pause
    exit /b 1
)
echo  [OK] Git found

:: ── Install pnpm if needed ──
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [..] Installing pnpm...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to install pnpm. Please run: npm install -g pnpm
        pause
        exit /b 1
    )
)
echo  [OK] pnpm found

:: ── Clone repository ──
echo.
if exist "%INSTALL_DIR%\.git" (
    echo  [..] Existing installation found, updating...
    cd /d "%INSTALL_DIR%"
    git pull
) else (
    echo  [..] Cloning Marinara Engine to %INSTALL_DIR%...
    git clone https://github.com/SpicyMarinara/Marinara-Engine.git "%INSTALL_DIR%"
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to clone repository.
        pause
        exit /b 1
    )
    cd /d "%INSTALL_DIR%"
)

:: ── Install dependencies ──
echo.
echo  [..] Installing dependencies (this may take a few minutes)...
call pnpm install
if %errorlevel% neq 0 (
    echo  [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo  [OK] Dependencies installed

:: ── Build ──
echo.
echo  [..] Building Marinara Engine...
call pnpm build
if %errorlevel% neq 0 (
    echo  [ERROR] Build failed.
    pause
    exit /b 1
)
echo  [OK] Build complete

:: ── Sync database ──
echo  [..] Setting up database...
call pnpm db:push 2>nul
echo  [OK] Database ready

:: ── Create desktop shortcut ──
echo  [..] Creating desktop shortcut...
set "SHORTCUT=%USERPROFILE%\Desktop\Marinara Engine.lnk"
set "VBS=%TEMP%\create_shortcut.vbs"

(
    echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
    echo sLinkFile = "%SHORTCUT%"
    echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
    echo oLink.TargetPath = "%INSTALL_DIR%\start.bat"
    echo oLink.WorkingDirectory = "%INSTALL_DIR%"
    echo oLink.Description = "Marinara Engine — AI Chat ^& Roleplay"
    echo oLink.Save
) > "%VBS%"
cscript //nologo "%VBS%"
del "%VBS%"
echo  [OK] Desktop shortcut created

:: ── Done ──
echo.
echo  ══════════════════════════════════════════
echo    Installation complete!
echo.
echo    To start: double-click "Marinara Engine"
echo    on your Desktop, or run start.bat in:
echo    %INSTALL_DIR%
echo.
echo    The app opens in your browser at:
echo    http://localhost:7860
echo  ══════════════════════════════════════════
echo.
pause
