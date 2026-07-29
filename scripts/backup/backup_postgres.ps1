param(
    [string]$BackupDir = ".\backups\postgres"
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[backup:postgres] $Message"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$outputDir = Join-Path $repoRoot $BackupDir
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = Join-Path $outputDir "it_inventory_$timestamp.sql"

Write-Step "Docker Compose db service uzerinden pg_dump baslatiliyor."
Write-Step "Hedef dosya: $outputFile"

$containerFile = "/tmp/it_inventory_$timestamp.sql"
$dumpCommand = "pg_dump -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -f $containerFile"

& docker compose exec -T db sh -c $dumpCommand
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Error "PostgreSQL backup basarisiz oldu. Exit code: $exitCode"
    exit $exitCode
}

& docker compose cp "db:$containerFile" $outputFile
$copyExitCode = $LASTEXITCODE
& docker compose exec -T db sh -c "rm -f $containerFile" | Out-Null

if ($copyExitCode -ne 0) {
    if (Test-Path -LiteralPath $outputFile) {
        Remove-Item -LiteralPath $outputFile -Force
    }

    Write-Error "Backup dosyasi container'dan host'a kopyalanamadi. Exit code: $copyExitCode"
    exit $copyExitCode
}

$backupItem = Get-Item -LiteralPath $outputFile
if ($backupItem.Length -le 0) {
    Remove-Item -LiteralPath $outputFile -Force
    Write-Error "PostgreSQL backup bos dosya uretti; backup silindi."
    exit 1
}

Write-Step "Backup tamamlandi. Boyut: $($backupItem.Length) bytes"
Write-Step "Dosya: $outputFile"
