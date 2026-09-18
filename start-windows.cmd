@echo off
setlocal
title LisanHub - start
cd /d "%~dp0"

echo.
echo === LisanHub: preparing the development environment ===
echo.

where node >nul 2>nul
if errorlevel 1 goto :no_node

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 22 goto :old_node

if exist node_modules goto :setup
echo [1/4] Installing dependencies - npm ci
call npm ci
if errorlevel 1 goto :fail

:setup
echo [2/4] Installing project skills, CI and editor settings - npm run setup
call npm run setup
if errorlevel 1 goto :fail

echo [3/4] Checking the project: lint, types and tests - npm run check
call npm run check
if errorlevel 1 goto :fail

echo [4/4] Starting the app on http://localhost:3000
start "" cmd /c "timeout /t 10 >nul & start http://localhost:3000"
call npm run dev
goto :eof

:no_node
echo Node.js is not installed.
echo Install Node.js 22 LTS or newer from https://nodejs.org then run this file again.
pause
exit /b 1

:old_node
echo Node.js 22.12 or newer is required. Current version:
node -v
echo Install the latest LTS from https://nodejs.org then run this file again.
pause
exit /b 1

:fail
echo.
echo Something failed above. Open this folder in Claude Code and ask it to fix the error.
pause
exit /b 1
