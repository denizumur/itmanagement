# E2E Smoke Testleri

Bu doküman local/dev ortamda çalışan minimum Playwright smoke test altyapısını anlatır. Bu testler production credential istemez ve production DB üzerinde destructive test olarak çalıştırılmamalıdır.

## Amaç

P6 smoke paketi her deploy veya refactor sonrası şu soruları hızlı cevaplamak içindir:

- Backend health endpoint ayakta mı?
- Frontend login ekranı açılıyor mu?
- Kritik roller login olabiliyor mu?
- Admin operasyon sayfaları render oluyor mu?
- Personel Excel export dosya olarak iniyor mu?
- Davet linki ile inactive kullanıcı aktivasyonu çalışıyor mu?
- Talep sahibi, Onaycı ve Teknisyen portalları temel olarak açılıyor mu?
- Logout çalışıyor mu?

Bu paket exhaustive E2E suite değildir.

## Gereksinimler

- Docker Compose.
- Backend, PostgreSQL ve Redis servisleri.
- Frontend dependencies.
- Playwright Chromium browser kurulumu.

Browser eksikse:

```powershell
cd C:\Users\deniz\it-inventory-platform\frontend
node node_modules/@playwright/test/cli.js install chromium
```

## Local çalıştırma

Tercih edilen runner:

```powershell
cd C:\Users\deniz\it-inventory-platform
.\scripts\e2e\run_e2e_smoke.ps1
```

Node PATH'te değilse:

```powershell
.\scripts\e2e\run_e2e_smoke.ps1 -NodePath C:\path\to\node.exe
```

Runner local/dev için:

1. `docker compose up -d` çalıştırır.
2. `python manage.py check` çalıştırır.
3. Smoke kullanıcılarının şifrelerini `E2ePass123!` yapar.
4. Django cache'i temizler.
5. Inactive/unusable `e2e.invite.user` kullanıcısını ve bağlı personel kaydını hazırlar.
6. Frontend Playwright smoke suite'ini çalıştırır.

Bu şifre production secret değildir; sadece local/dev smoke içindir.

Manuel çalıştırma:

```powershell
cd C:\Users\deniz\it-inventory-platform\frontend
node node_modules/@playwright/test/cli.js test
```

## Smoke kullanıcıları

- Admin: `deniz`
- Talep sahibi: `requester.demo`
- Teknisyen: `technician.demo`
- Onaycı: `idari.mali.manager`
- Invitation smoke: `e2e.invite.user`
- Local/dev smoke şifresi: `E2ePass123!`

## Test edilen akışlar

- Backend `/api/health/` 200.
- Login screen boot.
- Admin login.
- Admin navigation: `/assets`, `/personnel`, `/licenses`, `/maintenance`, `/assignments`, `/reminders`, `/audit`, `/tickets`.
- Personnel Excel export download: dosya adı `.xlsx`, dosya boş değil, ilk bytes `PK`.
- Talep sahibi `/my-tickets` portal ve talep formuna erişim.
- Onaycı `/approvals` portal render.
- Teknisyen `/tickets` inbox render.
- Logout ve protected page redirect.
- Admin API ile `e2e.invite.user` için activation link üretimi.
- `/activate-account?token=...` sayfasında şifre belirleme.
- Aktive edilen kullanıcının login olabilmesi.
- Aynı activation token'ın tekrar kullanılamaması.

## Test edilmeyen akışlar

- Derin ticket create/approve/reject workflow.
- İç not gönderimi.
- Media upload.
- Production reverse proxy.
- Login throttle E2E; bu P3c backend regression testleriyle korunur.
- Email invitation delivery; P7d sadece link üretme/aktivasyon smoke yapar.

Ticket create flow P6'da bilerek form görünürlüğü seviyesinde tutuldu. Full create/cleanup akışı ileride daha stabil data factory veya API cleanup ile eklenmelidir.

## Troubleshooting

### Backend kapalı

```powershell
docker compose ps
docker compose up -d
docker compose exec backend python manage.py check
```

### Frontend port 5173 kullanılıyor

Playwright config mevcut Vite server'ı reuse eder. Port doluysa kapatın veya `E2E_FRONTEND_URL` ile farklı URL verin.

### Playwright browser eksik

```powershell
cd frontend
node node_modules/@playwright/test/cli.js install chromium
```

### Login 429 cache yüzünden

Runner `cache.clear()` çalıştırır. Manuel çalıştırmada backend cache temizlenmemişse:

```powershell
docker compose exec backend python manage.py shell -c "from django.core.cache import cache; cache.clear()"
```

### Activation smoke token expired/reused

Runner her çalışmada `e2e.invite.user` için eski davetleri temizler ve kullanıcıyı tekrar inactive/unusable hale getirir. Manuel çalıştırmada eski token kullanıldıysa `/activate-account` hata gösterir; runner'ı tekrar çalıştırın.

### Activation password validation

Backend Django password validators çalıştırır. Smoke şifresi runner tarafından güçlü üretilir; manuel testte zayıf şifre 400 hata döndürür.

### Invite user cleanup

Runner `e2e.invite.user` ve `E2E Invite User` personel kaydını local/dev DB'de ayırt edilebilir prefix ile tutar. Production guard nedeniyle production ortamda çalışmaz.

### Selector kırıldı

Öncelik accessible role/name selector'larıdır. Kritik ve kırılgan yerlerde minimal `data-testid` kullanılır:

- `login-username`
- `login-password`
- `login-submit`
- `app-shell`
- `portal-shell`
- `personnel-export-excel`
- `ticket-inbox`
- `activate-account-password`
- `activate-account-password-confirm`
- `activate-account-submit`
- `activate-account-success`
- `activate-account-error`

### Download path problemi

Excel export testi dosyayı Excel ile açmaz. Playwright download stream'ini okuyup ZIP signature olan `PK` ile başladığını kontrol eder.

## CI entegrasyonu durumu

P6 ve P6b'de CI job eklenmedi. Önce local smoke stabilitesi, audit temizliği ve artifact ignore güvencesi hedeflendi. CI entegrasyonu P6c veya ayrı bir fazda Docker Compose servisleri, browser install cache ve artifact upload politikası netleştirilerek eklenmelidir.

## npm audit notu

P6b'de `npm audit` incelendi. High severity uyarılar `brace-expansion`, `postcss` ve `react-router` paketlerinden geliyordu. `npm audit fix` force kullanmadan çalıştırıldı ve package-lock seviyesinde semver uyumlu güncellemelerle audit sonucu 0 vulnerability oldu.

## Artifact ignore notu

Playwright runtime artifactleri git'e girmemelidir. `frontend/.gitignore` şu dizinleri ignore eder:

- `test-results`
- `playwright-report`
- `blob-report`
- `e2e-results`
- `screenshots`
- `videos`
- `traces`

## Production uyarisi

Bu suite production ortamda çalıştırılmak için tasarlanmamıştır. Runner local/dev kullanıcı şifrelerini resetler. Production'da kullanmayın.
