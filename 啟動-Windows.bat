@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo 找不到 Node.js。請先安裝 Node.js LTS：https://nodejs.org/
  pause
  exit /b 1
)

set PORT=4173
set URL=http://localhost:%PORT%/

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if errorlevel 1 (
  echo 正在啟動文獻管理代理人本機版：%URL%
  start "Research Master Local Server" cmd /k "cd /d ""%~dp0"" && node server.mjs"
  timeout /t 2 /nobreak >nul
) else (
  echo 文獻管理代理人本機版已在執行：%URL%
)

start "" "%URL%"
echo 已開啟 %URL%
