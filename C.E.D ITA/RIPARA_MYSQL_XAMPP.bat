@echo off
title C.E.D ITA - Ripara MySQL di XAMPP
color 0B

rem servono i permessi di amministratore (per fermare servizi e processi bloccati)
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Servono i permessi di amministratore: premi "Si" nella finestra di Windows.
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
echo.
echo   ==============================================
echo      Ripara "MySQL shutdown unexpectedly"
echo   ==============================================
echo.
echo   I tuoi database NON vengono cancellati: la cartella dei dati vecchia
echo   resta come copia di sicurezza in xampp\mysql\data_old_...
echo.
echo   PRIMA DI CONTINUARE: nel pannello XAMPP premi Stop su MySQL
echo   (se e' verde) e chiudi il pannello.
echo.
pause
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0strumenti\ripara_mysql_xampp.ps1" %*
echo.
pause
