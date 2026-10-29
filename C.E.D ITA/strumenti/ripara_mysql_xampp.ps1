# =====================================================================
#  C.E.D ITA - riparazione MySQL di XAMPP
#  ("Error: MySQL shutdown unexpectedly")
#
#  Fa da solo, in ordine, finche' MySQL non riparte:
#   0. chiude mysqld appesi, ferma il servizio mysql, controlla la porta
#   1. prova ad avviare MySQL: se parte, non tocca niente
#   2. LIVELLO 1: ricrea i file di sistema dalla copia pulita di XAMPP
#      (mysql\backup) e ci rimette i tuoi database + file InnoDB
#   3. LIVELLO 2: MySQL "come appena scaricato" (come reinstallare XAMPP):
#      prima salva i tuoi database in .sql aprendo i vecchi dati in
#      modalita' recupero, poi rimette i dati di fabbrica e li reimporta
#
#  La cartella originale mysql\data_old_<data> NON viene mai cancellata.
# =====================================================================

param(
    [string]$Xampp,
    [switch]$Si,
    [switch]$ApriPannello    # usato da AVVIA_XAMPP.bat: controlla/ripara e poi apre il pannello
)

$ErrorActionPreference = 'Stop'
$onWindows = $env:OS -eq 'Windows_NT'
$systemDbs = @('mysql', 'performance_schema', 'phpmyadmin', 'test', 'sys', 'information_schema')

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

function Show-ErrorLog($dir) {
    $log = Join-Path $dir 'mysql_error.log'
    if (Test-Path -LiteralPath $log) {
        Write-Host '  ---- ultime righe di mysql_error.log ----' -ForegroundColor DarkGray
        Get-Content -LiteralPath $log -Tail 12 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        Write-Host '  -----------------------------------------' -ForegroundColor DarkGray
    }
}

function Get-MySqlService {
    if (-not (Get-Command Get-Service -ErrorAction SilentlyContinue)) { return $null }
    return Get-Service -Name 'mysql' -ErrorAction SilentlyContinue
}

# Esegue mysql.exe / mysqladmin.exe / mysqldump.exe ignorando i loro messaggi su stderr:
# in Windows PowerShell 5.1 con ErrorActionPreference=Stop fermerebbero lo script.
# Il risultato si legge da $LASTEXITCODE.
function Invoke-Native([string]$exe, [string[]]$arguments) {
    $ErrorActionPreference = 'Continue'
    & $exe @arguments 2>$null
}

# ---------------------------------------------------------------------
#  avvio / attesa / spegnimento pulito di mysqld (come fa XAMPP)
# ---------------------------------------------------------------------
function Start-Mysqld([string[]]$extra = @()) {
    $arguments = @("--defaults-file=`"$ini`"") + $extra
    if ($onWindows) { $arguments += '--standalone' }

    $startArgs = @{ FilePath = $mysqld; ArgumentList = ($arguments -join ' '); PassThru = $true }
    if ($onWindows) { $startArgs.WindowStyle = 'Hidden' } else { $startArgs.NoNewWindow = $true }
    return Start-Process @startArgs
}

function Wait-Mysqld($process, [int]$p) {
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 1
        if ($process.HasExited) { return $false }
        # ping restituisce 0 se il server e' acceso (anche se la password e' diversa)
        Invoke-Native $mysqladmin @('--protocol=TCP', '--host=127.0.0.1', "--port=$p", '--user=root', '--connect-timeout=2', 'ping') | Out-Null
        if ($LASTEXITCODE -eq 0) { return $true }
    }
    return $false
}

function Stop-Mysqld($process, [int]$p) {
    if ($process.HasExited) { return }
    Invoke-Native $mysqladmin @('--protocol=TCP', '--host=127.0.0.1', "--port=$p", '--user=root', 'shutdown') | Out-Null
    if (-not $process.WaitForExit(30000)) {
        Write-Warn2 'Lo spegnimento pulito non ha risposto: chiudo il processo.'
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
}

function Test-MySqlStart {
    $process = Start-Mysqld
    $ok = Wait-Mysqld $process $port
    Stop-Mysqld $process $port
    return $ok
}

# ---------------------------------------------------------------------
#  salvataggio database in .sql aprendo i dati in modalita' recupero
# ---------------------------------------------------------------------
# $best: nome database -> @{ File; Got (tabelle esportate); Expected (tabelle presenti) }
# Tiene sempre il salvataggio piu' completo; restituisce $true quando tutto e' salvato.
function Save-Databases([string]$sourceDir, [string]$dumpDir, [hashtable]$best) {
    foreach ($level in 0..6) {
        Write-Step "Apro i vecchi dati in modalita' recupero (livello $level di 6) ..."
        $extra = @("--datadir=`"$sourceDir`"", "--port=$rescuePort", '--skip-grant-tables', "--innodb-force-recovery=$level")
        $process = Start-Mysqld $extra

        if (-not (Wait-Mysqld $process $rescuePort)) {
            Stop-Mysqld $process $rescuePort
            continue
        }

        $cli = @('--protocol=TCP', '--host=127.0.0.1', "--port=$rescuePort", '--user=root', '--batch', '--skip-column-names')
        $names = @(Invoke-Native $mysqlcli ($cli + @('-e', 'SHOW DATABASES')) | Where-Object { $_ -and ($systemDbs -notcontains $_) })

        [IO.Directory]::CreateDirectory($dumpDir) | Out-Null
        $complete = $true
        foreach ($db in $names) {
            $safe = $db.Replace("'", "''")
            $count = "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$safe' AND TABLE_TYPE = 'BASE TABLE'"
            $expected = [int](Invoke-Native $mysqlcli ($cli + @('-e', $count)) | Select-Object -First 1)

            # niente LOCK TABLES: con dati danneggiati lascerebbero il file .sql non importabile
            $tmp = Join-Path $dumpDir "$db.tmp"
            Invoke-Native $mysqldump @('--protocol=TCP', '--host=127.0.0.1', "--port=$rescuePort", '--user=root',
                '--force', '--skip-add-locks', '--skip-lock-tables', '--routines', '--triggers',
                '--default-character-set=utf8mb4', "--log-error=$tmp.errori.txt", "--result-file=$tmp", '--databases', $db) | Out-Null

            $got = -1
            if ((Test-Path -LiteralPath $tmp) -and (Select-String -LiteralPath $tmp -Pattern 'CREATE DATABASE' -Quiet)) {
                $got = @(Select-String -LiteralPath $tmp -Pattern '^CREATE TABLE').Count
            }

            $previous = $best[$db]
            if ($got -ge 0 -and (-not $previous -or $got -gt $previous.Got)) {
                $file = Join-Path $dumpDir "$db.sql"
                Move-Item -LiteralPath $tmp -Destination $file -Force
                $errors = Join-Path $dumpDir "$db.errori.txt"
                Remove-Item -LiteralPath $errors -Force -ErrorAction SilentlyContinue
                $hasErrors = (Test-Path -LiteralPath "$tmp.errori.txt") -and ((Get-Item -LiteralPath "$tmp.errori.txt").Length -gt 0)
                if ($hasErrors) { Move-Item -LiteralPath "$tmp.errori.txt" -Destination $errors -Force }
                $best[$db] = @{ File = $file; Got = $got; Expected = $expected; Errors = $hasErrors }
            }
            elseif (Test-Path -LiteralPath $tmp) {
                Remove-Item -LiteralPath $tmp -Force
            }
            Remove-Item -LiteralPath "$tmp.errori.txt" -Force -ErrorAction SilentlyContinue

            if (-not $best[$db] -or $best[$db].Got -lt $expected -or $best[$db].Errors) { $complete = $false }
        }

        Stop-Mysqld $process $rescuePort
        if ($complete) { return $true }
    }
    return $false
}

# importa un file .sql passandolo su stdin a mysql.exe
function Import-SqlFile([string]$file) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $mysqlcli
    $psi.Arguments = "--protocol=TCP --host=127.0.0.1 --port=$port --user=root --default-character-set=utf8mb4"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $process = [System.Diagnostics.Process]::Start($psi)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $stream = [IO.File]::OpenRead($file)
    try {
        $stream.CopyTo($process.StandardInput.BaseStream)
        $process.StandardInput.Close()
    }
    catch { }
    finally { $stream.Dispose() }
    $process.WaitForExit()

    return @{ Code = $process.ExitCode; Errors = $stderr.Result.Trim() }
}

# ---------------------------------------------------------------------
#  fine con successo: riavvia il servizio o propone di installarlo
# ---------------------------------------------------------------------
function Open-Panel {
    if (-not $ApriPannello -or -not $root) { return }

    $panel = Join-Path $root 'xampp-control.exe'
    if (Test-Path -LiteralPath $panel) {
        Start-Process -FilePath $panel -WorkingDirectory $root
        Write-Ok 'Apro il pannello di XAMPP'
    }

    # collegamento sul Desktop da usare al posto dell'icona di XAMPP (chiesto una volta sola)
    if (-not $onWindows) { return }
    $link   = Join-Path ([Environment]::GetFolderPath('Desktop')) 'XAMPP (auto-riparazione).lnk'
    $marker = Join-Path $PSScriptRoot '.no_collegamento_xampp'
    if ((Test-Path -LiteralPath $link) -or (Test-Path -LiteralPath $marker)) { return }

    if (Ask 'Creo sul Desktop il collegamento "XAMPP (auto-riparazione)" da usare al posto di XAMPP?') {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($link)
        $shortcut.TargetPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'AVVIA_XAMPP.bat'
        $shortcut.WorkingDirectory = Split-Path -Parent $PSScriptRoot
        if (Test-Path -LiteralPath $panel) { $shortcut.IconLocation = "$panel,0" }
        $shortcut.Save()
        Write-Ok 'Collegamento creato sul Desktop'
    }
    else {
        Set-Content -LiteralPath $marker -Value 'no'
    }
}

# ---------------------------------------------------------------------
#  fine con successo: riavvia il servizio, propone di installarlo, apre il pannello
# ---------------------------------------------------------------------
function Complete-Success([string]$message) {
    Write-Host ''
    Write-Ok $message
    if ($oldName) {
        Write-Host "       I vecchi file restano in xampp\mysql\$oldName (cancellali quando sei sicuro che e' tutto a posto)."
    }

    $service = Get-MySqlService
    if ($service) {
        Start-Service -Name 'mysql'
        Write-Ok 'Servizio mysql avviato'
    }
    elseif ($onWindows -and ($oldName -or -not $ApriPannello)) {
        Write-Host ''
        Write-Host '  La causa di questo errore e'' quasi sempre MySQL chiuso di colpo (PC spento' -ForegroundColor White
        Write-Host '  con MySQL acceso). Come servizio di Windows si spegne sempre in modo pulito.' -ForegroundColor White
        if (Ask 'Vuoi installare MySQL come servizio di Windows (consigliato)?') {
            Invoke-Native $mysqld @('--install', 'mysql', "--defaults-file=$ini") | Out-Null
            Start-Service -Name 'mysql'
            Write-Ok 'MySQL installato come servizio e avviato (nel pannello XAMPP risulta gia'' acceso)'
        }
        elseif (-not $ApriPannello) {
            Write-Host '  Ora apri il pannello XAMPP e premi Start su MySQL.' -ForegroundColor White
        }
    }

    if ($oldName -and $ApriPannello -and -not $Si) {
        Write-Host ''
        Read-Host '  Premi Invio per aprire XAMPP' | Out-Null
    }
    Open-Panel
    Write-Host ''
    exit 0
}

try {
    Write-Host ''
    Write-Host '  ==============================================' -ForegroundColor Blue
    Write-Host ('     C.E.D ITA - ' + $(if ($ApriPannello) { 'Avvio XAMPP con controllo MySQL' } else { 'Riparazione MySQL di XAMPP' })) -ForegroundColor White
    Write-Host '  ==============================================' -ForegroundColor Blue
    Write-Host ''

    $root = Find-Xampp
    if (-not $root) { throw 'XAMPP non trovato. Controlla il percorso e riprova.' }

    $mysqlDir   = Join-Path $root 'mysql'
    $bin        = Join-Path $mysqlDir 'bin'
    $dataDir    = Join-Path $mysqlDir 'data'
    $cleanDir   = Join-Path $mysqlDir 'backup'
    $ini        = Join-Path $bin 'my.ini'
    $mysqld     = Join-Path $bin 'mysqld.exe'
    $mysqladmin = Join-Path $bin 'mysqladmin.exe'
    $mysqlcli   = Join-Path $bin 'mysql.exe'
    $mysqldump  = Join-Path $bin 'mysqldump.exe'
    $port       = Get-IniPort $ini
    $rescuePort = if ($port -eq 3399) { 3398 } else { 3399 }
    $stamp      = Get-Date -Format 'yyyyMMdd_HHmmss'
    $oldName    = $null

    Write-Step "XAMPP: $root  (porta MySQL $port)"
    if (-not $ApriPannello) { Show-ErrorLog $dataDir }

    # MySQL di XAMPP gia' acceso e funzionante? Allora non si tocca niente.
    # (se sulla porta risponde un ALTRO programma, se ne occupa il controllo porta qui sotto)
    $portIsXampp = $true
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique)
        foreach ($listenerId in $listeners) {
            $listener = Get-Process -Id $listenerId -ErrorAction SilentlyContinue
            if (-not ($listener -and $listener.Path -and $listener.Path -like "$bin*")) { $portIsXampp = $false }
        }
    }
    Invoke-Native $mysqladmin @('--protocol=TCP', '--host=127.0.0.1', "--port=$port", '--user=root', '--connect-timeout=2', 'ping') | Out-Null
    if ($LASTEXITCODE -eq 0 -and $portIsXampp) {
        Complete-Success 'MySQL e'' gia'' acceso e funziona: non serve riparare niente.'
    }

    # ---------------- 0) servizio, processi appesi, porta ----------------
    $service = Get-MySqlService
    if ($service -and $service.Status -eq 'Running') {
        Write-Step 'Fermo il servizio mysql ...'
        Stop-Service -Name 'mysql' -Force
    }

    $running = @(Get-Process -Name mysqld -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -like "$bin*" })
    if ($running.Count -gt 0) {
        Write-Warn2 "MySQL di XAMPP risulta ancora aperto (PID $($running.Id -join ', '))."
        if (-not (Ask 'Lo chiudo io adesso?')) { throw 'Operazione annullata.' }
        $running | Stop-Process -Force
        Start-Sleep -Seconds 2
    }

    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $owners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique)

        foreach ($ownerId in $owners) {
            $owner = Get-Process -Id $ownerId -ErrorAction SilentlyContinue
            $name = if ($owner) { $owner.ProcessName } else { "PID $ownerId" }
            Write-Warn2 "La porta $port e' gia' usata da: $name (PID $ownerId). Con la porta occupata MySQL di XAMPP crasha."

            $other = Get-CimInstance Win32_Service -Filter "ProcessId = $ownerId" -ErrorAction SilentlyContinue
            if ($other) {
                if (Ask "E' il servizio Windows '$($other.Name)'. Lo fermo e lo metto su avvio Manuale?") {
                    Stop-Service -Name $other.Name -Force
                    Set-Service -Name $other.Name -StartupType Manual
                    Write-Ok "Servizio $($other.Name) fermato"
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

    # ---------------- 1) parte gia'? ----------------
    Write-Step 'Controllo che MySQL si avvii ...'
    if (Test-MySqlStart) {
        Complete-Success 'MySQL funziona: nessuna riparazione necessaria.'
    }
    if ($ApriPannello) { Show-ErrorLog $dataDir }

    if (-not (Test-Path -LiteralPath $cleanDir)) {
        throw "Manca la copia pulita di XAMPP ($cleanDir): in questo caso serve reinstallare XAMPP."
    }

    # ---------------- 2) LIVELLO 1 ----------------
    Write-Warn2 'MySQL non parte. LIVELLO 1: ricreo i file di sistema tenendo i tuoi database.'
    $oldName = "data_old_$stamp"
    $oldDir  = Join-Path $mysqlDir $oldName
    try {
        Rename-Item -LiteralPath $dataDir -NewName $oldName
    }
    catch {
        throw ("Windows non mi lascia rinominare mysql\data (qualcosa la sta usando). Chiudi il pannello XAMPP, " +
               "le finestre di Esplora risorse aperte su quella cartella e riprova. Dettaglio: $($_.Exception.Message)")
    }
    Write-Ok "Copia di sicurezza: xampp\mysql\$oldName"

    Copy-Item -LiteralPath $cleanDir -Destination $dataDir -Recurse
    $userDbs = @(Get-ChildItem -LiteralPath $oldDir -Directory | Where-Object { $systemDbs -notcontains $_.Name -and $_.Name -notlike '#*' })
    foreach ($db in $userDbs) {
        $dest = Join-Path $dataDir $db.Name
        if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
        Copy-Item -LiteralPath $db.FullName -Destination $dest -Recurse
    }
    # ibdata1 + i suoi file di log InnoDB vanno copiati INSIEME
    $innodbFiles = @(Get-ChildItem -LiteralPath $oldDir -File | Where-Object { $_.Name -match '^(ibdata\d+|ib_logfile\d+|undo\d+)$' })
    if ($innodbFiles.Count -gt 0) {
        Get-ChildItem -LiteralPath $dataDir -File | Where-Object { $_.Name -match '^(ib_logfile\d+|undo\d+)$' } | Remove-Item -Force
        foreach ($file in $innodbFiles) { Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $dataDir $file.Name) -Force }
    }

    Write-Step 'Verifico ...'
    if (Test-MySqlStart) {
        Complete-Success 'MySQL RIPARATO (livello 1), database mantenuti.'
    }

    # ---------------- 3) LIVELLO 2: come appena scaricato ----------------
    Write-Warn2 'Non basta: i file dei database sono rovinati.'
    Write-Warn2 'LIVELLO 2: rimetto MySQL come appena scaricato, salvando prima i tuoi database.'

    $dumpDir = Join-Path $mysqlDir "salvataggio_$stamp"
    $best = @{}
    if ($userDbs.Count -gt 0) {
        # 1) copia dei dati ORIGINALI (lascia intatto data_old), 2) dati del livello 1
        $tmpDir = Join-Path $mysqlDir "recupero_tmp_$stamp"
        Copy-Item -LiteralPath $oldDir -Destination $tmpDir -Recurse
        $done = Save-Databases $tmpDir $dumpDir $best
        Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
        if (-not $done) { $null = Save-Databases $dataDir $dumpDir $best }

        foreach ($db in $best.Keys) {
            $info = $best[$db]
            if ($info.Got -ge $info.Expected -and -not $info.Errors) { Write-Ok "Database salvato: $db ($($info.Got) tabelle)" }
            elseif ($info.Got -ge $info.Expected) { Write-Warn2 "Database salvato con qualche errore: $db (dettagli in salvataggio_$stamp\$db.errori.txt)" }
            elseif ($info.Got -gt 0) { Write-Warn2 "Database salvato in parte: $db ($($info.Got) di $($info.Expected) tabelle)" }
        }
    }
    # si reimportano solo i salvataggi che contengono davvero le tabelle
    $dumps = @($best.Values | Where-Object { $_.Got -gt 0 -or $_.Expected -eq 0 } | ForEach-Object { $_.File })

    Write-Step 'Rimetto i dati di MySQL come appena installato ...'
    Remove-Item -LiteralPath $dataDir -Recurse -Force
    Copy-Item -LiteralPath $cleanDir -Destination $dataDir -Recurse

    $process = Start-Mysqld
    if (-not (Wait-Mysqld $process $port)) {
        Stop-Mysqld $process $port
        Show-ErrorLog $dataDir
        throw ("MySQL non parte nemmeno come appena installato: il problema NON sono i dati " +
               "(porta occupata, antivirus o my.ini modificato). I tuoi dati sono in xampp\mysql\$oldName. " +
               'Manda una foto di questa finestra per capire il problema.')
    }

    foreach ($file in $dumps) {
        $name = [IO.Path]::GetFileNameWithoutExtension($file)
        $result = Import-SqlFile $file
        if ($result.Code -eq 0) { Write-Ok "Database ripristinato: $name ($($best[$name].Got) tabelle)" }
        else { Write-Warn2 "Ripristino parziale di $name : $($result.Errors)" }
    }
    Stop-Mysqld $process $port

    $restored = @($dumps | ForEach-Object { [IO.Path]::GetFileNameWithoutExtension($_) })
    foreach ($db in $userDbs) {
        if ($restored -notcontains $db.Name) {
            Write-Warn2 "Il database '$($db.Name)' non era recuperabile (i file originali restano in xampp\mysql\$oldName)."
        }
    }
    if ($restored.Count -lt $userDbs.Count) {
        Write-Host '       (il database del server FiveM C.E.D ITA viene comunque ricreato da AVVIA_SERVER.bat con i job)' -ForegroundColor DarkYellow
    }
    if ($dumps.Count -gt 0) {
        Write-Host "       Copia .sql dei database salvati: xampp\mysql\salvataggio_$stamp" -ForegroundColor DarkGray
    }

    Complete-Success 'MySQL RIPRISTINATO come appena scaricato (livello 2).'
}
catch {
    Write-Host ''
    Write-Host "  [ERRORE] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ''
    if ($ApriPannello -and $root) {
        $panel = Join-Path $root 'xampp-control.exe'
        if (Test-Path -LiteralPath $panel) { Start-Process -FilePath $panel -WorkingDirectory $root }
    }
    exit 1
}
