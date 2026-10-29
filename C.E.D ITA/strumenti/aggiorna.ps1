# =====================================================================
#  C.E.D ITA - aggiornamento automatico da GitHub
#
#  Scarica l'ultima versione della cartella "C.E.D ITA" e la applica qui:
#   - aggiorna solo i file che NON hai modificato tu
#   - server.cfg / permessi.cfg: prende la versione nuova ma tiene la TUA
#     key, il database, il nome del server e le righe che hai aggiunto
#   - se hai modificato un altro file, tiene il tuo e mette quello nuovo
#     in backup\aggiornamento_<data>\nuove_versioni
#   - non tocca artifacts, cache, backup e le risorse che hai aggiunto tu
#
#  Per disattivare gli aggiornamenti crea il file NON_AGGIORNARE.txt
#  nella cartella principale.
# =====================================================================

param(
    [string]$Zip,       # solo per prove: zip locale al posto del download
    [string]$Commit     # solo per prove: versione da usare al posto di quella su GitHub
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo     = 'dartisback/test'
$Branch   = 'claude/blissful-edison-xbtikl'
$Cartella = 'C.E.D ITA'

$root      = Split-Path -Parent $PSScriptRoot
$sep       = [IO.Path]::DirectorySeparatorChar
$statoFile = Join-Path $PSScriptRoot '.versione_installata'
$stamp     = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupDir = [IO.Path]::Combine($root, 'backup', "aggiornamento_$stamp")

# cartelle che l'aggiornamento non tocca mai
$esclusi = @('artifacts/', 'backup/', 'txData/', 'server-data/cache/')

# server.cfg: valori personali che vengono sempre conservati
$chiaviServer = @(
    'sv_licensekey', 'sv_hostname', 'sv_maxclients', 'set steam_webapikey', 'set mysql_connection_string',
    'sets sv_projectname', 'sets sv_projectdesc', 'sets tags', 'sets locale', 'sets banner_detail',
    'sets banner_connecting', 'load_server_icon', 'endpoint_add_tcp', 'endpoint_add_udp'
)
$fileUniti = @{ 'server-data/server.cfg' = $chiaviServer; 'server-data/permessi.cfg' = @() }

function Write-Ok($text)    { Write-Host "  [OK] $text" -ForegroundColor Green }
function Write-Step($text)  { Write-Host "  > $text" -ForegroundColor Cyan }
function Write-Warn2($text) { Write-Host "  [!]  $text" -ForegroundColor Yellow }

function Native([string]$rel) { return [IO.Path]::Combine($root, $rel.Replace('/', $sep)) }

$hasher = [Security.Cryptography.SHA256]::Create()
function Get-Hash([string]$path) {
    $stream = [IO.File]::OpenRead($path)
    try { return -join ($hasher.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) }
    finally { $stream.Dispose() }
}

function Copy-Safe([string]$from, [string]$to) {
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($to)) | Out-Null
    [IO.File]::Copy($from, $to, $true)
}

function Save-Backup([string]$rel, [string]$sub) {
    $src = Native $rel
    if (-not [IO.File]::Exists($src)) { return }
    Copy-Safe $src ([IO.Path]::Combine($backupDir, $sub, $rel.Replace('/', $sep)))
}

# chiave di una riga .cfg: "set mysql_connection_string", "sv_licensekey", ...
function Get-CfgKey([string]$line) {
    $tokens = @($line.Trim() -split '\s+' | Where-Object { $_ })
    if ($tokens.Count -eq 0) { return '' }
    $first = $tokens[0].ToLower()
    if (@('set', 'sets', 'setr') -contains $first -and $tokens.Count -gt 1) { return "$first $($tokens[1].ToLower())" }
    return $first
}

function Merge-Cfg([string]$userText, [string]$newText, [string[]]$history, [string[]]$keys) {
    $newLines  = [Collections.Generic.List[string]]($newText -split "`r?`n")
    $userLines = $userText -split "`r?`n"
    $active    = { param($l) $t = $l.Trim(); $t -ne '' -and -not $t.StartsWith('#') }

    $newActive = @{}
    foreach ($l in $newLines) { if (& $active $l) { $newActive[$l.Trim()] = $true } }
    $known = @{}
    foreach ($l in $history) { $known[$l.Trim()] = $true }

    # 1) i tuoi valori (key, database, nome server...) al posto di quelli nuovi
    $values = @{}
    foreach ($l in $userLines) {
        if (-not (& $active $l)) { continue }
        $k = Get-CfgKey $l
        if ($keys -contains $k -and -not $values.ContainsKey($k)) { $values[$k] = $l.Trim() }
    }
    $used = @{}
    foreach ($pass in @('attive', 'commentate')) {
        for ($i = 0; $i -lt $newLines.Count; $i++) {
            $t = $newLines[$i].Trim()
            $isComment = $t.StartsWith('#')
            if (($pass -eq 'attive') -eq $isComment) { continue }
            $k = Get-CfgKey $t.TrimStart('#')
            if ($values.ContainsKey($k) -and -not $used.ContainsKey($k)) {
                $newLines[$i] = $values[$k]
                $used[$k] = $true
            }
        }
    }
    foreach ($k in $values.Keys) { if (-not $used.ContainsKey($k)) { $newLines.Add($values[$k]) } }

    # 2) righe che hai aggiunto tu (non sono mai esistite nelle versioni C.E.D ITA)
    $extra = @()
    foreach ($l in $userLines) {
        if (-not (& $active $l)) { continue }
        $t = $l.Trim()
        if ($newActive.ContainsKey($t) -or $known.ContainsKey($t) -or $keys -contains (Get-CfgKey $t)) { continue }
        $extra += $t
    }
    if ($extra.Count -gt 0) {
        $newLines.Add('')
        $newLines.Add('# ---------------------------------------------------------------')
        $newLines.Add('#  RIGHE AGGIUNTE DA TE (conservate dall''aggiornamento automatico)')
        $newLines.Add('# ---------------------------------------------------------------')
        foreach ($l in $extra) { $newLines.Add($l) }
    }

    return @{ Text = (($newLines -join "`n").TrimEnd() + "`n"); Extra = $extra.Count }
}

$tempDir = [IO.Path]::Combine([IO.Path]::GetTempPath(), 'ced_aggiornamento_' + [Guid]::NewGuid().ToString('N'))

try {
    Write-Host ''
    Write-Host '  ---------- Aggiornamento C.E.D ITA ----------' -ForegroundColor Blue

    if ([IO.File]::Exists((Join-Path $root 'NON_AGGIORNARE.txt'))) {
        Write-Warn2 'Aggiornamenti disattivati (esiste NON_AGGIORNARE.txt).'
        exit 0
    }

    # ---------------- 1) c'e' una versione nuova? ----------------
    $sha = $Commit
    $novita = ''
    if (-not $sha) {
        try {
            $info = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/branches/$Branch" -Headers @{ 'User-Agent' = 'ced-ita-aggiornamento' } -TimeoutSec 15
            $sha = $info.commit.sha
            $novita = ($info.commit.commit.message -split "`n")[0]
        }
        catch {
            Write-Warn2 'Non riesco a controllare gli aggiornamenti (internet assente?): avvio con la versione attuale.'
            exit 0
        }
    }

    $installata = if ([IO.File]::Exists($statoFile)) { [IO.File]::ReadAllText($statoFile).Trim() } else { '' }
    if ($installata -eq $sha) {
        Write-Ok 'Hai gia'' l''ultima versione.'
        exit 0
    }

    Write-Step 'Nuova versione disponibile, la scarico ...'
    if ($novita) { Write-Host "       Novita': $novita" -ForegroundColor White }

    # ---------------- 2) download ed estrazione ----------------
    [IO.Directory]::CreateDirectory($tempDir) | Out-Null
    $zipPath = [IO.Path]::Combine($tempDir, 'ced.zip')
    if ($Zip) { [IO.File]::Copy($Zip, $zipPath, $true) }
    else { Invoke-WebRequest -Uri "https://codeload.github.com/$Repo/zip/$sha" -OutFile $zipPath -UseBasicParsing -TimeoutSec 300 }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $extractDir = [IO.Path]::Combine($tempDir, 'estratto')
    [IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extractDir)

    $newRoot = $null
    foreach ($dir in [IO.Directory]::GetDirectories($extractDir)) {
        $candidate = [IO.Path]::Combine($dir, $Cartella)
        if ([IO.File]::Exists([IO.Path]::Combine($candidate, 'server-data', 'server.cfg'))) { $newRoot = $candidate }
    }
    if (-not $newRoot) { throw 'Lo zip scaricato non contiene la cartella del server.' }

    $manifestPath = [IO.Path]::Combine($newRoot, 'strumenti', 'versioni_file.json')
    $manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
    $knownHashes = @{}
    foreach ($p in $manifest.file.PSObject.Properties) { $knownHashes[$p.Name] = @($p.Value) }
    $cfgHistory = @{}
    foreach ($p in $manifest.cfg.PSObject.Properties) { $cfgHistory[$p.Name] = @($p.Value) }

    # ---------------- 3) confronto file per file ----------------
    Write-Step 'Applico l''aggiornamento ...'
    $added = 0; $updated = 0; $merged = @(); $conflicts = @(); $removed = 0; $keptOld = @()
    $newFiles = @{}

    foreach ($file in [IO.Directory]::GetFiles($newRoot, '*', [IO.SearchOption]::AllDirectories)) {
        $rel = $file.Substring($newRoot.Length + 1).Replace('\', '/')
        $newFiles[$rel] = $true
        if (@($esclusi | Where-Object { $rel.StartsWith($_) }).Count -gt 0 -and $rel -ne 'artifacts/LEGGIMI.txt') { continue }

        $dest = Native $rel
        if (-not [IO.File]::Exists($dest)) {
            Copy-Safe $file $dest
            $added++
            continue
        }

        $localHash = Get-Hash $dest
        if ($localHash -eq (Get-Hash $file)) { continue }

        $unmodified = $knownHashes.ContainsKey($rel) -and ($knownHashes[$rel] -contains $localHash)

        if ($rel -eq 'AVVIA_SERVER.bat') {
            # e' il file in esecuzione: non si puo' sovrascrivere adesso
            Copy-Safe $file "$dest.nuovo"
            Write-Warn2 'AVVIA_SERVER.bat e'' cambiato: la versione nuova e'' in AVVIA_SERVER.bat.nuovo (rinominala a server spento).'
        }
        elseif ($unmodified) {
            Copy-Safe $file $dest
            $updated++
        }
        elseif ($fileUniti.ContainsKey($rel)) {
            Save-Backup $rel 'tue_versioni'
            $result = Merge-Cfg ([IO.File]::ReadAllText($dest)) ([IO.File]::ReadAllText($file)) $cfgHistory[$rel] $fileUniti[$rel]
            [IO.File]::WriteAllText($dest, $result.Text, (New-Object Text.UTF8Encoding $false))
            $merged += "$rel (righe tue conservate: $($result.Extra))"
        }
        else {
            Copy-Safe $file ([IO.Path]::Combine($backupDir, 'nuove_versioni', $rel.Replace('/', $sep)))
            $conflicts += $rel
        }
    }

    # ---------------- 4) file tolti nella versione nuova ----------------
    $emptyCandidates = @{}
    foreach ($rel in $knownHashes.Keys) {
        if ($newFiles.ContainsKey($rel)) { continue }
        $dest = Native $rel
        if (-not [IO.File]::Exists($dest)) { continue }
        if ($knownHashes[$rel] -contains (Get-Hash $dest)) {
            [IO.File]::Delete($dest)
            $removed++
            $emptyCandidates[[IO.Path]::GetDirectoryName($dest)] = $true
        }
        else {
            $keptOld += $rel
        }
    }
    # cartelle rimaste vuote (es. risorse eliminate)
    foreach ($dir in ($emptyCandidates.Keys | Sort-Object { $_.Length } -Descending)) {
        $d = $dir
        while ($d -and $d.Length -gt $root.Length -and [IO.Directory]::Exists($d) -and
               [IO.Directory]::GetFileSystemEntries($d).Length -eq 0) {
            [IO.Directory]::Delete($d)
            $d = [IO.Path]::GetDirectoryName($d)
        }
    }

    [IO.File]::WriteAllText($statoFile, $sha)

    # ---------------- 5) riepilogo ----------------
    Write-Ok "Aggiornamento completato: $added nuovi, $updated aggiornati, $removed rimossi."
    foreach ($m in $merged) { Write-Ok "Unito con le tue modifiche: $m" }
    if ($conflicts.Count -gt 0) {
        Write-Warn2 "Hai modificato questi file: ho tenuto i TUOI. La versione nuova e' in backup\aggiornamento_$stamp\nuove_versioni"
        foreach ($c in $conflicts) { Write-Host "         - $c" -ForegroundColor DarkYellow }
    }
    if ($keptOld.Count -gt 0) {
        Write-Warn2 'Questi file non servono piu'' ma li hai modificati, quindi li ho lasciati:'
        foreach ($c in $keptOld) { Write-Host "         - $c" -ForegroundColor DarkYellow }
    }
    Write-Host ''
    exit 0
}
catch {
    Write-Host ''
    Write-Host "  [ERRORE] Aggiornamento non riuscito: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '           Il server parte comunque con i file attuali.' -ForegroundColor Red
    Write-Host ''
    exit 1
}
finally {
    if ([IO.Directory]::Exists($tempDir)) { [IO.Directory]::Delete($tempDir, $true) }
}
