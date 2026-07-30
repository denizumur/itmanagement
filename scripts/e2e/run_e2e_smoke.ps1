param(
    [string]$Password = "E2ePass123!",
    [string]$NodePath = "node"
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[e2e:smoke] $Message"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$frontendDir = Join-Path $repoRoot "frontend"
$envFile = Join-Path $repoRoot ".env"
$playwrightCli = Join-Path $frontendDir "node_modules\@playwright\test\cli.js"

Write-Warning "Bu runner sadece local/dev smoke icindir. Smoke kullanici sifrelerini resetler; production'da calistirmayin."

if (Test-Path -LiteralPath $envFile) {
    $djangoEnvLine = Get-Content -LiteralPath $envFile |
        Where-Object { $_ -match "^\s*DJANGO_ENV\s*=\s*production\s*$" } |
        Select-Object -First 1

    if ($djangoEnvLine) {
        Write-Error "DJANGO_ENV=production tespit edildi. E2E smoke runner production ortamda calismaz."
        exit 1
    }
}

if (-not (Get-Command $NodePath -ErrorAction SilentlyContinue)) {
    Write-Error "Node executable bulunamadi: $NodePath. -NodePath ile node.exe yolunu verin."
    exit 1
}

if (-not (Test-Path -LiteralPath $playwrightCli)) {
    Write-Error "Playwright CLI bulunamadi. Frontend dependency kurulumunu ve @playwright/test paketini kontrol edin."
    exit 1
}

Write-Step "Local/dev Docker Compose servisleri baslatiliyor."
& docker compose up -d
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Step "Backend check calistiriliyor."
& docker compose exec backend python manage.py check
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Step "Local/dev smoke kullanici sifreleri hazirlaniyor."
$prepareScript = Join-Path $repoRoot "backend\.e2e_prepare_smoke_users.py"
$pythonCode = @"
from django.contrib.auth import get_user_model
from django.core.cache import cache
from apps.accounts.models import UserInvitation, UserProfile
from apps.employees.models import Employee

password = "$Password"
users = [
    ("deniz", "deniz@gmail.com", UserProfile.Role.ADMIN),
    ("requester.demo", "requester.demo@example.com", UserProfile.Role.REQUESTER),
    ("technician.demo", "technician.demo@example.com", UserProfile.Role.TECHNICIAN),
    ("idari.mali.manager", "idari.mali.manager@example.com", UserProfile.Role.APPROVER),
]

User = get_user_model()

for username, email, role in users:
    user, _ = User.objects.get_or_create(username=username, defaults={"email": email})
    user.email = email
    user.is_active = True
    user.set_password(password)
    if role == UserProfile.Role.ADMIN:
        user.is_staff = True
        user.is_superuser = True
    user.save()
    user.profile.role = role
    user.profile.save(update_fields=["role"])

invite_user, _ = User.objects.get_or_create(
    username="e2e.invite.user",
    defaults={"email": "e2e.invite.user@example.com"},
)
invite_user.email = "e2e.invite.user@example.com"
invite_user.is_active = False
invite_user.set_unusable_password()
invite_user.save()
invite_user.profile.role = UserProfile.Role.REQUESTER
invite_user.profile.save(update_fields=["role"])

Employee.objects.update_or_create(
    user=invite_user,
    defaults={
        "full_name": "E2E Invite User",
        "email": "e2e.invite.user@example.com",
        "imported_from_excel": True,
        "is_active": True,
    },
)
UserInvitation.objects.filter(user=invite_user).delete()

cache.clear()
print("E2E smoke users prepared.")
"@

[System.IO.File]::WriteAllText(
    $prepareScript,
    $pythonCode,
    [System.Text.UTF8Encoding]::new($false)
)
try {
    & docker compose exec -T backend python manage.py shell -c "exec(open('/app/.e2e_prepare_smoke_users.py', encoding='utf-8').read())"
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    if (Test-Path -LiteralPath $prepareScript) {
        Remove-Item -LiteralPath $prepareScript -Force
    }
}

Write-Step "Playwright smoke suite calistiriliyor."
Push-Location $frontendDir
try {
    & $NodePath $playwrightCli test
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
