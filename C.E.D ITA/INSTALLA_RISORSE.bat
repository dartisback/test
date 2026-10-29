@echo off
title C.E.D ITA - Installazione risorse
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0strumenti\installa_risorse.ps1" %*
echo.
pause
