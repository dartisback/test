@echo off
title C.E.D ITA - Creazione database
color 0B
cd /d "%~dp0"
echo.
echo   Crea il database con il nome scritto in server-data\server.cfg
echo   (tabelle ESX / ox_inventory + Disoccupato, Polizia Di Stato, Arma Dei Carabinieri)
echo   MySQL deve essere AVVIATO (es. pannello XAMPP: MySQL - Start).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0strumenti\prepara_database.ps1" %*
echo.
pause
