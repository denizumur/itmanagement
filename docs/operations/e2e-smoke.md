# E2E Smoke Testleri

Bu dokuman local/dev ortamda calisan minimum Playwright smoke test altyapisini anlatir. Bu testler production credential istemez ve production DB uzerinde destructive test olarak calistirilmamalidir.

## Amac

P6 smoke paketi her deploy veya refactor sonrasi su sorulari hizli cevaplamak icindir:

- Backend health endpoint ayakta mi?
- Frontend login ekrani aciliyor mu?
- Kritik roller login olabiliyor mu?
- Admin operasyon sayfalari render oluyor mu?
- Personel Excel export dosya olarak iniyor mu?
- Requester, approver ve technician portallari temel olarak aciliyor mu?
- Logout calisiyor mu?

Bu paket exhaustive E2E suite degildir.

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

## Local calistirma

Tercih edilen runner:

```powershell
cd C:\Users\deniz\it-inventory-platform
.\scripts\e2e\run_e2e_smoke.ps1
```

Node PATH'te degilse:

```powershell
.\scripts\e2e\run_e2e_smoke.ps1 -NodePath C:\path\to\node.exe
```

Runner local/dev icin:

1. `docker compose up -d` calistirir.
2. `python manage.py check` calistirir.
3. Smoke kullanicilarinin sifrelerini `E2ePass123!` yapar.
4. Django cache'i temizler.
5. Frontend Playwright smoke suite'ini calistirir.

Bu sifre production secret degildir; sadece local/dev smoke icindir.

Manuel calistirma:

```powershell
cd C:\Users\deniz\it-inventory-platform\frontend
node node_modules/@playwright/test/cli.js test
```

## Smoke kullanicilari

- Admin: `deniz`
- Requester: `requester.demo`
- Technician: `technician.demo`
- Approver: `idari.mali.manager`
- Local/dev smoke sifresi: `E2ePass123!`

## Test edilen akislar

- Backend `/api/health/` 200.
- Login screen boot.
- Admin login.
- Admin navigation: `/assets`, `/personnel`, `/licenses`, `/maintenance`, `/assignments`, `/reminders`, `/audit`, `/tickets`.
- Personnel Excel export download: dosya adi `.xlsx`, dosya bos degil, ilk bytes `PK`.
- Requester `/my-tickets` portal ve talep formuna erisim.
- Approver `/approvals` portal render.
- Technician `/tickets` inbox render.
- Logout ve protected page redirect.

## Test edilmeyen akislar

- Derin ticket create/approve/reject workflow.
- Internal note gonderimi.
- Media upload.
- Production reverse proxy.
- Login throttle E2E; bu P3c backend regression testleriyle korunur.

Ticket create flow P6'da bilerek form gorunurlugu seviyesinde tutuldu. Full create/cleanup akisi ileride daha stabil data factory veya API cleanup ile eklenmelidir.

## Troubleshooting

### Backend kapali

```powershell
docker compose ps
docker compose up -d
docker compose exec backend python manage.py check
```

### Frontend port 5173 kullaniliyor

Playwright config mevcut Vite server'i reuse eder. Port doluysa kapatin veya `E2E_FRONTEND_URL` ile farkli URL verin.

### Playwright browser eksik

```powershell
cd frontend
node node_modules/@playwright/test/cli.js install chromium
```

### Login 429 cache yuzunden

Runner `cache.clear()` calistirir. Manuel calistirmada backend cache temizlenmemisse:

```powershell
docker compose exec backend python manage.py shell -c "from django.core.cache import cache; cache.clear()"
```

### Selector kirildi

Oncelik accessible role/name selector'laridir. Kritik ve kirilgan yerlerde minimal `data-testid` kullanilir:

- `login-username`
- `login-password`
- `login-submit`
- `app-shell`
- `portal-shell`
- `personnel-export-excel`
- `ticket-inbox`

### Download path problemi

Excel export testi dosyayi Excel ile acmaz. Playwright download stream'ini okuyup ZIP signature olan `PK` ile basladigini kontrol eder.

## CI entegrasyonu durumu

P6 ve P6b'de CI job eklenmedi. Once local smoke stabilitesi, audit temizligi ve artifact ignore guvencesi hedeflendi. CI entegrasyonu P6c veya ayri bir fazda Docker Compose servisleri, browser install cache ve artifact upload politikasi netlestirilerek eklenmelidir.

## npm audit notu

P6b'de `npm audit` incelendi. High severity uyarilar `brace-expansion`, `postcss` ve `react-router` paketlerinden geliyordu. `npm audit fix` force kullanmadan calistirildi ve package-lock seviyesinde semver uyumlu guncellemelerle audit sonucu 0 vulnerability oldu.

## Artifact ignore notu

Playwright runtime artifactleri git'e girmemelidir. `frontend/.gitignore` su dizinleri ignore eder:

- `test-results`
- `playwright-report`
- `blob-report`
- `e2e-results`
- `screenshots`
- `videos`
- `traces`

## Production uyarisi

Bu suite production ortamda calistirilmak icin tasarlanmamistir. Runner local/dev kullanici sifrelerini resetler. Production'da kullanmayin.
