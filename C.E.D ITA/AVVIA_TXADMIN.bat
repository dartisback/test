@echo off
title C.E.D ITA - txAdmin
color 0B
if not exist "%~dp0artifacts\FXServer.exe" goto noartifacts

rem crea/controlla il database con il nome scritto in server.cfg (tabelle + job)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0strumenti\prepara_database.ps1"

echo.
echo   Avvio txAdmin: si aprira' il browser.
echo   Nella configurazione scegli "Existing Server Data" e seleziona la cartella:
echo   %~dp0server-data
echo   e come file di configurazione: server.cfg
echo.
cd /d "%~dp0artifacts"
FXServer.exe
pause
exit /b 0

:noartifacts
echo.
echo   [ERRORE] Non trovo artifacts\FXServer.exe - leggi artifacts\LEGGIMI.txt
echo.
pause
exit /b 1
