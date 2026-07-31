# IT Envanter & Yönetim Platformu

## 1. Kısa Özet

IT Envanter & Yönetim Platformu, küçük ve orta ölçekli Türk şirketlerinin iç IT ekipleri için geliştirilmiş self-hosted, single-tenant bir operasyon panelidir. Envanter, zimmet, bakım, lisans, hatırlatıcı, ticket, audit ve admin console ihtiyaçlarını tek yerde toplar. Amaç Excel, WhatsApp ve e-posta üzerinde dağılan günlük IT operasyonunu daha izlenebilir, güvenli ve sürdürülebilir hale getirmektir.

Bu proje büyük bir enterprise ITSM clone'u olmaya çalışmaz. Daha pratik bir hedefi vardır: şirket içi IT ekibinin gerçek iş akışlarını sade, rol bazlı ve audit izli bir panel üzerinden yönetmesini sağlamak.

## 2. Problem ve Çözüm

Birçok şirkette IT operasyonu parçalı araçlarla yürür:

- Envanter Excel dosyalarında tutulur.
- Zimmet takibi e-posta veya imzalı belgeler arasında dağılır.
- Bakım, garanti ve lisans tarihleri kişisel hatırlatıcılara kalır.
- Talepler WhatsApp veya e-posta konuşmalarında kaybolur.
- Yetki, onay ve audit görünürlüğü zayıf kalır.

Platformun çözümü tek bir operasyon yüzeyidir:

- Varlık, personel, zimmet, bakım, lisans ve hatırlatıcı kayıtları aynı sistemde tutulur.
- Talep sahibi, onaycı, teknisyen ve admin rolleri ayrı deneyimlerle çalışır.
- Access token frontend memory/context tarafında, refresh token httpOnly cookie olarak kullanılır.
- Asıl güvenlik backend RBAC, CSRF/origin kontrolleri, rate limiting ve audit log katmanındadır.
- Backup, verify, restore drill ve production readiness süreçleri browser dışındaki kontrollü operasyon scriptleriyle yürür.

## 3. Hedef Kullanıcılar

- IT yöneticisi / Admin.
- Teknisyen.
- Talep sahibi personel.
- Onaycı yönetici.
- Salt okunur operasyon izleyicileri.

## 4. Ana Özellikler

### Envanter / Varlık Yönetimi

- Varlık listesi ve detay paneli.
- Kategori, durum, seri numarası, garanti ve bakım tarihleri.
- Arama, filtreleme, sıralama ve sayfalama.
- Excel export.
- Audit izlenebilirliği.

### Zimmet Yönetimi

- Varlık-personel atama.
- Aktif zimmet ve iade akışı.
- Zimmet geçmişi ve lokasyon/personel görünürlüğü.
- Varlık detaylarıyla bağlantılı operasyon takibi.

### Bakım / Onarım / İmha

- Bakım ve onarım kayıtları.
- Servis, personel, maliyet ve tarih bilgisi.
- Sonraki bakım tarihi takibi.
- Varlık durum güncelleme ve imha kayıtları.

### Lisans & Abonelik

- Lisans kayıtları, koltuk bilgisi ve bitiş tarihi takibi.
- Soft delete / restore davranışı.
- Yaklaşan bitiş tarihleri için operasyon görünürlüğü.
- Audit kayıtları.

### Hatırlatıcılar

- Garanti, bakım ve lisans bitişi gibi kritik tarihler.
- Dismiss/cancel davranışları.
- Geciken veya yaklaşan işlerin tek listede takip edilmesi.

### Ticket / Talep Yönetimi

- Talep sahibi portalı.
- Onaycı akışı.
- Teknisyen ticket workspace.
- Chat, talep sahibine yanıt ve iç not ayrımı.
- Status/solution composer.
- Ticket context paneli.
- Audit trace bağlantıları.

### Personel & HR Import

- Excel/CSV dry-run.
- Commit akışı.
- Error report ve import history.
- User linking/create.
- Aktivasyon bekleyen kullanıcı akışı.

### Kullanıcı Davet / Aktivasyon

- Inactive + unusable user yaklaşımı.
- Token hash ile tek kullanımlık activation link.
- Admin-only invitation management.
- Aktivasyon sayfası.
- Raw token kalıcı list/detail response içinde gösterilmez.

### Admin Console

- System health, Redis/cache ve security sinyalleri.
- Backup health ve son manifest özeti.
- Operational guidance ve güvenli copy command.
- Kullanıcı/personel yönetimi.
- Safe user actions.
- Audit traceability.

### Audit Log

- Merkezi audit sayfası.
- Entity/action filtreleri.
- Detail drawer.
- Kritik kullanıcı, import, ticket ve operasyon aksiyonları için izlenebilirlik.

### Backup & Operations

- PostgreSQL ve media backup scriptleri.
- Scheduled backup runner.
- Manifest üretimi.
- Verify latest backup.
- Retention cleanup dry-run.
- Manuel ve explicit `RESTORE` onaylı restore drill.

## 5. Roller ve Yetkiler

| Rol | Kullanım Alanı | Yetki Özeti |
| --- | --- | --- |
| Admin | Sistem yönetimi | Tüm operasyonel modüller, Admin Console, güvenli user actions |
| Technician | IT operasyonu | Ticket workspace, envanter ve bakım operasyonları |
| Requester | Talep sahibi portalı | Kendi taleplerini oluşturur ve takip eder |
| Approver | Onay portalı | Kendisine gelen talepleri onaylar veya reddeder |
| Viewer | Salt okunur erişim | Okuma odaklı operasyon görünürlüğü |

Frontend RBAC kullanıcı deneyimi içindir. Asıl güvenlik backend RBAC, permission kontrolleri ve audit katmanında uygulanır.

## 6. Teknik Mimari

- Backend: Django + Django REST Framework.
- Database: PostgreSQL.
- Cache: Redis.
- Frontend: React + Vite + TypeScript + Tailwind CSS.
- Auth: JWT access token + httpOnly refresh cookie.
- E2E: Playwright.
- Operasyon: Docker Compose ve PowerShell backup scriptleri.

Basit akış:

```text
Browser
  -> React/Vite frontend
  -> Django REST API
  -> Django apps
  -> PostgreSQL / Redis
```

Backup ve restore scriptleri browser içinden çalıştırılmaz. Admin Console yalnızca güvenli durum özetleri ve kopyalanabilir rehber komutları gösterir.

## 7. Proje Yapısı

```text
backend/    Django API, domain app'leri, settings ve management commands
frontend/   React uygulaması, sayfalar, shared componentler ve E2E testler
docs/       Demo, operasyon ve production readiness dokümantasyonu
scripts/    Backup, restore, cleanup, verify ve E2E smoke runner scriptleri
backups/    Runtime backup çıktı klasörleri; artifactler repoya alınmaz
```

Öne çıkan klasörler:

- `backend/apps/*`: domain modülleri.
- `frontend/src/pages`: ana ekranlar.
- `frontend/src/components`: paylaşılan UI ve domain componentleri.
- `docs/operations`: production, backup, admin console, E2E ve ticket runbookları.
- `docs/demo`: demo script, QA checklist, demo data checklist ve known limitations.
- `scripts/backup`: backup/verify/restore/cleanup scriptleri.
- `scripts/e2e`: local/dev E2E smoke runner.

## 8. Lokal Kurulum

```powershell
cd C:\Users\deniz\it-inventory-platform
docker compose up -d
docker compose ps
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py check
```

Frontend geliştirme sunucusu:

```powershell
cd C:\Users\deniz\it-inventory-platform\frontend
npm install
npm run dev
```

Bu repo local/dev Docker Compose ağırlıklı çalışır. Production için `.env` değerleri, HTTPS/reverse proxy, güçlü secretlar, Redis ve backup planı ayrıca hazırlanmalıdır.

## 9. Test ve Build

Backend:

```powershell
cd C:\Users\deniz\it-inventory-platform
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend python manage.py check
docker compose exec backend python manage.py test --verbosity 1
```

Frontend:

```powershell
cd C:\Users\deniz\it-inventory-platform\frontend
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

E2E smoke:

```powershell
cd C:\Users\deniz\it-inventory-platform
.\scripts\e2e\run_e2e_smoke.ps1
```

Node PATH'te değilse runner'a `-NodePath` parametresi verilebilir. E2E smoke runner sadece local/dev içindir; production ortamda çalıştırılmamalıdır. Local smoke kullanıcıları runner tarafından hazırlanır; gerçek şifreler README içinde tutulmaz.

## 10. Demo Akışı

5-8 dakikalık önerilen demo akışı:

1. Login.
2. Admin dashboard / genel bakış.
3. Envanter ve varlık detayı.
4. Zimmet.
5. Bakım.
6. Lisans.
7. Hatırlatıcılar.
8. Personel import ve user activation hikayesi.
9. Admin Console.
10. Admin Users güvenli aksiyonlar.
11. Talep sahibi ticket oluşturma.
12. Onaycı kararı.
13. Teknisyen ticket workspace.
14. Audit trace.
15. Backup health ve production readiness.

Detaylı anlatım: `docs/demo/demo-script.md`.

## 11. Operasyon, Backup ve Security Yaklaşımı

Production yaklaşımı şu prensiplere dayanır:

- `DEBUG=False`, HTTPS ve güvenilir CORS/CSRF originleri.
- Refresh token httpOnly cookie; production'da secure cookie.
- Backend RBAC source of truth.
- Redis-backed cache ve login rate limiting storage.
- Audit log ile kritik aksiyon izlenebilirliği.
- Backup artifact download veya browser içinden restore yok.
- Restore işlemi manuel ve explicit `RESTORE` onayıyla yapılır.
- Backup manifestleri secret, connection string, full path veya gereksiz PII içermez.

Backup doğrulama örneği:

```powershell
cd C:\Users\deniz\it-inventory-platform
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge
```

Daha fazla bilgi:

- `docs/deploy/self-hosted-install.md`
- `docs/operations/production-readiness.md`
- `docs/operations/backup-restore.md`
- `docs/operations/scheduled-jobs.md`
- `docs/operations/admin-console.md`
- `docs/operations/monitoring-log-review.md`
- `docs/operations/admin-users.md`
- `docs/operations/ticket-workspace.md`
- `docs/operations/e2e-smoke.md`

## 12. Demo ve QA Dokümantasyonu

- `docs/demo/demo-script.md`: demo hikayesi ve sunum sırası.
- `docs/demo/final-qa-checklist.md`: admin, teknisyen, talep sahibi, onaycı ve security QA listeleri.
- `docs/demo/demo-data-checklist.md`: demo verisi ve seed readiness kontrolleri.
- `docs/demo/known-issues-and-limitations.md`: bilinen sınırlar ve güvenli açıklamalar.
- `docs/demo/manual-smoke-script.md`: demo öncesi manuel smoke komutları.

## 13. Bilinen Sınırlar

- Email invitation delivery yoktur; activation link admin tarafından güvenli kanaldan paylaşılır.
- Real-time/WebSocket yoktur; bazı ekranlarda refresh veya yeniden sorgu gerekir.
- Enterprise ITSM seviyesinde SLA automation yoktur.
- Scheduled backup OS scheduler ile kurulmalıdır; uygulama içinden çalıştırılmaz.
- Restore otomatik değildir; explicit `RESTORE` onayı gerektirir.
- SNMP/agent discovery yoktur; manual-first inventory yaklaşımı vardır.
- Multi-tenant/SaaS yoktur; self-hosted single-tenant yapı hedeflenmiştir.
- Büyük veri hacminde bazı admin filtreleri ve frontend chunk optimizasyonu ileride ele alınabilir.

## 14. Güvenli Handoff Notları

- Secret, password, token, token hash, DB password, connection string veya private key repoya yazılmamalıdır.
- Backup artifactleri repoya alınmamalıdır.
- Production deployment bu README ile yapılmaz; production için operasyon runbookları izlenmelidir.
- Demo öncesi `docs/demo/final-qa-checklist.md` ve `docs/demo/manual-smoke-script.md` birlikte kullanılmalıdır.
