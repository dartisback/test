@echo off
rem =====================================================================
rem  C.E.D ITA - avvio server
rem  1) scarica gli aggiornamenti (tiene key, database e tue modifiche)
rem  2) prepara il database e avvia il server
rem  Questo file resta sempre uguale: la logica e' in strumenti\avvia_server.cmd
rem  Per disattivare gli aggiornamenti crea il file NON_AGGIORNARE.txt qui.
rem =====================================================================
title C.E.D ITA - Server FiveM
color 0B
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0strumenti\aggiorna.ps1" -DaAvvio
call "%~dp0strumenti\avvia_server.cmd"
