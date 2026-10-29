@echo off
setlocal
title C.E.D ITA - Server FiveM
color 0B
cd /d "%~dp0server-data"

if not exist "%~dp0artifacts\FXServer.exe" goto noartifacts
if not exist "%~dp0server-data\resources\[ox]\ox_inventory\fxmanifest.lua" goto noox
findstr /c:"INSERISCI_QUI_LA_TUA_KEY" server.cfg >nul && goto nokey

echo.
echo   ==============================================
echo      C.E.D ITA - Avvio server
echo   ==============================================

rem crea/controlla il database con il nome scritto in server.cfg (tabelle + job)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0strumenti\prepara_database.ps1"
if errorlevel 1 goto dberror

:start
echo.
"%~dp0artifacts\FXServer.exe" +exec server.cfg
echo.
echo   Il server si e' chiuso.
pause
exit /b 0

:dberror
echo   Il database non e' pronto: leggi il messaggio qui sopra.
echo   Premi un tasto per avviare comunque il server, oppure chiudi questa finestra.
pause >nul
goto start

:noartifacts
echo.
echo   [ERRORE] Non trovo artifacts\FXServer.exe
echo   Leggi artifacts\LEGGIMI.txt per sapere cosa scaricare.
echo.
pause
exit /b 1

:noox
echo.
echo   [ERRORE] Mancano oxmysql / ox_lib / ox_inventory.
echo   Avvia prima INSTALLA_RISORSE.bat
echo.
pause
exit /b 1

:nokey
echo.
echo   [ERRORE] Manca la license key.
echo   Apri server-data\server.cfg e sostituisci INSERISCI_QUI_LA_TUA_KEY
echo   con la key presa da https://keymaster.fivem.net
echo.
pause
exit /b 1
