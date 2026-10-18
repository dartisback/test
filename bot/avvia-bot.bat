@echo off
cd /d "%~dp0"
title Bot Assistenza - Next Rome RP

if not exist .env (
  echo Manca il file .env! Copia .env.example in .env e inserisci il token.
  pause
  exit /b 1
)

echo Controllo/aggiorno le dipendenze...
call npm install --no-audit --no-fund

:loop
node index.js
echo Il bot si e' fermato, riavvio tra 5 secondi...
timeout /t 5 /nobreak >nul
goto loop
