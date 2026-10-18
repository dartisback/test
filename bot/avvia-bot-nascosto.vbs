' Avvia il bot IN BACKGROUND (nessuna finestra). Resta online finche' non lo ferma "ferma-bot.bat".
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir

' ferma eventuali copie gia' attive (evita due bot insieme)
sh.Run """" & dir & "\ferma-bot.bat""", 0, True

' avvia il bot nascosto (0 = finestra nascosta)
sh.Run """" & dir & "\avvia-bot.bat""", 0, False
