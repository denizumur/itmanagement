param(
    [int]$MaxAgeHours = 24,
    [switch]$FailIfOlderThanMaxAge,
    [switch]$RequireMedia
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[backup:verify] $Message"
}

function Fail-Verify {
    param([string]$Message)
    Write-Host "[backup:verify] ERROR: $Message"
    exit 1
}

if ($MaxAgeHours -lt 1) {
    Fail-Verify "MaxAgeHours en az 1 olmalidir."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$manifestDir = Join-Path $repoRoot "backups\manifests"

if (-not (Test-Path -LiteralPath $manifestDir)) {
    Fail-Verify "Manifest klasoru bulunamadi: $manifestDir"
}

$latestManifest = Get-ChildItem -LiteralPath $manifestDir -File -Filter "backup-manifest-*.json" |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

if (-not $latestManifest) {
    Fail-Verify "Manifest bulunamadi."
}

Write-Step "Manifest: $($latestManifest.FullName)"
$manifest = Get-Content -LiteralPath $latestManifest.FullName -Raw | ConvertFrom-Json

if ($manifest.status -ne "success") {
    Fail-Verify "Son backup saglikli degil. Status: $($manifest.status)"
}

if (-not $manifest.postgres_backup_path) {
    Fail-Verify "Manifest postgres backup path icermiyor."
}

if (-not (Test-Path -LiteralPath $manifest.postgres_backup_path)) {
    Fail-Verify "PostgreSQL backup dosyasi bulunamadi: $($manifest.postgres_backup_path)"
}

$postgresItem = Get-Item -LiteralPath $manifest.postgres_backup_path
if ($postgresItem.Length -le 0) {
    Fail-Verify "PostgreSQL backup dosyasi bos: $($manifest.postgres_backup_path)"
}

if ($manifest.media_backup_path) {
    if (-not (Test-Path -LiteralPath $manifest.media_backup_path)) {
        Fail-Verify "Media backup dosyasi bulunamadi: $($manifest.media_backup_path)"
    }

    $mediaItem = Get-Item -LiteralPath $manifest.media_backup_path
    if ($mediaItem.Length -le 0) {
        Fail-Verify "Media backup dosyasi bos: $($manifest.media_backup_path)"
    }
} elseif ($RequireMedia) {
    Fail-Verify "RequireMedia aktif ama manifest media backup icermiyor."
}

$finishedAt = [datetime]::Parse($manifest.finished_at)
$ageHours = ((Get-Date).ToUniversalTime() - $finishedAt.ToUniversalTime()).TotalHours
Write-Step ("Backup yasi: {0:N1} saat" -f $ageHours)

if ($ageHours -gt $MaxAgeHours) {
    $message = "Backup MaxAgeHours esiginden eski: $MaxAgeHours saat"
    if ($FailIfOlderThanMaxAge) {
        Fail-Verify $message
    }

    Write-Warning $message
}

Write-Step "Backup saglikli gorunuyor."
exit 0
