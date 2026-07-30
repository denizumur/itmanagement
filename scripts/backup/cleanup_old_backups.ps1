param(
    [int]$RetentionDays = 14,
    [int]$RetentionMinCount = 5,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[backup:cleanup] $Message"
}

if ($RetentionDays -lt 1) {
    Write-Error "RetentionDays en az 1 olmalidir."
    exit 1
}

if ($RetentionMinCount -lt 0) {
    Write-Error "RetentionMinCount negatif olamaz."
    exit 1
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$cutoff = (Get-Date).AddDays(-$RetentionDays)
$deleted = @()
$candidates = @(
    @{ Dir = Join-Path $repoRoot "backups\postgres"; Pattern = "*.sql" },
    @{ Dir = Join-Path $repoRoot "backups\media"; Pattern = "*.zip" },
    @{ Dir = Join-Path $repoRoot "backups\manifests"; Pattern = "*.json" }
)

foreach ($target in $candidates) {
    $dir = $target.Dir
    if (-not (Test-Path -LiteralPath $dir)) {
        Write-Step "Klasor yok, atlandi: $dir"
        continue
    }

    $resolvedDir = (Resolve-Path -LiteralPath $dir).Path
    $files = Get-ChildItem -LiteralPath $resolvedDir -File -Filter $target.Pattern |
        Sort-Object LastWriteTimeUtc -Descending

    $protected = $files | Select-Object -First $RetentionMinCount
    $protectedPaths = @{}
    foreach ($file in $protected) {
        $protectedPaths[$file.FullName] = $true
    }

    $oldFiles = $files | Where-Object {
        $_.LastWriteTime -lt $cutoff -and -not $protectedPaths.ContainsKey($_.FullName)
    }

    foreach ($file in $oldFiles) {
        $resolvedFile = (Resolve-Path -LiteralPath $file.FullName).Path
        if (-not $resolvedFile.StartsWith($resolvedDir, [System.StringComparison]::OrdinalIgnoreCase)) {
            Write-Warning "Klasor disi dosya atlandi: $resolvedFile"
            continue
        }

        if ($DryRun) {
            Write-Step "Dry-run silerdi: $resolvedFile"
        } else {
            Remove-Item -LiteralPath $resolvedFile -Force
            Write-Step "Silindi: $resolvedFile"
        }

        $deleted += [pscustomobject]@{
            path = $resolvedFile
            size_bytes = $file.Length
            last_write_time = $file.LastWriteTimeUtc.ToString("o")
            dry_run = [bool]$DryRun
        }
    }
}

Write-Step "Tamamlandi. Etkilenen dosya sayisi: $($deleted.Count)"
$deleted
