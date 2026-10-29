# =====================================================================
#  C.E.D ITA - preparazione automatica del database
#
#  Legge "mysql_connection_string" da server-data\server.cfg, crea il
#  database con QUEL nome (se non esiste) ed esegue database\ced_ita.sql:
#  tabelle ESX / ox_inventory + job Disoccupato, Polizia Di Stato e
#  Arma Dei Carabinieri (grado Operatore).
#  Si puo' eseguire a ogni avvio: non crea doppioni e non cancella dati.
#
#  Se il programma mysql.exe non viene trovato in automatico:
#      CREA_DATABASE.bat -MySql "C:\percorso\mysql.exe"
# =====================================================================

param(
    [string]$MySql
)

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$cfgPath = Join-Path $root 'server-data\server.cfg'
$sqlPath = Join-Path $root 'database\ced_ita.sql'

function Write-Ok($text)    { Write-Host "  [OK] $text" -ForegroundColor Green }
function Write-Step($text)  { Write-Host "  > $text" -ForegroundColor Cyan }
function Write-Warn2($text) { Write-Host "  [!]  $text" -ForegroundColor Yellow }

# ---------------------------------------------------------------------
#  1) connessione da server.cfg
# ---------------------------------------------------------------------
function Get-Connection {
    $match = Select-String -LiteralPath $cfgPath -Pattern '^\s*set\s+mysql_connection_string\s+"([^"]*)"' | Select-Object -First 1
    if (-not $match) {
        throw 'In server.cfg manca la riga:  set mysql_connection_string "mysql://root@localhost/ced_ita?charset=utf8mb4"'
    }

    $conn = $match.Matches[0].Groups[1].Value.Trim()
    $c = @{ Host = 'localhost'; Port = 3306; User = 'root'; Password = ''; Database = '' }

    if ($conn -match '^mysql://') {
        # formato mysql://utente:password@host:porta/database?opzioni
        $uri = [Uri]$conn
        if ($uri.Host) { $c.Host = $uri.Host }
        if ($uri.Port -gt 0) { $c.Port = $uri.Port }
        if ($uri.UserInfo) {
            $parts = $uri.UserInfo.Split(':', 2)
            $c.User = [Uri]::UnescapeDataString($parts[0])
            if ($parts.Count -gt 1) { $c.Password = [Uri]::UnescapeDataString($parts[1]) }
        }
        $c.Database = [Uri]::UnescapeDataString($uri.AbsolutePath.Trim('/'))
    }
    else {
        # formato server=localhost;database=ced_ita;userid=root;password=
        foreach ($part in $conn.Split(';')) {
            $kv = $part.Split('=', 2)
            if ($kv.Count -lt 2) { continue }
            $key = $kv[0].Trim().ToLower()
            $value = $kv[1].Trim()
            switch -Regex ($key) {
                '^(server|host|data source)$'      { $c.Host = $value }
                '^port$'                           { $c.Port = [int]$value }
                '^(user|userid|user id|username)$' { $c.User = $value }
                '^(password|pwd)$'                 { $c.Password = $value }
                '^(database|initial catalog)$'     { $c.Database = $value }
            }
        }
    }

    if ($c.Database -notmatch '^[A-Za-z0-9_\-]{1,64}$') {
        throw "Nome database non valido in server.cfg: '$($c.Database)'. Usa solo lettere, numeri, _ e - (es. ced_ita)."
    }

    return $c
}

# ---------------------------------------------------------------------
#  2) trova mysql.exe (XAMPP, MariaDB, MySQL, Laragon o PATH)
# ---------------------------------------------------------------------
function Find-MySqlClient {
    if ($MySql) {
        if (Test-Path -LiteralPath $MySql) { return (Resolve-Path -LiteralPath $MySql).Path }
        throw "Il file indicato con -MySql non esiste: $MySql"
    }

    $cmd = Get-Command mysql, mariadb -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { return $cmd.Source }

    $patterns = @()
    foreach ($drive in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) {
        $patterns += Join-Path $drive.Root 'xampp\mysql\bin\mysql.exe'
        $patterns += Join-Path $drive.Root 'laragon\bin\mysql\*\bin\mysql.exe'
    }
    foreach ($pf in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramW6432)) {
        if (-not $pf) { continue }
        $patterns += Join-Path $pf 'MariaDB*\bin\mysql.exe'
        $patterns += Join-Path $pf 'MariaDB*\bin\mariadb.exe'
        $patterns += Join-Path $pf 'MySQL\MySQL Server*\bin\mysql.exe'
    }

    foreach ($pattern in $patterns) {
        $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
        if ($found) { return $found.FullName }
    }

    return $null
}

# ---------------------------------------------------------------------
#  3) esegue SQL passandolo su stdin (UTF-8, nessun problema con spazi nei percorsi)
# ---------------------------------------------------------------------
# quoting secondo le regole di Windows: i \ vanno raddoppiati solo prima di un "
function Quote-Arg([string]$value) {
    $escaped = [regex]::Replace($value, '(\\*)"', [System.Text.RegularExpressions.MatchEvaluator] { param($m) ($m.Groups[1].Value * 2) + '\"' })
    $escaped = [regex]::Replace($escaped, '(\\+)$', [System.Text.RegularExpressions.MatchEvaluator] { param($m) $m.Groups[1].Value * 2 })
    return '"' + $escaped + '"'
}

function Invoke-MySql($client, $conn, [string]$sql, [string]$database, [switch]$Force) {
    $arguments = @(
        "--host=$(Quote-Arg $conn.Host)",
        "--user=$(Quote-Arg $conn.User)",
        '--default-character-set=utf8mb4',
        '--batch',
        '--skip-column-names'
    )
    if ($conn.Port -ne 3306) { $arguments += "--port=$($conn.Port)" }
    if ($conn.Password -ne '') { $arguments += "--password=$(Quote-Arg $conn.Password)" }
    if ($Force) { $arguments += '--force' }
    if ($database) { $arguments += "--database=$(Quote-Arg $database)" }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $client
    $psi.Arguments = ($arguments -join ' ')
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $process = [System.Diagnostics.Process]::Start($psi)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()

    $bytes = (New-Object System.Text.UTF8Encoding $false).GetBytes($sql)
    try {
        $process.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
        $process.StandardInput.Close()
    }
    catch {
        # mysql si e' gia' chiuso (es. password sbagliata): l'errore vero e' su stderr
    }
    $process.WaitForExit()

    # il client avvisa sempre quando la password e' sulla riga di comando: non e' un errore
    $errors = ($stderr.Result -split "`r?`n") | Where-Object { $_ -and $_ -notmatch 'password on the command line' }

    return @{
        ExitCode = $process.ExitCode
        Output   = $stdout.Result
        Errors   = ($errors -join "`n").Trim()
    }
}

# ---------------------------------------------------------------------
#  main
# ---------------------------------------------------------------------
try {
    Write-Host ''
    Write-Host '  ---------- Database C.E.D ITA ----------' -ForegroundColor Blue

    $conn = Get-Connection
    Write-Step "Database da server.cfg: $($conn.Database)  (utente $($conn.User) su $($conn.Host):$($conn.Port))"

    $client = Find-MySqlClient
    if (-not $client) {
        throw ("Non trovo mysql.exe. Installa XAMPP (https://www.apachefriends.org) e avvia MySQL, " +
               'oppure indica il percorso:  CREA_DATABASE.bat -MySql "C:\percorso\mysql.exe"')
    }
    Write-Step "Client MySQL: $client"

    $test = Invoke-MySql $client $conn 'SELECT 1;'
    if ($test.ExitCode -ne 0) {
        throw ("Impossibile collegarsi a MySQL. Controlla che MySQL sia AVVIATO (pannello XAMPP -> MySQL -> Start) " +
               "e che utente/password in server.cfg siano giusti.`n         Dettaglio: $($test.Errors)")
    }

    # usa il nome del database scritto in server.cfg al posto di `ced_ita`
    $sql = [IO.File]::ReadAllText($sqlPath)
    $sql = $sql.Replace('`ced_ita`', ('`' + $conn.Database + '`'))

    Write-Step 'Creo database, tabelle e lavori (se mancano) ...'
    $run = Invoke-MySql $client $conn $sql -Force
    if ($run.Errors) {
        Write-Warn2 'MySQL ha segnalato qualcosa (di solito innocuo se il database esisteva gia''):'
        Write-Host "         $($run.Errors)" -ForegroundColor DarkYellow
    }

    # verifica finale: i 3 lavori con i loro gradi devono esserci
    $check = Invoke-MySql $client $conn @"
SELECT CONCAT(j.name, '|', j.label, '|', g.label)
FROM jobs j JOIN job_grades g ON g.job_name = j.name AND g.grade = 0
WHERE j.name IN ('unemployed', 'polizia', 'carabinieri')
ORDER BY j.name;
"@ $conn.Database

    $rows = @(($check.Output -split "`r?`n") | Where-Object { $_ })
    if ($check.ExitCode -ne 0 -or $rows.Count -lt 3) {
        throw "Il database non contiene tutti i lavori. Dettaglio: $($check.Errors) $($run.Errors)"
    }

    foreach ($row in $rows) {
        $f = $row.Split('|')
        Write-Ok ("{0,-12} {1,-22} grado: {2}" -f $f[0], $f[1], $f[2])
    }
    Write-Ok "Database '$($conn.Database)' pronto"
    Write-Host ''
    exit 0
}
catch {
    Write-Host ''
    Write-Host "  [ERRORE] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ''
    exit 1
}
