# =====================================================================
#  C.E.D ITA - installazione risorse Overextended
#  Scarica le ultime release ufficiali di oxmysql, ox_lib e ox_inventory
#  da GitHub e applica il tema C.E.D ITA a ox_inventory.
#
#  Uso normale:  doppio clic su INSTALLA_RISORSE.bat
#  Per aggiornare risorse gia' presenti:  INSTALLA_RISORSE.bat -Aggiorna
# =====================================================================

param(
    [switch]$Aggiorna
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root      = Split-Path -Parent $PSScriptRoot
$oxDir     = Join-Path $root 'server-data\resources\[ox]'
$themeFile = Join-Path $PSScriptRoot 'tema_ox_inventory\ced-theme.css'
$backupDir = Join-Path $root 'backup'
$tempDir   = Join-Path ([IO.Path]::GetTempPath()) ('ced_ita_' + [Guid]::NewGuid().ToString('N'))

$resources = @('oxmysql', 'ox_lib', 'ox_inventory')

function Write-Step($text)  { Write-Host "  > $text" -ForegroundColor Cyan }
function Write-Ok($text)    { Write-Host "  [OK] $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "  [!]  $text" -ForegroundColor Yellow }

Write-Host ''
Write-Host '  ==============================================' -ForegroundColor Blue
Write-Host '     C.E.D ITA - Installazione risorse ox' -ForegroundColor White
Write-Host '  ==============================================' -ForegroundColor Blue
Write-Host ''

[IO.Directory]::CreateDirectory($oxDir) | Out-Null
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

try {
    foreach ($name in $resources) {
        $target = Join-Path $oxDir $name

        if ((Test-Path -LiteralPath (Join-Path $target 'fxmanifest.lua')) -and -not $Aggiorna) {
            Write-Ok "$name gia' presente (usa -Aggiorna per riscaricarlo)"
            continue
        }

        $url = "https://github.com/overextended/$name/releases/latest/download/$name.zip"
        $zip = Join-Path $tempDir "$name.zip"
        $out = Join-Path $tempDir $name

        Write-Step "Scarico $name ..."
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

        Write-Step "Estraggo $name ..."
        Expand-Archive -LiteralPath $zip -DestinationPath $out -Force

        # ogni cartella con fxmanifest.lua e' una risorsa (ox_lib ad esempio include anche cfxlua-require)
        $manifests = @(Get-ChildItem -LiteralPath $out -Filter 'fxmanifest.lua' -Recurse -Depth 1)
        if ($manifests.Count -eq 0) {
            throw "Lo zip di $name non contiene fxmanifest.lua: scaricalo a mano da https://github.com/overextended/$name/releases"
        }

        foreach ($manifest in $manifests) {
            $source  = $manifest.Directory.FullName
            $resName = if ($source.TrimEnd('\') -eq (Get-Item -LiteralPath $out).FullName.TrimEnd('\')) { $name } else { $manifest.Directory.Name }
            $dest    = Join-Path $oxDir $resName

            if (Test-Path -LiteralPath $dest) {
                # tiene una copia della versione precedente fuori da resources (utile se avevi modificato items.lua ecc.)
                [IO.Directory]::CreateDirectory($backupDir) | Out-Null
                $backup = Join-Path $backupDir ($resName + '_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
                Move-Item -LiteralPath $dest -Destination $backup
                Write-Warn2 "Vecchia versione di $resName salvata in: backup\$(Split-Path -Leaf $backup)"
            }

            # Copy invece di Move: funziona anche se la cartella e' su un disco diverso da C:
            Copy-Item -LiteralPath $source -Destination $dest -Recurse
            $gitDir = Join-Path $dest '.git'
            if (Test-Path -LiteralPath $gitDir) { Remove-Item -LiteralPath $gitDir -Recurse -Force }
            Write-Ok "$resName installato"
        }
    }

    # ---------------- tema ox_inventory ----------------
    $buildDir = Join-Path $oxDir 'ox_inventory\web\build'
    $index    = Join-Path $buildDir 'index.html'

    if (-not (Test-Path -LiteralPath $index)) {
        throw "Non trovo ox_inventory\web\build\index.html: il tema non puo' essere applicato."
    }

    Write-Step 'Applico il tema C.E.D ITA a ox_inventory ...'
    Copy-Item -LiteralPath $themeFile -Destination (Join-Path $buildDir 'assets\ced-theme.css') -Force

    $html = [IO.File]::ReadAllText($index)
    if ($html -notmatch 'ced-theme\.css') {
        $link = '<link rel="stylesheet" href="./assets/ced-theme.css">'
        if ($html -match '</head>') {
            $html = $html -replace '</head>', ("  $link`n  </head>")
        } else {
            $html = $link + $html
        }
        [IO.File]::WriteAllText($index, $html, (New-Object System.Text.UTF8Encoding $false))
    }
    Write-Ok 'Tema applicato'

    Write-Host ''
    Write-Host '  Fatto! Prossimi passi:' -ForegroundColor White
    Write-Host '   1) Avvia MySQL (es. XAMPP): il database si crea da solo all''avvio'
    Write-Host '   2) Metti gli artifacts nella cartella "artifacts"'
    Write-Host '   3) Inserisci la key in server-data\server.cfg (sv_licenseKey)'
    Write-Host '   4) Avvia con AVVIA_SERVER.bat'
    Write-Host ''
}
catch {
    Write-Host ''
    Write-Host "  [ERRORE] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '  Controlla la connessione internet e riprova.' -ForegroundColor Red
    Write-Host '  In alternativa scarica a mano gli zip dalle pagine "Releases" su GitHub' -ForegroundColor Red
    Write-Host '  ed estraili in server-data\resources\[ox]\ (vedi LEGGIMI.txt in quella cartella).' -ForegroundColor Red
    Write-Host ''
    exit 1
}
finally {
    Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
