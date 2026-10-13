@echo off
chcp 65001 >nul
setlocal
title Crea server.cfg da link FiveM

rem === Scegli: ensure oppure start ===
set "CMD=ensure"

set "SELF=%~f0"
set "OUTDIR=%~dp0"
set "LINK=%~1"

:ask
if not defined LINK set /p "LINK=Link del server (es. cfx.re/join/ylk9qk) - invio vuoto per uscire: "
if not defined LINK goto :eof
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=Get-Content -Raw -LiteralPath $env:SELF; iex $t.Substring($t.IndexOf('::POWERSHELL'+'_BELOW')+20)"
set "LINK="
echo.
goto ask

::POWERSHELL_BELOW
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# --- codice dal link (cfx.re/join/CODICE) ---
$link = $env:LINK.Trim()
if ($link -match '([A-Za-z0-9]+)/*$') { $code = $Matches[1].ToLower() }
else { Write-Host 'Link non valido.' -ForegroundColor Red; return }

# --- dati pubblici del server ---
try {
    $r = Invoke-RestMethod -Uri "https://servers-frontend.fivem.net/api/servers/single/$code" -UserAgent 'Mozilla/5.0' -TimeoutSec 20
} catch {
    Write-Host "Server non trovato o offline (codice: $code)." -ForegroundColor Red
    return
}
$d = $r.Data
if (-not $d) { Write-Host 'Risposta vuota dal server.' -ForegroundColor Red; return }
$v = $d.vars

$cmd = if ($env:CMD -eq 'start') { 'start' } else { 'ensure' }
$host_name = ([string]$d.hostname) -replace '"', "'" -replace "[`r`n]", ' '

$o = New-Object System.Collections.Generic.List[string]
$o.Add('endpoint_add_tcp "0.0.0.0:30120"')
$o.Add('endpoint_add_udp "0.0.0.0:30120"')
$o.Add('')
$o.Add('# sv_licenseKey "INSERISCI_LA_TUA_KEY"')
$o.Add('')
$o.Add('sv_hostname "' + $host_name + '"')
$max = $d.sv_maxclients; if (-not $max) { $max = $v.sv_maxClients }
if ($max) { $o.Add("sv_maxclients $max") }
if ($v.onesync_enabled -eq 'true') { $o.Add('set onesync on') }
$o.Add('')
$skip = '_cfx_internal', 'monitor', 'webadmin'
foreach ($res in ($d.resources | Sort-Object)) {
    if ($skip -notcontains $res) { $o.Add("$cmd $res") }
}

# --- salvataggio in <cartella dello script>\<codice>\server.cfg ---
$dir = Join-Path $env:OUTDIR $code
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file = Join-Path $dir 'server.cfg'
[IO.File]::WriteAllText($file, ($o -join "`r`n") + "`r`n", (New-Object Text.UTF8Encoding($false)))
Write-Host "Creato: $file" -ForegroundColor Green
Write-Host "Hostname: $host_name"
Write-Host ("Risorse ($cmd): " + @($d.resources).Count)
