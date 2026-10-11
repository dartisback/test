@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js non trovato. Installalo da https://nodejs.org e riprova. & pause & exit /b 1)
if not exist .env (
  echo File .env mancante: avvia prima start.bat e compila il .env.
  pause
  exit /b 1
)
call npm install --no-audit --no-fund
call node bot.js
pause
