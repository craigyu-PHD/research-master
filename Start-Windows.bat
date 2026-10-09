@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js LTS first: https://nodejs.org/
  pause
  exit /b 1
)

set PORT=4173
set URL=http://localhost:%PORT%/

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if errorlevel 1 (
  echo Starting Research Master local server at %URL%
  start "Research Master Local Server" cmd /k "cd /d ""%~dp0"" && node server.mjs"
  timeout /t 2 /nobreak >nul
) else (
  echo Research Master local server is already running at %URL%
)

start "" "%URL%"
echo Opened %URL%
