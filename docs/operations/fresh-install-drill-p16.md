# P16 Fresh Clone / Fresh Machine Install Drill

## Kapsam

Bu drill `v0.2.0-email-invites` sonrası fresh clone kurulum akışını aynı makinede, orijinal repo çalışma ağacına dokunmadan prova etmek için yapıldı.

Drill klasörü:

```text
C:\Users\deniz\it-inventory-platform-fresh-drill
```

Orijinal repo içindeki do-not-touch untracked dosyalara dokunulmadı. Stage, commit veya push yapılmadı.

## Çalıştırılan Ana Adımlar

```powershell
git clone https://github.com/denizumur/itmanagement.git C:\Users\deniz\it-inventory-platform-fresh-drill
cd C:\Users\deniz\it-inventory-platform-fresh-drill
git status -sb
git log --oneline -5
git tag --list
Copy-Item .\.env.example .\.env
```

Fresh clone sonucu:

- `main` branch temiz geldi.
- `v0.1.0-demo` ve `v0.2.0-email-invites` tagleri görüldü.
- `.env.example` dosyası `.env` olarak kopyalanabildi.
- Email delivery default değeri `INVITATION_EMAIL_ENABLED=false`.
- `APP_FRONTEND_URL=http://localhost:5173`.

## Docker Compose Bulguları

Mevcut makinede orijinal stack zaten çalışıyordu:

- `it_inventory_backend`
- `it_inventory_db`
- `it_inventory_redis`

`docker-compose.yml` sabit `container_name` değerleri kullandığı için aynı makinede ikinci fresh stack doğrudan başlatılamaz. Bu yüzden P16 drill için geçici compose override stdin üzerinden kullanıldı:

- Fresh backend container: `it_inventory_p16_backend`
- Fresh db container: `it_inventory_p16_db`
- Fresh redis container: `it_inventory_p16_redis`
- Fresh backend port: `18000`
- Fresh PostgreSQL port: `55432`
- Fresh volume: `it_inventory_p16_postgres_data`

Volume silme yapılmadı.

## Windows EOL Bulgusu

Fresh clone Windows ortamında `core.autocrlf=true` ile geldi. `backend/entrypoint.sh` git index içinde LF iken working tree içinde CRLF oldu:

```text
i/lf w/crlf backend/entrypoint.sh
```

Bu durumda backend container restart loop'a girdi:

```text
exec /app/entrypoint.sh: no such file or directory
```

Drill'i ilerletmek için yalnız fresh clone içinde `backend/entrypoint.sh` LF olarak geçici düzeltildi ve backend container recreate edildi. Bu kaynak repo davranışını değiştirmedi.

Önerilen takip:

- Repo seviyesinde `backend/entrypoint.sh` için LF checkout'u garanti eden `.gitattributes` eklenmeli.
- Windows self-hosted rehberi, Docker scriptleri için LF gereksinimini açıkça söylemeli.

## Backend Sonucu

Geçici LF düzeltmesi sonrası:

```powershell
docker exec it_inventory_p16_backend python manage.py migrate
docker exec it_inventory_p16_backend python manage.py check
curl.exe -i http://localhost:18000/api/health/
```

Sonuç:

- Migration geçti.
- `manage.py check` geçti.
- Health endpoint `HTTP/1.1 200 OK` döndü.

## Frontend Sonucu

Fresh clone içinde:

```powershell
cd frontend
npm install
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

Sonuç:

- `npm install` geçti.
- TypeScript build geçti.
- Vite production build geçti.
- Bilinen plugin timing ve büyük chunk warning'i görüldü.

## E2E Smoke Bulguları

`scripts/e2e/run_e2e_smoke.ps1` aynı makinedeki fresh clone için doğrudan kullanılamadı; script kendi içinde default `docker compose up -d` çağırıyor ve sabit container isimleriyle orijinal stack'e çarpma riski taşıyor.

İzole deneme için:

- Backend: `http://localhost:18000`
- Frontend: `http://localhost:5174`
- `VITE_API_BASE_URL=http://localhost:18000`
- `E2E_BACKEND_URL=http://localhost:18000`
- `E2E_FRONTEND_URL=http://localhost:5174`

Ek origin ayarı fresh `.env` içinde gerekli oldu:

- `CORS_ALLOWED_ORIGINS` içine `http://localhost:5174`
- `CSRF_TRUSTED_ORIGINS` içine `http://localhost:5174`
- `AUTH_COOKIE_ALLOWED_ORIGINS` içine `http://localhost:5174`

Sonuç:

- İlk izole denemede 5/6 geçti; activation testi farklı backend/frontend port hizası yüzünden başarısız oldu.
- Origin ayarları düzeltildikten sonra activation testi geçti.
- Requester portal testi fresh DB'de önce requester employee link eksikliği nedeniyle form yükleyemedi.
- Requester employee link manuel hazırlandıktan sonra form yüklendi, fakat test `getByText(/talep/i)` beklentisinde kaldı. Ekrandaki güncel form başlığı `Yeni yardım isteği` / `Nasıl yardımcı olabiliriz?` olduğu için test metin beklentisi kırılgan görünüyor.

Önerilen takip:

- E2E smoke user preparation, `requester.demo` için Employee bağlantısını fresh DB'de deterministik kurmalı.
- Requester portal smoke testi görünür formu `data-testid` veya daha stabil bir role/label üzerinden doğrulamalı.
- Runner aynı makinede ikinci stack ihtiyacı için port/project/container override desteklemeli veya dokümanda tek-stack varsayımı açık yazılmalı.

## Backup / Verify Bulguları

Fresh clone backup klasörleri yalnız `.gitkeep` dosyalarıyla geldi.

Güvenli verify denemesi:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge
```

Sonuç:

```text
[backup:verify] ERROR: Manifest bulunamadi.
```

Bu hata yeni kurulumda henüz backup alınmadığı için anlaşılır.

`run_scheduled_backup.ps1` aynı makinede çalıştırılmadı. Nedeni: script default `docker compose` ve sabit container isimleriyle çalışıyor; fresh izole stack yerine orijinal stack'i hedefleme riski var.

Önerilen takip:

- Backup scriptleri veya dokümanları aynı makinede fresh drill için compose project/container varsayımını açıklaştırmalı.
- Backup drill için ayrı makine/VM en temiz yöntem olarak kalmalı.

## Email Invitation Delivery Bulgusu

Fresh `.env` içinde:

```text
INVITATION_EMAIL_ENABLED=false
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

Bu default beklenen güvenli davranıştır. İzole E2E denemesinde invitation/activation hattı, origin ayarı hizalandıktan sonra çalıştı. SMTP kapalı durumda manual copy fallback yaklaşımı fresh install için doğru varsayılan olarak duruyor.

## Genel Sonuç

Fresh clone kurulabiliyor, `.env.example -> .env` akışı çalışıyor, frontend install/build geçiyor ve backend Docker stack doğru EOL/origin koşulları sağlandığında çalışıyor.

Ancak fresh install deneyimi şu noktalarda doküman veya packaging desteği istiyor:

- Windows checkout `backend/entrypoint.sh` dosyasını CRLF yaparsa backend container başlamıyor.
- Aynı makinede ikinci stack, sabit `container_name` ve portlar nedeniyle doğrudan çalışmıyor.
- Non-default frontend portu kullanılırsa CORS/CSRF/cookie origin listeleri güncellenmeli.
- E2E smoke runner fresh DB için requester employee linkini deterministik hazırlamalı.
- Requester portal smoke assertion güncel UI metnine göre kırılgan.
- Backup runner fresh izole stack'i hedefleyemiyor; default compose varsayımı net yazılmalı.

## Temizlik

P16 izole Docker stack volume silinmeden durduruldu. Fresh Vite helper süreci durduruldu. Orijinal repo stack'i durdurulmadı ve volume temizliği yapılmadı.
