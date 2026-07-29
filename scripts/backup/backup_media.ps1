param(
    [string]$MediaDir = ".\backend\media",
    [string]$BackupDir = ".\backups\media"
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[backup:media] $Message"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$mediaPath = Join-Path $repoRoot $MediaDir
$outputDir = Join-Path $repoRoot $BackupDir

if (-not (Test-Path -LiteralPath $mediaPath)) {
    Write-Step "Media dizini yok, backup atlandi: $mediaPath"
    exit 0
}

$mediaItems = Get-ChildItem -LiteralPath $mediaPath -Force
if (-not $mediaItems) {
    Write-Step "Media dizini bos, backup atlandi: $mediaPath"
    exit 0
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = Join-Path $outputDir "media_$timestamp.zip"

Write-Step "Media arsivi olusturuluyor."
Write-Step "Kaynak: $mediaPath"
Write-Step "Hedef: $outputFile"

Compress-Archive -Path (Join-Path $mediaPath "*") -DestinationPath $outputFile -Force

$archiveItem = Get-Item -LiteralPath $outputFile
if ($archiveItem.Length -le 0) {
    Remove-Item -LiteralPath $outputFile -Force
    Write-Error "Media backup bos arsiv uretti; arsiv silindi."
    exit 1
}

Write-Step "Media backup tamamlandi. Boyut: $($archiveItem.Length) bytes"
Write-Step "Dosya: $outputFile"
