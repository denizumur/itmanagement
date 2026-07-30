param(
    [ValidateSet("dev", "staging", "production")]
    [string]$Environment = "dev",
    [int]$RetentionDays = 14,
    [int]$RetentionMinCount = 5,
    [switch]$SkipMedia,
    [switch]$DryRunCleanup,
    [switch]$FailOnMediaMissing
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[backup:scheduled] $Message"
}

function Add-RunError {
    param([string]$Message)
    $script:errors += $Message
    Write-Host "[backup:scheduled] ERROR: $Message"
}

function Get-BackupSnapshot {
    param(
        [string]$Dir,
        [string]$Filter
    )

    if (-not (Test-Path -LiteralPath $Dir)) {
        return @()
    }

    Get-ChildItem -LiteralPath $Dir -File -Filter $Filter |
        Where-Object { $_.Length -gt 0 } |
        ForEach-Object {
            Get-Item -LiteralPath $_.FullName
        }
}

function Get-NewBackupArtifact {
    param(
        [string]$Dir,
        [string]$Filter,
        [datetime]$BackupStart,
        [object[]]$BeforeSnapshot
    )

    $beforePaths = @{}
    foreach ($file in $BeforeSnapshot) {
        $beforePaths[$file.FullName] = $true
    }

    $afterSnapshot = @(Get-BackupSnapshot -Dir $Dir -Filter $Filter)
    $newFile = $afterSnapshot |
        Where-Object { -not $beforePaths.ContainsKey($_.FullName) } |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if ($newFile) {
        return $newFile
    }

    $fallbackStart = $BackupStart.AddMinutes(-2)
    $afterSnapshot |
        Where-Object { $_.LastWriteTime -ge $fallbackStart } |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
}

function Test-PostgresDump {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return "PostgreSQL backup dosyasi bulunamadi."
    }

    $item = Get-Item -LiteralPath $Path
    if ($item.Length -le 0) {
        return "PostgreSQL backup dosyasi bos."
    }

    $head = Get-Content -LiteralPath $Path -TotalCount 80 -ErrorAction Stop
    $hasDumpMarker = $head | Where-Object {
        $_ -like "*PostgreSQL database dump*" -or $_ -like "*pg_dump*"
    }

    if (-not $hasDumpMarker) {
        return "WARN: PostgreSQL dump imzasi ilk satirlarda bulunamadi; dosya varligi ve boyutu gecerli."
    }

    return $null
}

function Test-ZipArchive {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return "Media backup dosyasi bulunamadi."
    }

    $item = Get-Item -LiteralPath $Path
    if ($item.Length -le 0) {
        return "Media backup dosyasi bos."
    }

    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
        try {
            if ($zip.Entries.Count -lt 1) {
                return "Media zip arsivi hic entry icermiyor."
            }
        } finally {
            $zip.Dispose()
        }
    } catch {
        return "Media zip arsivi okunamadi: $($_.Exception.Message)"
    }

    return $null
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
$startedAt = (Get-Date).ToUniversalTime()
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runId = "backup-$timestamp"
$errors = @()
$warnings = @()
$retentionApplied = $false
$deletedFilesCount = 0

$postgresDir = Join-Path $repoRoot "backups\postgres"
$mediaDir = Join-Path $repoRoot "backups\media"
$manifestDir = Join-Path $repoRoot "backups\manifests"
New-Item -ItemType Directory -Force -Path $postgresDir, $mediaDir, $manifestDir | Out-Null

if ($Environment -eq "production") {
    Write-Warning "Production backup modu: artifactleri guvenli/offsite storage'a kopyalamayi unutmayin."
}

Push-Location $repoRoot
try {
    Write-Step "Docker Compose servisleri kontrol ediliyor."
    & docker compose ps db | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Add-RunError "Docker Compose db service erisilebilir degil."
        throw "docker compose ps db failed"
    }

    & docker compose ps backend | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $warnings += "Backend service ps kontrolu basarisiz; PostgreSQL backup yine deneniyor."
    }

    $postgresBeforeSnapshot = @(Get-BackupSnapshot -Dir $postgresDir -Filter "*.sql")
    $beforePostgres = Get-Date
    Write-Step "PostgreSQL backup baslatiliyor."
    & powershell.exe -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "backup_postgres.ps1")
    if ($LASTEXITCODE -ne 0) {
        Add-RunError "PostgreSQL backup scripti basarisiz oldu. Exit code: $LASTEXITCODE"
    }

    $postgresBackup = Get-NewBackupArtifact -Dir $postgresDir -Filter "*.sql" -BackupStart $beforePostgres -BeforeSnapshot $postgresBeforeSnapshot
    if ($postgresBackup) {
        $postgresValidationError = Test-PostgresDump -Path $postgresBackup.FullName
        if ($postgresValidationError) {
            if ($postgresValidationError.StartsWith("WARN:")) {
                $warnings += $postgresValidationError.Substring(6)
                Write-Step $postgresValidationError.Substring(6)
            } else {
                Add-RunError $postgresValidationError
            }
        }
    } else {
        Add-RunError "Yeni PostgreSQL backup artifacti bulunamadi."
    }

    $mediaBackup = $null
    if ($SkipMedia) {
        $warnings += "Media backup SkipMedia nedeniyle atlandi."
        Write-Step "Media backup SkipMedia nedeniyle atlandi."
    } else {
        $mediaBeforeSnapshot = @(Get-BackupSnapshot -Dir $mediaDir -Filter "*.zip")
        $beforeMedia = Get-Date
        Write-Step "Media backup baslatiliyor."
        & powershell.exe -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "backup_media.ps1")
        if ($LASTEXITCODE -ne 0) {
            Add-RunError "Media backup scripti basarisiz oldu. Exit code: $LASTEXITCODE"
        }

        $mediaBackup = Get-NewBackupArtifact -Dir $mediaDir -Filter "*.zip" -BackupStart $beforeMedia -BeforeSnapshot $mediaBeforeSnapshot
        if ($mediaBackup) {
            $mediaValidationError = Test-ZipArchive -Path $mediaBackup.FullName
            if ($mediaValidationError) {
                Add-RunError $mediaValidationError
            }
        } else {
            $message = "Yeni media backup artifacti bulunamadi."
            if ($FailOnMediaMissing) {
                Add-RunError $message
            } else {
                $warnings += $message
                Write-Step $message
            }
        }
    }

    Write-Step "Retention cleanup calistiriliyor."
    $cleanupOutput = & (Join-Path $PSScriptRoot "cleanup_old_backups.ps1") -RetentionDays $RetentionDays -RetentionMinCount $RetentionMinCount -DryRun:$DryRunCleanup
    if ($LASTEXITCODE -ne 0) {
        Add-RunError "Retention cleanup basarisiz oldu. Exit code: $LASTEXITCODE"
    } else {
        $retentionApplied = $true
        $deletedFilesCount = @($cleanupOutput | Where-Object { $_ -is [pscustomobject] }).Count
    }
} catch {
    if ($errors.Count -eq 0) {
        Add-RunError $_.Exception.Message
    }
} finally {
    Pop-Location
}

$finishedAt = (Get-Date).ToUniversalTime()
$status = "success"
if ($errors.Count -gt 0 -and ($postgresBackup -or $mediaBackup)) {
    $status = "partial"
} elseif ($errors.Count -gt 0) {
    $status = "failed"
}

$gitCommit = $null
try {
    Push-Location $repoRoot
    $gitCommit = (& git rev-parse --short HEAD 2>$null).Trim()
    Pop-Location
} catch {
    $gitCommit = $null
}

$manifest = [ordered]@{
    run_id = $runId
    started_at = $startedAt.ToString("o")
    finished_at = $finishedAt.ToString("o")
    status = $status
    environment = $Environment
    postgres_backup_path = if ($postgresBackup) { $postgresBackup.FullName } else { $null }
    postgres_backup_size_bytes = if ($postgresBackup) { $postgresBackup.Length } else { $null }
    media_backup_path = if ($mediaBackup) { $mediaBackup.FullName } else { $null }
    media_backup_size_bytes = if ($mediaBackup) { $mediaBackup.Length } else { $null }
    retention_applied = $retentionApplied
    deleted_files_count = $deletedFilesCount
    errors = @($errors)
    warnings = @($warnings)
    docker_compose = @{
        project_directory = $repoRoot
        services_checked = @("db", "backend")
    }
    git_commit = $gitCommit
}

$manifestPath = Join-Path $manifestDir "backup-manifest-$timestamp.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Step "Manifest yazildi: $manifestPath"
Write-Step "Status: $status"

if ($status -eq "success") {
    exit 0
}

exit 1
