@echo off
title C.E.D ITA - txAdmin
color 0B
if not exist "%~dp0artifacts\FXServer.exe" (
    echo.
    echo   [ERRORE] Non trovo artifacts\FXServer.exe - leggi artifacts\LEGGIMI.txt
    echo.
    pause
    exit /b 1
)
echo.
echo   Avvio txAdmin: si aprira' il browser.
echo   Nella configurazione scegli "Existing Server Data" e seleziona la cartella:
echo   %~dp0server-data
echo   e come file di configurazione: server.cfg
echo.
cd /d "%~dp0artifacts"
FXServer.exe
pause
