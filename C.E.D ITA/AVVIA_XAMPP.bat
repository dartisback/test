@echo off
title C.E.D ITA - Avvio XAMPP
color 0B

rem usa questo file (o il collegamento sul Desktop) al posto dell'icona di XAMPP:
rem controlla MySQL, lo ripara da solo se crasha e poi apre il pannello di XAMPP

net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0strumenti\ripara_mysql_xampp.ps1" -ApriPannello
if errorlevel 1 pause
