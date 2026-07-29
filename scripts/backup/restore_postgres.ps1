param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[restore:postgres] $Message"
}

if (-not (Test-Path -LiteralPath $BackupFile)) {
    Write-Error "Backup dosyasi bulunamadi: $BackupFile"
    exit 1
}

$resolvedBackupFile = (Resolve-Path -LiteralPath $BackupFile).Path

Write-Warning "Bu islem hedef PostgreSQL veritabanina SQL restore uygular."
Write-Warning "Mevcut veriler degisebilir veya silinebilir. Production DB uzerinde drill yapmayin."
$confirmation = Read-Host 'Devam etmek icin tam olarak RESTORE yazin'

if ($confirmation -ne "RESTORE") {
    Write-Step "Confirmation alinmadi. Restore iptal edildi."
    exit 1
}

Write-Step "DB baglantisi kontrol ediliyor."
$checkCommand = 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select 1"'
& docker compose exec -T db sh -c $checkCommand | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Error "DB baglanti kontrolu basarisiz oldu."
    exit $LASTEXITCODE
}

Write-Step "Restore baslatiliyor: $resolvedBackupFile"
$containerFile = "/tmp/it_inventory_restore.sql"
& docker compose cp $resolvedBackupFile "db:$containerFile"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Backup dosyasi db service icine kopyalanamadi."
    exit $LASTEXITCODE
}

$restoreCommand = "psql -v ON_ERROR_STOP=1 -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -f $containerFile"
& docker compose exec -T db sh -c $restoreCommand
$exitCode = $LASTEXITCODE
& docker compose exec -T db sh -c "rm -f $containerFile" | Out-Null

if ($exitCode -ne 0) {
    Write-Error "PostgreSQL restore basarisiz oldu. Exit code: $exitCode"
    exit $exitCode
}

Write-Step "Restore tamamlandi."
