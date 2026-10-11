@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js non trovato. Installalo da https://nodejs.org e riprova. & pause & exit /b 1)
if not exist .env (
  copy .env.example .env >nul
  echo Ho creato il file .env: compila CLIENT_SECRET e BOT_TOKEN, salva e chiudi il Blocco note.
  notepad .env
)
call npm install --no-audit --no-fund
start "" http://localhost:3000
call npm start
pause
