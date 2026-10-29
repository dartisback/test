# =====================================================================
#  C.E.D ITA - riparazione MySQL di XAMPP
#  ("Error: MySQL shutdown unexpectedly")
#
#  Cosa fa, senza perdere i tuoi database:
#   1. chiude eventuali mysqld rimasti appesi e controlla la porta 3306
#   2. prova ad avviare MySQL: se parte, non serve riparare nulla
#   3. altrimenti: rinomina mysql\data in mysql\data_old_<data>,
#      ricrea mysql\data dalla copia pulita di XAMPP (mysql\backup)
#      e ci rimette dentro i TUOI database + ibdata1
#   4. riprova ad avviare MySQL per verificare
#
#  La cartella data_old_<data> NON viene mai cancellata: e' la tua copia
#  di sicurezza. Quando tutto funziona puoi eliminarla tu.
# =====================================================================

param(
    [string]$Xampp,
    [switch]$Si
)

$ErrorActionPreference = 'Stop'
$onWindows = $env:OS -eq 'Windows_NT'

function Write-Ok($text)    { Write-Host "  [OK] $text" -ForegroundColor Green }
function Write-Step($text)  { Write-Host "  > $text" -ForegroundColor Cyan }
function Write-Warn2($text) { Write-Host "  [!]  $text" -ForegroundColor Yellow }

function Ask($question) {
    if ($Si) { return $true }
    $answer = Read-Host "  $question [S/N]"
    return $answer -match '^(s|si|y|yes)$'
}

function Find-Xampp {
    if ($Xampp) {
        if (Test-Path -LiteralPath (Join-Path $Xampp 'mysql\bin\mysqld.exe')) { return (Resolve-Path -LiteralPath $Xampp).Path }
        throw "In '$Xampp' non c'e' mysql\bin\mysqld.exe"
    }
    foreach ($drive in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) {
        $candidate = Join-Path $drive.Root 'xampp'
        if (Test-Path -LiteralPath (Join-Path $candidate 'mysql\bin\mysqld.exe')) { return $candidate }
    }
    if (-not $Si) {
        $typed = (Read-Host '  Non trovo XAMPP. Scrivi il percorso della cartella xampp (es. D:\Programmi\xampp)').Trim('"', ' ')
        if ($typed -and (Test-Path -LiteralPath (Join-Path $typed 'mysql\bin\mysqld.exe'))) { return $typed }
    }
    return $null
}

function Get-IniPort($ini) {
    $section = ''
    foreach ($line in (Get-Content -LiteralPath $ini)) {
        if ($line -match '^\s*\[(.+)\]') { $section = $Matches[1].Trim(); continue }
        if ($section -eq 'mysqld' -and $line -match '^\s*port\s*=\s*(\d+)') { return [int]$Matches[1] }
    }
    return 3306
}

function Show-ErrorLog($dataDir) {
    $log = Join-Path $dataDir 'mysql_error.log'
    if (Test-Path -LiteralPath $log) {
        Write-Host '  ---- ultime righe di mysql_error.log ----' -ForegroundColor DarkGray
        Get-Content -LiteralPath $log -Tail 12 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Write-Host '  -----------------------------------------' -ForegroundColor DarkGray
    }
}

function Get-XamppMysqld {
    @(Get-Process -Name mysqld -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -and $_.Path -like "$bin*"
    })
}

# avvia MySQL come fa XAMPP, controlla che risponda e poi lo spegne in modo pulito
function Test-MySqlStart {
    $arguments = "--defaults-file=`"$ini`""
    if ($onWindows) { $arguments += ' --standalone' }

    $startArgs = @{ FilePath = $mysqld; ArgumentList = $arguments; PassThru = $true }
    if ($onWindows) { $startArgs.WindowStyle = 'Hidden' } else { $startArgs.NoNewWindow = $true }
    $process = Start-Process @startArgs

    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if ($process.HasExited) { break }
        # ping restituisce 0 se il server e' acceso (anche con password diversa)
        & $mysqladmin --protocol=TCP --host=127.0.0.1 "--port=$port" --user=root --connect-timeout=2 ping 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    }

    if (-not $process.HasExited) {
        & $mysqladmin --protocol=TCP --host=127.0.0.1 "--port=$port" --user=root shutdown 2>$null | Out-Null
        if (-not $process.WaitForExit(20000)) {
            Write-Warn2 'Lo spegnimento pulito non ha risposto (password di root?): chiudo il processo.'
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }

    return $ok
}

try {
    Write-Host ''
    Write-Host '  ==============================================' -ForegroundColor Blue
    Write-Host '     C.E.D ITA - Riparazione MySQL di XAMPP' -ForegroundColor White
    Write-Host '  ==============================================' -ForegroundColor Blue
    Write-Host ''

    $root = Find-Xampp
    if (-not $root) {
        throw 'XAMPP non trovato. Controlla il percorso e riprova.'
    }

    $mysqlDir   = Join-Path $root 'mysql'
    $bin        = Join-Path $mysqlDir 'bin'
    $dataDir    = Join-Path $mysqlDir 'data'
    $cleanDir   = Join-Path $mysqlDir 'backup'
    $ini        = Join-Path $bin 'my.ini'
    $mysqld     = Join-Path $bin 'mysqld.exe'
    $mysqladmin = Join-Path $bin 'mysqladmin.exe'
    $port       = Get-IniPort $ini

    Write-Step "XAMPP: $root  (porta MySQL $port)"
    Show-ErrorLog $dataDir

    # ---------------- 1) mysqld rimasti appesi ----------------
    $running = Get-XamppMysqld
    if ($running.Count -gt 0) {
        Write-Warn2 "MySQL di XAMPP risulta ancora aperto (PID $($running.Id -join ', '))."
        Write-Host '       Se nel pannello XAMPP e'' verde, premi Stop e chiudi il pannello prima di continuare.'
        if (-not (Ask 'Lo chiudo io adesso?')) { throw 'Operazione annullata.' }
        $running | Stop-Process -Force
        Start-Sleep -Seconds 2
    }

    # ---------------- 2) porta occupata da altro ----------------
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $owners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique)

        foreach ($ownerId in $owners) {
            $owner = Get-Process -Id $ownerId -ErrorAction SilentlyContinue
            $name = if ($owner) { $owner.ProcessName } else { "PID $ownerId" }
            Write-Warn2 "La porta $port e' gia' usata da: $name (PID $ownerId). Con la porta occupata MySQL di XAMPP crasha."

            $service = Get-CimInstance Win32_Service -Filter "ProcessId = $ownerId" -ErrorAction SilentlyContinue
            if ($service) {
                if (Ask "E' il servizio Windows '$($service.Name)'. Lo fermo e lo metto su avvio Manuale?") {
                    Stop-Service -Name $service.Name -Force
                    Set-Service -Name $service.Name -StartupType Manual
                    Write-Ok "Servizio $($service.Name) fermato"
                }
            }
            elseif (Ask "Chiudo il programma $name?") {
                Stop-Process -Id $ownerId -Force
                Write-Ok "$name chiuso"
            }
        }

        Start-Sleep -Seconds 1
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
            throw "La porta $port e' ancora occupata: chiudi il programma che la usa e riprova."
        }
    }

    # ---------------- 3) MySQL parte gia'? ----------------
    Write-Step 'Provo ad avviare MySQL cosi'' com''e'' ...'
    if (Test-MySqlStart) {
        Write-Ok 'MySQL si avvia correttamente: i dati non hanno bisogno di riparazione.'
        Write-Host ''
        Write-Host '  Ora apri il pannello XAMPP e premi Start su MySQL.' -ForegroundColor White
        Write-Host ''
        exit 0
    }
    Write-Warn2 'MySQL non parte: riparo i file dei dati.'

    # ---------------- 4) riparazione ----------------
    if (-not (Test-Path -LiteralPath $cleanDir)) {
        throw "Manca la copia pulita di XAMPP ($cleanDir): in questo caso serve reinstallare XAMPP."
    }

    $oldName = 'data_old_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
    $oldDir  = Join-Path $mysqlDir $oldName

    Write-Step "Copia di sicurezza: mysql\data -> mysql\$oldName"
    try {
        Rename-Item -LiteralPath $dataDir -NewName $oldName
    }
    catch {
        throw ("Windows non mi lascia rinominare mysql\data (qualcosa la sta usando). Chiudi il pannello XAMPP, " +
               "le finestre di Esplora risorse aperte su quella cartella e riprova. Dettaglio: $($_.Exception.Message)")
    }

    Write-Step 'Ricreo mysql\data dalla copia pulita di XAMPP'
    Copy-Item -LiteralPath $cleanDir -Destination $dataDir -Recurse

    $systemDbs = @('mysql', 'performance_schema', 'phpmyadmin', 'test', 'sys')
    $userDbs = @(Get-ChildItem -LiteralPath $oldDir -Directory | Where-Object { $systemDbs -notcontains $_.Name })

    foreach ($db in $userDbs) {
        $dest = Join-Path $dataDir $db.Name
        if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
        Copy-Item -LiteralPath $db.FullName -Destination $dest -Recurse
        Write-Ok "Database recuperato: $($db.Name)"
    }

    # ibdata1 + i suoi file di log InnoDB vanno copiati INSIEME (servono alle tabelle InnoDB, come quelle di ESX)
    $innodbFiles = @(Get-ChildItem -LiteralPath $oldDir -File | Where-Object { $_.Name -match '^(ibdata\d+|ib_logfile\d+|undo\d+)$' })
    if ($innodbFiles.Count -gt 0) {
        Get-ChildItem -LiteralPath $dataDir -File | Where-Object { $_.Name -match '^(ib_logfile\d+|undo\d+)$' } | Remove-Item -Force
        foreach ($file in $innodbFiles) {
            Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $dataDir $file.Name) -Force
        }
        Write-Ok "File InnoDB recuperati: $(($innodbFiles | ForEach-Object Name) -join ', ')"
    }

    # ---------------- 5) verifica ----------------
    Write-Step 'Verifico che MySQL ora si avvii ...'
    if (Test-MySqlStart) {
        Write-Host ''
        Write-Ok 'MySQL RIPARATO e funzionante.'
        Write-Host "       I vecchi file sono in mysql\$oldName (cancellali quando sei sicuro che e' tutto a posto)."
        Write-Host '       Nota: utenti e password di MySQL tornano quelli di default (root senza password).'
        Write-Host ''
        Write-Host '  Ora apri il pannello XAMPP e premi Start su MySQL.' -ForegroundColor White
        Write-Host '  CONSIGLIO: prima di spegnere il PC premi sempre Stop su MySQL,' -ForegroundColor White
        Write-Host '  cosi'' i file non si rovinano piu''.' -ForegroundColor White
        Write-Host ''
        exit 0
    }

    Show-ErrorLog $dataDir
    throw "MySQL ancora non parte. I tuoi dati originali sono intatti in mysql\$oldName. Manda le righe di log qui sopra per capire il problema."
}
catch {
    Write-Host ''
    Write-Host "  [ERRORE] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ''
    exit 1
}
