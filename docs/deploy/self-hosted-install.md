# Self-hosted Kurulum Rehberi

## 1. Kapsam

Bu rehber IT Envanter & Yönetim Platformu'nun self-hosted, single-tenant kurulumu için hazırlanmıştır. Amaç başka bir makinede repo clone, environment hazırlığı, Docker Compose servisleri, migration, ilk admin hesabı, frontend/backend erişimi, backup doğrulaması ve smoke test adımlarını anlaşılır hale getirmektir.

Bu rehber SaaS/multi-tenant deploy kapsamı değildir. Gerçek production yayını yapmadan önce `docs/operations/production-readiness.md` mutlaka okunmalıdır. Production domain, TLS sertifikası, reverse proxy, secret yönetimi ve offsite backup kurum ortamına göre ayrıca tamamlanmalıdır.

## 2. Gereksinimler

### Windows

- Docker Desktop.
- Git.
- PowerShell.
- Node.js; frontend local development veya build alınacaksa gerekir.
- Modern browser.

### Linux

- Docker Engine.
- Docker Compose plugin.
- Git.
- Node.js; frontend local development veya build alınacaksa gerekir.
- PowerShell Core; mevcut backup scriptleri PowerShell ile çalıştırılacaksa gerekir.

Linux production için backup scriptleri ileride native bash sürümlerine taşınabilir. Bu checkpoint'te mevcut operasyon scriptleri PowerShell tabanlıdır.

## 3. Repo Clone

```powershell
git clone <repo-url>
cd it-inventory-platform
```

Release tag ile kurulacaksa:

```powershell
git fetch --tags
git checkout v0.1.0-demo
```

Tag checkout sonrası geliştirme yapılacaksa ayrı branch açılması önerilir.

## 4. Environment Hazırlığı

`.env` dosyası repoya commitlenmez. İlk kurulum için örnek dosyadan başlanabilir:

```powershell
Copy-Item .\.env.example .\.env
```

Linux:

```bash
cp .env.example .env
```

Production'a yakın kurulumda `docs/deploy/env.production.example` dosyasındaki placeholder yaklaşımı kullanılabilir. Bu dosya gerçek secret içermez; değerler hedef ortamda üretilip `.env` içine yazılmalıdır.

Minimum kontrol edilmesi gereken değişkenler:

| Değişken | Not |
| --- | --- |
| `DJANGO_ENV` | Production için `production`. Local/dev için `local`. |
| `DJANGO_DEBUG` | Production için `False`. |
| `DJANGO_SECRET_KEY` | Güçlü ve benzersiz olmalı, repoya yazılmamalı. |
| `JWT_SIGNING_KEY` | Güçlü ve benzersiz olmalı, repoya yazılmamalı. |
| `DJANGO_ALLOWED_HOSTS` | Sadece gerçek host/domain değerleri. |
| `POSTGRES_DB` | Ortama özel veritabanı adı. |
| `POSTGRES_USER` | Minimum yetkili veritabanı kullanıcısı. |
| `POSTGRES_PASSWORD` | Güçlü secret, repoya yazılmaz. |
| `POSTGRES_HOST` | Compose içinde genelde `db`. |
| `REDIS_URL` | Compose içinde genelde `redis://redis:6379/0`. |
| `CORS_ALLOWED_ORIGINS` | Sadece güvenilir frontend originleri. |
| `CSRF_TRUSTED_ORIGINS` | Sadece güvenilir HTTPS originleri. |
| `AUTH_COOKIE_REQUIRE_ORIGIN` | Production için `true`. |
| `AUTH_COOKIE_ALLOWED_ORIGINS` | Cookie auth için izinli frontend originleri. |
| `LOGIN_THROTTLE_RATE` | Login rate limit oranı. |

Production'da HTTPS kullanılmalıdır. `backend/config/settings/production.py` refresh cookie, session cookie ve CSRF cookie için secure davranışı zorlar.

## 5. Docker Compose Modeli

Mevcut `docker-compose.yml` şu servisleri tanımlar:

- `db`: PostgreSQL 17.
- `redis`: Redis 7.
- `backend`: Django backend container'ı.

Compose dosyası local/dev ağırlıklı bir başlangıç modelidir. Frontend servis olarak compose içine alınmamıştır; frontend local geliştirme sırasında Vite ile çalıştırılır veya production'da build çıktısı kurumun tercih ettiği static hosting/reverse proxy düzeniyle servis edilir.

Servisleri başlatma:

```powershell
docker compose up -d
docker compose ps
```

Backend image yeniden build:

```powershell
docker compose build backend
docker compose up -d
```

## 6. İlk Kurulum Adımları

Backend migration:

```powershell
docker compose exec backend python manage.py migrate
```

Backend health/check:

```powershell
docker compose exec backend python manage.py check
curl.exe -i http://localhost:8000/api/health/
```

İlk admin hesabı:

```powershell
docker compose exec backend python manage.py createsuperuser
```

Admin hesabı için gerçek şifre dokümana yazılmamalı, güvenli kanaldan yönetilmelidir.

## 7. Frontend Çalıştırma ve Build

Local development:

```powershell
cd frontend
npm install
npm run dev
```

Production build kontrolü:

```powershell
cd frontend
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

Build çıktısı `frontend/dist` altında oluşur ve `.gitignore` kapsamındadır. Production'da bu çıktı reverse proxy/static hosting stratejisine göre servis edilmelidir.

## 8. Windows Kurulum Akışı

```powershell
cd C:\path\to\it-inventory-platform
Copy-Item .\.env.example .\.env
# .env dosyasını hedef ortama göre düzenleyin.

docker compose build
docker compose up -d
docker compose ps
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py check
docker compose exec backend python manage.py createsuperuser
```

Frontend local dev için:

```powershell
cd C:\path\to\it-inventory-platform\frontend
npm install
npm run dev
```

## 9. Linux Kurulum Akışı

```bash
cd /opt
git clone <repo-url> it-inventory-platform
cd it-inventory-platform
cp .env.example .env
# .env dosyasını hedef ortama göre düzenleyin.

docker compose build
docker compose up -d
docker compose ps
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py check
docker compose exec backend python manage.py createsuperuser
```

PowerShell backup scriptleri Linux üzerinde kullanılacaksa PowerShell Core kurulmalıdır:

```bash
pwsh -File ./scripts/backup/verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge
```

## 10. Reverse Proxy ve HTTPS

Production'da backend portu doğrudan public internete açılmamalıdır. Nginx, Caddy, Traefik veya kurum standardı olan bir reverse proxy ile HTTPS terminasyonu yapılmalıdır.

Reverse proxy şu başlıklara dikkat etmelidir:

- `X-Forwarded-Proto: https`
- Gerçek host header ile uyumlu `DJANGO_ALLOWED_HOSTS`.
- Frontend originleriyle uyumlu `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` ve `AUTH_COOKIE_ALLOWED_ORIGINS`.

Production settings içinde `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` tanımlıdır. HTTPS olmadan production cookie güvenliği beklenen şekilde çalışmaz.

## 11. Backup, Verify ve Restore Drill

Deploy sonrası ilk sağlıklı backup alınmalıdır:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\run_scheduled_backup.ps1 -Environment production -RetentionDays 30 -RetentionMinCount 10
```

Son backup doğrulama:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge
```

Retention dry-run:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\cleanup_old_backups.ps1 -RetentionDays 14 -RetentionMinCount 5 -DryRun
```

Restore otomatik değildir. Restore drill yalnız staging veya izole local ortamda, `scripts/backup/restore_postgres.ps1` içindeki explicit `RESTORE` onayıyla yapılmalıdır. Browser'dan backup veya restore execute edilmez.

Detaylar:

- `docs/operations/backup-restore.md`
- `docs/operations/scheduled-jobs.md`

## 12. Scheduled Job Bağlantısı

Windows için Task Scheduler, Linux için cron veya systemd timer kullanılabilir. Örnekler `docs/operations/scheduled-jobs.md` içinde tutulur.

Önerilen operasyon:

- Günlük scheduled backup.
- Backup job sonrası verify.
- Düzenli restore drill.
- Offsite ve şifreli backup kopyalama.
- Admin Console üzerinde son manifest ve stale/failed uyarılarının günlük kontrolü.

## 13. Smoke Test ve Final Kontroller

Backend:

```powershell
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend python manage.py check
docker compose exec backend python manage.py test --verbosity 1
```

Frontend:

```powershell
cd frontend
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

E2E smoke:

```powershell
cd C:\path\to\it-inventory-platform
.\scripts\e2e\run_e2e_smoke.ps1
```

E2E smoke runner sadece local/dev içindir; production ortamda çalıştırılmamalıdır.

Manuel demo smoke adımları için `docs/demo/manual-smoke-script.md` ve `docs/demo/final-qa-checklist.md` kullanılmalıdır.

## 14. Admin Console Deploy Sonrası Kontrol

Admin kullanıcı `/admin-console` üzerinden şu sinyalleri kontrol etmelidir:

- Database ve Redis/cache health.
- Environment ve DEBUG/security uyarıları.
- Son backup manifest status.
- Import, invitation, ticket, reminder ve audit sinyalleri.
- Admin Users bağlantı ve güvenli aksiyon durumları.

Admin Console komutları browser'dan çalıştırmaz; yalnızca güvenli, secret içermeyen rehber komutları kopyalanabilir şekilde gösterir.

## 15. Güvenlik Notları

- Gerçek secret, şifre, token, token hash, DB password, connection string veya private key repoya yazılmamalıdır.
- `.env` commitlenmemelidir.
- Backup artifactleri commitlenmemelidir.
- Demo kullanıcıları production'da kaldırılmalı, kapatılmalı veya şifreleri değiştirilmelidir.
- Last active admin guard korunmalıdır.
- User delete, password reset ve bulk destructive action bu checkpoint kapsamına dahil değildir.
- Production deploy öncesi `docs/operations/production-readiness.md` checklist'i tamamlanmalıdır.

## 16. Troubleshooting

### Docker servisleri ayakta değil

```powershell
docker compose ps
docker compose up -d
docker compose logs --tail 100 backend
```

### Migration veya check hata veriyor

```powershell
docker compose exec backend python manage.py showmigrations
docker compose exec backend python manage.py check
```

### Redis/cache hatası

`.env` içindeki `REDIS_URL` değerini ve `redis` service durumunu kontrol edin.

### Cookie veya login sorunu

Production'da HTTPS, `AUTH_COOKIE_REQUIRE_ORIGIN`, `AUTH_COOKIE_ALLOWED_ORIGINS`, `CORS_ALLOWED_ORIGINS` ve `CSRF_TRUSTED_ORIGINS` değerlerinin aynı frontend origin ile uyumlu olduğundan emin olun.

### Backup verify failed/stale

Scheduled backup runner loglarını ve son manifest durumunu kontrol edin. Sağlıklı backup üretmeden restore denemesi yapılmamalıdır.

## 17. İlgili Dokümanlar

- `README.md`
- `docs/operations/production-readiness.md`
- `docs/operations/backup-restore.md`
- `docs/operations/scheduled-jobs.md`
- `docs/operations/admin-console.md`
- `docs/operations/e2e-smoke.md`
- `docs/demo/manual-smoke-script.md`
- `docs/demo/final-qa-checklist.md`
- `docs/demo/release-notes-v0.1.0-demo.md`

