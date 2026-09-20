@echo off
setlocal EnableExtensions EnableDelayedExpansion
if /I "%PNPM_RUNNER%"=="corepack" (
    call corepack pnpm@%PNPM_DESCRIPTOR% --config.trustPolicy=off --config.confirmModulesPurge=false %*
    exit /b !errorlevel!
)
if /I "%PNPM_RUNNER%"=="npx" (
    call npx --yes pnpm@%PNPM_VERSION% --config.trustPolicy=off --config.confirmModulesPurge=false %*
    exit /b !errorlevel!
)
echo [ERROR] The local pnpm shim was invoked without a pinned launcher runner. 1>&2
exit /b 1
