# Production Readiness ve Deploy Runbook

Bu doküman IT Envanter ve Yönetim Platformu'nun şirket içi sunucu veya VPS üzerinde Docker Compose ile production'a yakın, güvenli ve tekrarlanabilir şekilde çalıştırılması için hazırlanmıştır.

## 1. Amaç ve kapsam

Bu doküman şu konuları kapsar:

- Production ortamı için minimum kurulum ve güvenlik kontrolleri.
- Docker Compose tabanlı deploy akışı.
- Environment değişkenleri ve güvenli varsayımlar.
- Healthcheck, smoke test, rollback ve backup bağlantıları.

Local development ortamı hızlı geliştirme içindir. Production ortamında `DEBUG=False`, HTTPS, güvenilir CORS/CSRF originleri, Redis-backed cache, güçlü secret değerleri, düzenli backup ve kontrollü restore drill zorunlu kabul edilmelidir.

## 2. Servis mimarisi

Platformun temel bileşenleri:

- Backend: Django REST API.
- Frontend: React/Vite static build.
- PostgreSQL: kalıcı iş verisi.
- Redis: shared cache ve login rate limiting storage.
- Media storage: `backend/media` altındaki runtime upload dosyaları.
- Backup storage: `backups/postgres` ve `backups/media` veya production'da harici güvenli storage.
- Reverse proxy / HTTPS: Nginx, Caddy, Traefik veya eşdeğeri.
- İleride opsiyonel: worker/scheduler, otomatik backup job, monitoring agent.

Basit akış:

```text
Client Browser
  -> Reverse Proxy / HTTPS
  -> Frontend static build
  -> Backend API
  -> PostgreSQL
  -> Redis
  -> Media storage
  -> Backup storage
```

## 3. Production minimum sistem gereksinimleri

Başlangıç önerisi:

- Küçük şirket demo veya ilk production kullanımı: 2 vCPU, 4 GB RAM, 30+ GB disk.
- Daha yoğun kullanımda CPU, RAM ve disk artırılmalıdır.
- Docker ve Docker Compose kurulu olmalıdır.
- Disk alanı PostgreSQL verisi, media uploadları, loglar ve backup retention için ayrıca planlanmalıdır.
- Backup dosyaları mümkünse uygulama sunucusundan farklı ve güvenli bir storage üzerinde saklanmalıdır.

Bu değerler kesin gereksinim değil, başlangıç önerisidir. Gerçek ihtiyaç kullanıcı sayısı, ticket eki hacmi, audit yoğunluğu ve backup saklama politikasına göre değişir.

## 4. Environment checklist

Production `.env` dosyası gerçek secret içermelidir; repoya commitlenmemelidir. Aşağıdaki değerler `.env.example` üzerinden hazırlanmalıdır.

| Değişken | Ne işe yarar? | Production yaklaşımı | Placeholder örnek |
| --- | --- | --- | --- |
| `DJANGO_ENV` | Settings modunu seçer. | `production` olmalı. | `production` |
| `DJANGO_SECRET_KEY` | Django imzalama ve güvenlik anahtarı. | Güçlü, benzersiz, gizli tutulmalı. | `CHANGE_ME_STRONG_SECRET` |
| `JWT_SIGNING_KEY` | JWT imzalama anahtarı. | Güçlü, benzersiz, gizli tutulmalı. | `CHANGE_ME_STRONG_JWT_KEY` |
| `DJANGO_DEBUG` | Debug modunu yönetir. | `False` olmalı. | `False` |
| `DJANGO_ALLOWED_HOSTS` | Kabul edilen host/domain listesi. | Sadece production domainleri. | `it.example.com` |
| `POSTGRES_DB` | PostgreSQL veritabanı adı. | Ortama özel net isim. | `it_inventory` |
| `POSTGRES_USER` | PostgreSQL kullanıcı adı. | Minimum yetkili servis kullanıcısı. | `it_inventory_user` |
| `POSTGRES_PASSWORD` | PostgreSQL şifresi. | Güçlü secret, repoya yazılmaz. | `CHANGE_ME_DB_PASSWORD` |
| `POSTGRES_HOST` | DB host/service adı. | Compose içinde genelde `db`. | `db` |
| `POSTGRES_PORT` | DB portu. | Varsayılan genelde `5432`. | `5432` |
| `CORS_ALLOWED_ORIGINS` | Frontend origin izinleri. | Sadece HTTPS production originleri. | `https://it.example.com` |
| `CSRF_TRUSTED_ORIGINS` | CSRF trusted originleri. | Sadece HTTPS production originleri. | `https://it.example.com` |
| `AUTH_COOKIE_ALLOWED_ORIGINS` | Cookie auth Origin allow-list. | Frontend HTTPS origini ile sınırlı. | `https://it.example.com` |
| `AUTH_COOKIE_REQUIRE_ORIGIN` | Cookie auth için Origin zorunluluğu. | `true` olmalı. | `true` |
| `REDIS_URL` | Redis cache/rate limit storage. | Shared Redis service kullanılmalı. | `redis://redis:6379/0` |
| `LOGIN_THROTTLE_RATE` | Login rate limit oranı. | Kuruma göre ayarlanabilir. | `5/5m` |
| `BACKEND_PORT` | Lokal/host backend port mapping. | Reverse proxy arkasında sınırlı tutulmalı. | `8000` |

Not: `REFRESH_TOKEN_COOKIE_SECURE` production settings içinde explicit `True` olarak ayarlanmıştır. Ayrı env değişkeni şu an yoktur; HTTPS olmadan production kullanılmamalıdır.

Frontend API URL değişkeni repo içinde ayrı env olarak görünmüyor; frontend HTTP client mevcut deploy topolojisine göre kontrol edilmelidir.

## 5. Security readiness checklist

- [ ] `DJANGO_ENV=production`.
- [ ] `DJANGO_DEBUG=False`.
- [ ] Güçlü `DJANGO_SECRET_KEY`.
- [ ] Güçlü `JWT_SIGNING_KEY`.
- [ ] HTTPS aktif.
- [ ] Refresh cookie `httpOnly`.
- [ ] Production refresh cookie `secure`.
- [ ] SameSite ayarı bilinçli: mevcut ayar `Lax`.
- [ ] `AUTH_COOKIE_REQUIRE_ORIGIN=True`.
- [ ] `CORS_ALLOWED_ORIGINS` sadece güvenilir HTTPS originleri.
- [ ] `CSRF_TRUSTED_ORIGINS` sadece güvenilir HTTPS domainleri.
- [ ] `AUTH_COOKIE_ALLOWED_ORIGINS` sadece frontend production origini.
- [ ] Redis shared cache aktif.
- [ ] Login throttle aktif ve testli.
- [ ] Admin kullanıcı sayısı kontrol edildi.
- [ ] Default/demo kullanıcılar production'da kaldırıldı veya şifreleri değiştirildi.
- [ ] Backup dosyaları repo dışında ve güvenli yerde saklanıyor.
- [ ] Backup dosyalarının kişisel/kurumsal veri içerebileceği kabul edildi.
- [ ] Audit log production'da açık ve erişimi yetki kontrollü.

## 6. Docker Compose production notları

Mevcut `docker-compose.yml` local/dev ağırlıklı bir başlangıç dosyasıdır. Production için şu noktalar ayrıca değerlendirilmelidir:

- Backend image deploy öncesi yeniden build edilmeli: `docker compose build backend`.
- `.env` production değerleriyle hazırlanmalı ve repoya commitlenmemeli.
- PostgreSQL volume kalıcı olmalı ve düzenli backup alınmalı.
- `backend/media` için kalıcı volume veya host mount stratejisi belirlenmeli.
- Backup output dizini uygulama sunucusunda kalıcı olmalı; ayrıca harici storage'a kopyalanmalı.
- Redis ephemeral olabilir, çünkü cache/rate limit storage'dır; yine de servis production'da ayakta olmalıdır.
- `restart: unless-stopped` başlangıç için uygundur; kurum standardına göre gözden geçirilebilir.
- Healthcheck tanımları ileride compose seviyesinde eklenmelidir.
- Log rotation Docker daemon veya host seviyesinde planlanmalıdır.
- Reverse proxy backend'i doğrudan public internete açmadan HTTPS üzerinden yayınlamalıdır.

## 7. Build ve deploy akışı

PowerShell örnek akış:

```powershell
cd C:\Users\deniz\it-inventory-platform

git pull
Copy-Item .\.env.example .\.env
# .env dosyasını production değerleriyle düzenleyin.

docker compose build
docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py check
curl.exe -i http://localhost:8000/api/health/
```

Frontend production build kontrolü:

```powershell
cd C:\Users\deniz\it-inventory-platform\frontend
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

İlk deploy sonrası:

- Admin/superuser hesabını kontrol edin.
- Gereksiz demo kullanıcıları kapatın veya şifrelerini değiştirin.
- İlk login, refresh ve logout akışını test edin.
- `/assets`, `/personnel`, ticket inbox, reminders ve audit ekranlarını yetkili kullanıcılarla açın.

Linux/macOS ortamında komutlar aynıdır; path formatı ve shell syntax farklı olabilir.

## 8. Reverse proxy / HTTPS notları

Production HTTPS olmadan kullanılmamalıdır. Nginx, Caddy veya Traefik kullanılabilir.

Dikkat edilmesi gerekenler:

- Secure refresh cookie için HTTPS gerekir.
- `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` production settings içinde vardır; reverse proxy ilgili header'ı doğru göndermelidir.
- `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` ve `AUTH_COOKIE_ALLOWED_ORIGINS` HTTPS production domainine göre ayarlanmalıdır.
- Upload/media boyut limitleri reverse proxy ve backend seviyesinde ileride netleştirilmelidir.
- Backend portu doğrudan public erişime açılmamalıdır; reverse proxy arkasında tutulmalıdır.

## 9. Backup/restore operasyon bağlantısı

Detaylı backup ve restore drill dokümanı:

```text
docs/operations/backup-restore.md
```

Production operasyonunda:

- Deploy öncesi ilk backup alınmalı.
- Migration öncesi PostgreSQL backup alınmalı.
- Media backup düzenli schedule'a bağlanmalı.
- Restore drill periyodik olarak staging veya izole local ortamda denenmeli.
- Backup retention önerisi: günlük 7 gün, haftalık 4 hafta, aylık 6 ay.
- Backup dosyaları şifreli ve güvenli storage üzerinde tutulmalı.
- Scheduled backup runner: `.\scripts\backup\run_scheduled_backup.ps1 -Environment production -RetentionDays 30 -RetentionMinCount 10`.
- Son backup kontrolü: `.\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge`.
- Scheduled job örnekleri: `docs/operations/scheduled-jobs.md`.
- Manifest JSON dosyaları `backups/manifests/` altında üretilir ve repoya commitlenmez.
- Offsite backup zorunlu operasyonel kontrol olarak planlanmalıdır; local disk tek kopya kabul edilmemelidir.

Admin Console:

- Admin kullanıcılar `/admin-console` ekranından sistem sağlığı, son backup manifesti, Redis/cache durumu ve security uyarılarını görebilir.
- Backup paneli manifest dosya adlarını ve boyutlarını özetler; full local path, secret veya connection string göstermez.
- Davet/aktivasyon ve personel import panelleri operasyon sayıları gösterir; e-posta/telefon listeleri veya import row data göstermez.
- Partial/failed/stale backup durumunda verify script'i ve scheduled job runbook'u kontrol edilmelidir.
- N6b guidance panelleri güvenli komutları sadece kopyalar; browser'dan backup, restore, cleanup veya invitation revoke çalıştırmaz.
- Production'da scheduled backup kurulduktan sonra Admin Console üzerinden son manifest, stale uyarısı ve checklist günlük izlenmelidir.
- Admin user/personnel connection review için `/admin-console/users` ekranında aktivasyon bekleyen, expired invitation ve personel bağlantısı olmayan kullanıcılar düzenli kontrol edilmelidir.
- Admin user safe actions production'da düzenli review ister: deactivate/reactivate ve role change audit logları incelenmeli, son aktif admin guard doğrulanmalı, invitation create/revoke işlemleri periyodik olarak kontrol edilmelidir.
- Admin user action review sırasında reason kalitesi, role-change gerekçeleri, inactive user listesi ve `/audit?entity_type=accounts.User` filtreli kayıtları periyodik olarak kontrol edilmelidir.
- Delete, bulk action ve raw credential set/reset bu foundation kapsamında yoktur; bu işlemler eklenirse ayrı güvenlik kapıları ve test planı gerektirir.

Ticket Workspace:

- Technician/admin kullanıcılar `/tickets` ekranında açık queue, çözülen ticketlar, chat, status composer ve context panelini günlük kontrol etmelidir.
- İç notların requester portalında görünmediği ve public reply / internal note ayrımının net kaldığı periyodik olarak doğrulanmalıdır.
- Resolved/closed geçişlerinde çözüm notu kalitesi ve `/audit?entity_type=tickets.Ticket` kayıtları gözden geçirilmelidir.

## 10. Healthcheck ve smoke checklist

Deploy sonrası manuel smoke:

- [ ] `/api/health/` 200 dönüyor.
- [ ] Login 200.
- [ ] Refresh çalışıyor.
- [ ] Logout çalışıyor.
- [ ] 6 yanlış login denemesi 429 dönüyor.
- [ ] `/assets` açılıyor.
- [ ] `/personnel` açılıyor.
- [ ] Excel export çalışıyor.
- [ ] Ticket requester flow çalışıyor.
- [ ] Technician ticket inbox açılıyor.
- [ ] Reminder sayfaları yetkili kullanıcı için açılıyor.
- [ ] Audit sayfaları admin için açılıyor.
- [ ] PostgreSQL backup script smoke çalışıyor.
- [ ] Media backup script smoke çalışıyor veya media yoksa kontrollü skip yapıyor.
- [ ] Scheduled backup runner success manifest üretiyor.
- [ ] Verify latest backup komutu healthy dönüyor.
- [ ] Retention cleanup dry-run kontrol edildi.
- [ ] Restore drill periyodu ve staging/izole ortam belirlendi.

Healthcheck örneği:

```powershell
curl.exe -i http://localhost:8000/api/health/
```

## 11. Rollback planı

Basit rollback yaklaşımı:

- Deploy öncesi PostgreSQL backup alın.
- Mümkünse image tag stratejisi kullanın; önceki çalışan image tag'i bilinir olsun.
- Migration geri dönüşü risklidir; migration sonrası rollback kararı dikkatli alınmalıdır.
- Media dosyaları için deploy öncesi ayrı backup alın.
- Sorun çıkarsa servisleri durdurun, logları alın ve DB restore kararı vermeden önce etkiyi değerlendirin.
- Destructive restore işlemi için explicit onay şarttır. P4 restore scripti kullanıcı `RESTORE` yazmadan çalışmaz.

## 12. Monitoring/logging minimumları

Gelişmiş monitoring henüz yoksa minimum takip:

- `docker compose logs backend`.
- `docker compose logs db`.
- `docker compose logs redis`.
- Backend 5xx hata artışı.
- Login 429 artışı.
- DB disk alanı.
- Media ve backup disk alanı.
- Backup job başarı/başarısızlık sonucu.
- Redis/PostgreSQL container durumu.
- Reverse proxy access/error logları.

Örnek:

```powershell
docker compose ps
docker compose logs --tail 100 backend
```

## 13. Known limitations ve sonraki fazlar

Mevcut sınırlamalar:

- Otomatik scheduled backup henüz yok.
- Production reverse proxy örnek config dosyası henüz eklenmedi.
- E2E smoke tests P6'da ele alınacak.
- HR/Excel import P7'de ele alınacak.
- Admin Console N6'da ele alınacak.
- Media restore otomatik değil; manuel kontrollü süreç olarak dokümante edildi.
- Gelişmiş alerting/monitoring henüz yok.
- Frontend code splitting/chunk optimizasyonu P10 tarafına bırakıldı.

## 14. P5 deploy checklist özeti

- [ ] Env hazır.
- [ ] Gerçek secret değerleri repoya yazılmadı.
- [ ] Docker build geçti.
- [ ] DB migrate geçti.
- [ ] Redis çalışıyor.
- [ ] Health 200.
- [ ] Login/refresh/logout OK.
- [ ] Backup alındı.
- [ ] Restore drill planlandı.
- [ ] HTTPS ayarlı.
- [ ] CORS/CSRF doğru.
- [ ] Demo kullanıcılar kapatıldı veya şifreleri değiştirildi.
- [ ] CI/test/build yeşil.
- [ ] Smoke test geçti.
