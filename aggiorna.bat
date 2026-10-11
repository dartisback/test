@echo off
cd /d "%~dp0"
where git >nul 2>nul || (echo Git non trovato. Installalo da https://git-scm.com e riprova. & pause & exit /b 1)
if not exist .git (
  echo Questa cartella non e' un clone di GitHub. Segui la guida nel README ^(sezione "Aggiornamenti"^).
  pause
  exit /b 1
)
echo Scarico gli ultimi aggiornamenti...
git pull origin claude/flux-bot-ita-website-eg1qbn
call npm install --no-audit --no-fund
echo.
echo Fatto. Riavvia start.bat e start-bot.bat se erano aperti.
pause
