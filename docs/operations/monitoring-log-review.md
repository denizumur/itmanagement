# Lightweight Monitoring & Log Review Rehberi

## 1. Kapsam

Bu rehber self-hosted kurulumda ağır monitoring altyapısı kurmadan Docker logs, Admin Console, health check, backup manifest, smoke test ve CI sinyalleriyle sistemin temel sağlığını izlemek için hazırlanmıştır.

Bu faz Prometheus, Grafana, Sentry veya ELK alternatifi değildir. MVP/self-hosted kurulum için hafif operasyonel gözlem yaklaşımıdır. Production ortamında merkezi loglama, alerting ve uptime monitoring ileride ayrıca eklenebilir. Demo ve küçük şirket içi kullanım için ilk seviye kontrol mekanizması olarak düşünülmelidir.

## 2. Temel Sağlık Sinyalleri

| Sinyal | Nereden Bakılır | Sağlıklı Durum | Sorun Göstergesi |
| --- | --- | --- | --- |
| Container durumu | `docker compose ps` | `backend`, `db`, `redis` running | exited, restarting, unhealthy |
| Backend health | `/api/health/` veya `manage.py check` | 200 / no issues | 500, timeout, connection error |
| DB bağlantısı | backend logs / Admin Console | DB OK | connection refused, auth failed, migration error |
| Redis bağlantısı | backend logs / Admin Console | cache OK | redis connection refused, cache backend error |
| Auth/cookie | browser devtools + backend logs | login/refresh başarılı | 401, 403, CSRF, origin errors |
| Backup | `verify_latest_backup.ps1` | healthy/recent | stale, missing, failed, partial |
| Email delivery | Admin Users result / backend logs | sent veya bilinçli skipped | failed, SMTP auth/config/TLS error |
| E2E smoke | `scripts/e2e/run_e2e_smoke.ps1` | all passed | failed route/action, browser setup error |
| CI | GitHub Actions | green | red build/test/check |
| Disk alanı | host monitoring / Docker volume kontrolü | yeterli boş alan | DB, media veya backup alanı doluyor |
| Audit yoğunluğu | Admin Console / Audit sayfası | beklenen operasyon sayıları | beklenmeyen kritik audit artışı |

## 3. Docker Logs Komutları

Windows PowerShell:

```powershell
cd C:\Users\deniz\it-inventory-platform

docker compose ps

docker compose logs --tail=200 backend
docker compose logs --tail=200 db
docker compose logs --tail=200 redis

docker compose logs -f --tail=200 backend
```

Linux:

```bash
cd /opt/it-inventory-platform

docker compose ps

docker compose logs --tail=200 backend
docker compose logs --tail=200 db
docker compose logs --tail=200 redis

docker compose logs -f --tail=200 backend
```

Log paylaşırken secret, cookie, token, authorization header, DB password, connection string, raw activation URL ve gereksiz PII temizlenmelidir.

## 4. Backend 500 Hataları

İlk kontrol:

```powershell
docker compose logs --tail=300 backend
docker compose exec backend python manage.py check
curl.exe -i http://localhost:8000/api/health/
```

Triage soruları:

- Hata sadece belirli endpointte mi, tüm backend mi etkileniyor?
- Aynı anda DB veya Redis bağlantı hatası var mı?
- Son deploy, migration veya `.env` değişikliği yapıldı mı?
- Hata admin-only ekranda mı, portal ekranında mı?
- Browser Network tab içinde status code ve response gövdesi ne söylüyor?

500 hatası kullanıcı verisi veya secret içeren loglarla paylaşılmamalıdır. Önce stack trace içinde hassas değer olup olmadığı kontrol edilmelidir.

## 5. Auth / Cookie / Origin Debug

Production'a yakın ortamda auth sorunlarının çoğu origin, HTTPS veya cookie ayarıyla ilgilidir.

Kontrol listesi:

- `DJANGO_ENV=production`.
- `DJANGO_DEBUG=False`.
- HTTPS aktif.
- Reverse proxy `X-Forwarded-Proto: https` gönderiyor.
- `DJANGO_ALLOWED_HOSTS` gerçek host ile uyumlu.
- `CORS_ALLOWED_ORIGINS` frontend originini içeriyor.
- `CSRF_TRUSTED_ORIGINS` frontend HTTPS originini içeriyor.
- `AUTH_COOKIE_ALLOWED_ORIGINS` frontend originini içeriyor.
- `AUTH_COOKIE_REQUIRE_ORIGIN=true`.
- Browser devtools Application/Cookies alanında refresh cookie set ediliyor.
- Network tab içinde login, refresh ve logout response statusları beklenen aralıkta.

Yaygın belirtiler:

- 401: access token eksik/süresi geçmiş olabilir.
- 403: RBAC veya CSRF/origin kontrolü olabilir.
- Cookie set edilmiyor: HTTPS, SameSite, domain/path veya reverse proxy kontrol edilmeli.
- Refresh çalışmıyor: Origin allow-list ve cookie gönderimi kontrol edilmeli.

## 6. DB ve Redis Bağlantı Sorunları

DB:

```powershell
docker compose ps
docker compose logs --tail=200 db
docker compose logs --tail=200 backend
docker compose exec backend python manage.py showmigrations
docker compose exec backend python manage.py check
```

Kontrol edilecekler:

- `db` container running mi?
- `.env` içindeki `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` ve `POSTGRES_PORT` compose ile uyumlu mu?
- Migration eksikliği var mı?
- Disk alanı dolu mu?

Redis:

```powershell
docker compose ps
docker compose logs --tail=200 redis
docker compose logs --tail=200 backend
```

Kontrol edilecekler:

- `redis` container running mi?
- `REDIS_URL` compose service adıyla uyumlu mu?
- Admin Console cache/Redis sinyali sağlıklı mı?
- Login rate limiting davranışı beklenenden farklı mı?

## 7. Backup Job Başarısızlığı

İlk bakılacak komutlar:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\run_scheduled_backup.ps1 -Environment production -RetentionDays 30 -RetentionMinCount 10
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\cleanup_old_backups.ps1 -RetentionDays 14 -RetentionMinCount 5 -DryRun
```

Kontrol listesi:

- Docker servisleri running mi?
- PostgreSQL backup dosyası oluşmuş ve boyutu sıfırdan büyük mü?
- Media backup bekleniyor mu, yoksa media yokluğu kontrollü skip mi?
- Manifest status `success`, `partial` veya `failed` mı?
- Backup yaşı kabul edilebilir mi?
- Retention cleanup yanlış dosyaları hedefliyor mu?
- Offsite kopyalama ayrıca başarısız olmuş olabilir mi?

Restore, backup üretim hatasını çözmek için kullanılmaz. Önce sağlıklı backup üretimi ve verify başarıya dönmelidir.

## 8. Admin Console Health Sinyalleri

`/admin-console` ekranı admin kullanıcıya şu sinyalleri özetler:

- Sistem sağlığı: database, Redis/cache, environment ve DEBUG/security uyarıları.
- Backup health: son manifest, backup yaşı, status, warning/error sayısı.
- Davet ve aktivasyon: pending/expired invitation ve aktivasyon bekleyen kullanıcı sayıları.
- Personel import: son import status, created/error/warning count.
- Operasyon: son audit sayıları, açık/acil ticket, geciken reminder.

Yorumlama:

- Healthy backup, günlük operasyonun bittiği anlamına gelmez; verify ve offsite kopyalama ayrıca takip edilmelidir.
- Unknown/stale/failed backup durumunda scheduled job ve backup runbook kontrol edilir.
- Redis/cache uyarısı login throttle ve performans davranışını etkileyebilir.
- Kritik audit artışı admin action, import veya ticket akışında beklenmeyen yoğunluk gösterebilir.

Admin Console browser'dan backup, restore, cleanup veya destructive action çalıştırmaz. Copy command yalnızca terminale taşınacak güvenli komut metnidir.

## 9. Email Delivery Debug

Invitation email delivery, davet state'inin ana kaynağı değildir. Email failed veya skipped olsa bile invitation geçerli kalabilir ve admin manual copy fallback kullanabilir.

Kontrol edilecek safe reason kategorileri:

- `email_disabled`: `INVITATION_EMAIL_ENABLED=False`; SMTP kapalıdır.
- `missing_recipient_email`: hedef kullanıcıda e-posta yoktur.
- `smtp_config_missing`: SMTP host/sender/secret yapılandırması eksik olabilir.
- `smtp_auth_failed`: SMTP kimlik doğrulaması başarısızdır.
- `connection_timeout`: SMTP sağlayıcısına bağlantı zaman aşımına uğramıştır.
- `smtp_error`: SMTP backend genel hata dönmüştür.
- `send_failed`: sınıflandırılamayan güvenli gönderim hatasıdır.

Debug checklist:

- [ ] `.env` içinde `INVITATION_EMAIL_ENABLED` beklenen değerde.
- [ ] `EMAIL_BACKEND` production'da SMTP backend'e işaret ediyor.
- [ ] `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER` ve secret kaynağı hedef ortamda doğru.
- [ ] `EMAIL_USE_TLS` ve `EMAIL_USE_SSL` aynı anda true değil.
- [ ] `DEFAULT_FROM_EMAIL` verified sender/domain.
- [ ] `APP_FRONTEND_URL` gerçek frontend origin ile uyumlu.
- [ ] Backend loglarında raw activation URL, raw token, email body veya SMTP secret yok.
- [ ] Admin Users result kartında sent/failed/skipped mesajı okunabilir.

## 10. Demo Öncesi Log Review Checklist

- [ ] `docker compose ps` içinde `backend`, `db`, `redis` running.
- [ ] `docker compose logs --tail=200 backend` içinde yeni 500 stack trace yok.
- [ ] `docker compose logs --tail=200 db` içinde auth/disk/restart hatası yok.
- [ ] `docker compose logs --tail=200 redis` içinde bağlantı/restart hatası yok.
- [ ] `docker compose exec backend python manage.py check` geçiyor.
- [ ] `/api/health/` 200 dönüyor.
- [ ] Backup verify healthy.
- [ ] E2E smoke local/dev ortamda geçti.
- [ ] Admin Console backup/system/security sinyalleri okunabilir.
- [ ] Demo kullanıcıları production ortamda kullanılmıyor.
- [ ] Browser devtools Network tab içinde login/refresh/logout beklenen statuslarla dönüyor.
- [ ] Invitation email delivery disabled/enabled durumu demo anlatımıyla uyumlu.

## 11. Demo Sonrası Log Review Checklist

- [ ] Backend loglarında demo sırasında oluşan 500 hata yok.
- [ ] Ticket, activation, import veya admin user action akışlarında beklenmeyen 403/500 yok.
- [ ] Audit log demo aksiyonlarını beklenen entity/action ile gösteriyor.
- [ ] Admin Console son backup ve system health sinyalleri değişmedi.
- [ ] E2E veya manuel smoke sonrası production veri reseti yapılmadı.
- [ ] Paylaşılacak loglarda secret, token, cookie veya kişisel veri temizlendi.
- [ ] Davet email delivery sonuçları raw activation URL paylaşmadan yorumlandı.

## 12. Incident Triage Yaklaşımı

1. Etkiyi sınıflandır: tüm sistem mi, tek rol mü, tek modül mü?
2. Son değişikliği belirle: deploy, `.env`, migration, backup job veya veri import.
3. Health sinyallerini kontrol et: container, backend health, DB, Redis.
4. İlgili logları oku: önce backend, sonra DB/Redis.
5. Kullanıcı akışını ayır: auth/RBAC mı, veri/validation mı, altyapı mı?
6. Geri dönüş kararını ver: config düzeltme, servis restart, rollback veya restore drill.
7. Audit ve backup durumunu doğrula.
8. Olay notu çıkar: zaman, etki, semptom, kök neden, alınan aksiyon, takip işi.

Rollback veya restore kararı verilmeden önce güncel ve doğrulanmış backup varlığı kontrol edilmelidir. Restore production DB üzerinde doğrudan denenmez; explicit `RESTORE` onayı ve izole/staging yaklaşımı korunur.

## 13. Hafif Monitoring Rutini

Günlük:

- Admin Console system/backup/operations sinyallerini kontrol et.
- `verify_latest_backup.ps1` sonucunu kontrol et.
- Backend loglarında yeni 500 hata var mı bak.
- Açık/acil ticket ve geciken reminder sayılarını kontrol et.

Haftalık:

- Full backend test veya en az smoke test çalıştır.
- Retention cleanup dry-run sonucunu kontrol et.
- Restore drill planını ve son başarılı drill tarihini gözden geçir.
- Admin user action audit kayıtlarını review et.
- Invitation email failed/skipped reason kodlarını örnek olarak kontrol et.

Deploy öncesi:

- `makemigrations --check --dry-run`.
- `manage.py check`.
- Frontend typecheck/build.
- Backup al ve verify et.
- Manual/E2E smoke planını netleştir.

Deploy sonrası:

- `/api/health/`.
- Login/refresh/logout.
- Admin Console health.
- Backup verify.
- Kritik sayfalar: `/assets`, `/personnel`, `/tickets`, `/admin-console`, `/audit`.

## 14. İlgili Dokümanlar

- `README.md`
- `docs/deploy/self-hosted-install.md`
- `docs/operations/production-readiness.md`
- `docs/operations/backup-restore.md`
- `docs/operations/scheduled-jobs.md`
- `docs/operations/admin-console.md`
- `docs/operations/email-invitation-delivery.md`
- `docs/operations/e2e-smoke.md`
- `docs/demo/manual-smoke-script.md`
- `docs/demo/final-qa-checklist.md`
- `docs/demo/known-issues-and-limitations.md`
