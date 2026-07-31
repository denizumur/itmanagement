# Backup ve Restore Operasyonu

Bu doküman IT Envanter ve Yönetim Platformu için PostgreSQL veritabanı ve `backend/media` dosyalarının güvenli şekilde yedeklenmesi ve restore drill yapılması için hazırlandı.

## Backup stratejisi

P4 v1 yaklasimi iki ana veri kaynagini hedefler:

- PostgreSQL: uygulamanın asıl iş verisi, kullanıcılar, envanter, zimmet, ticket, audit ve token blacklist kayıtları.
- `backend/media`: ticket ekleri ve runtime dosya yuklemeleri.

Redis cache yedeklenmez. Redis login rate limit ve cache verisi içindir; kalıcı iş verisi kaynağı olarak kabul edilmez.

## Neler yedeklenir?

- PostgreSQL veritabani, plain SQL dump olarak.
- `backend/media` dizini, zip arsivi olarak.

## Neler yedeklenmez?

- Redis cache.
- `frontend/node_modules`.
- Python virtualenv, `__pycache__`, `.pyc` dosyaları.
- Docker image ve build cache.
- Lokal `.env` dosyasi. Secret degerler repoya yazilmaz.

## Klasor standardi

Backup scriptleri varsayılan olarak şu dizinleri kullanır:

```text
backups/
  postgres/
  media/
```

Gerçek backup dosyaları `.gitignore` ile ignore edilir. Sadece klasör standardını tutmak için `.gitkeep` dosyaları repoda kalır.

## Local PostgreSQL backup

Repo kök dizininden çalıştırın:

```powershell
.\scripts\backup\backup_postgres.ps1
```

Script `docker compose exec -T db` ile compose service adı olan `db` üzerinden `pg_dump` çalıştırır. Container adı yerine service adı kullanılır. DB adı ve kullanıcısı container içindeki `POSTGRES_DB` ve `POSTGRES_USER` ortam değişkenlerinden okunur.

Ornek cikti:

```text
backups/postgres/it_inventory_20260729_213000.sql
```

## Local media backup

Repo kök dizininden çalıştırın:

```powershell
.\scripts\backup\backup_media.ps1
```

`backend/media` yoksa veya bossa script kontrollu sekilde skip mesaji verir. Media varsa timestamp iceren zip uretir:

```text
backups/media/media_20260729_213000.zip
```

## Local restore drill

Restore destructive olabilir. Bu nedenle script confirmation olmadan calismaz.

```powershell
.\scripts\backup\restore_postgres.ps1 -BackupFile .\backups\postgres\it_inventory_YYYYMMDD_HHMMSS.sql
```

Script devam etmeden önce kullanıcıdan tam olarak `RESTORE` yazmasını ister. Confirmation verilmezse işlem iptal edilir.

Guvenli drill onerisi:

1. Production dump dosyasini lokal ve izole bir ortama alin.
2. Production DB yerine lokal Docker Compose DB kullanin.
3. Restore oncesi mevcut lokal verinin onemli olmadigindan emin olun.
4. Restore scriptini çalıştırın ve `RESTORE` confirmation verin.
5. `docker compose exec backend python manage.py check` çalıştırın.
6. Kritik ekranlari ve API'leri smoke test edin: login, assets/personnel listeleri, ticket ekleri, Excel export.

Production DB üzerinde doğrudan restore drill yapmayın. Önce ayrı bir staging veya geçici restore ortamı kullanın.

## Media restore notu

P4 v1 media restore için otomatik destructive script eklemez. Media restore yaparken:

1. Mevcut `backend/media` dizinini once ayri bir yere yedekleyin.
2. Zip arsivini gecici dizine acin.
3. Dosya sahipligi ve izinlerini kontrol edin.
4. Icerigi `backend/media` altina kontrollu olarak kopyalayin.
5. Ticket ekleri gibi dosya referanslarını uygulama üzerinden smoke test edin.

## Production onerisi

- PostgreSQL ve media backup ayni zaman penceresinde alinmali.
- Scheduled backup runner için `.\scripts\backup\run_scheduled_backup.ps1 -Environment production -RetentionDays 30 -RetentionMinCount 10` kullanılabilir.
- Son backup sagligi `.\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge` ile kontrol edilmelidir.
- Backup dosyaları uygulama sunucusundan farklı ve güvenli bir lokasyona kopyalanmalı.
- Backup dosyaları hassas veri içerebilir; şifreli saklama tercih edilmeli.
- Restore drill periyodik olarak staging ortaminda denenmeli.
- Backup scriptleri cron, Windows Task Scheduler veya deployment platformunun scheduled job mekanizması ile çalıştırılabilir.

## Saklama politikasi onerisi

Başlangıç için makul bir politika:

- Gunluk backup: 7 gun.
- Haftalik backup: 4 hafta.
- Aylik backup: 6 ay.

Regulasyon, sozlesme veya sirket politikasina gore bu sureler artirilabilir.

P8 scheduled runner varsayılan olarak 14 gün retention ve en az 5 artifact koruma politikasını uygular. Cleanup sadece şu dosyaları hedefler:

- `backups/postgres/*.sql`
- `backups/media/*.zip`
- `backups/manifests/*.json`

Dry-run kontrolu:

```powershell
.\scripts\backup\cleanup_old_backups.ps1 -RetentionDays 14 -RetentionMinCount 5 -DryRun
```

## Scheduled backup runner

Tek komutla PostgreSQL backup, media backup, manifest ve retention çalıştırmak için:

```powershell
.\scripts\backup\run_scheduled_backup.ps1 -Environment dev
.\scripts\backup\run_scheduled_backup.ps1 -Environment production -RetentionDays 30 -RetentionMinCount 10
.\scripts\backup\run_scheduled_backup.ps1 -Environment production -SkipMedia
.\scripts\backup\run_scheduled_backup.ps1 -DryRunCleanup
```

Runner restore scriptini cagirmaz, DB drop/restore yapmaz ve secret deger loglamaz. Production modunda terminalde ayrica uyari verir.

## Backup manifest

Her scheduled backup kosusu `backups/manifests/backup-manifest-YYYYMMDD-HHMMSS.json` dosyasi uretir. Manifest su bilgileri tasir:

- run id, baslangic/bitis zamani, status.
- environment.
- PostgreSQL ve varsa media backup path/boyut bilgisi.
- retention sonucu ve silinen dosya sayisi.
- errors/warnings.
- Docker Compose servis kontrol bilgisi ve mumkunse kisa git commit hash'i.

Manifest dosyalarında raw secret, DB password, connection string, kullanıcı PII veya row data tutulmaz. Manifest JSON dosyaları `.gitignore` ile ignore edilir; sadece `.gitkeep` repoda kalır.

## Son backup dogrulama

Monitoring veya scheduled job sonrası health kontrolü için:

```powershell
.\scripts\backup\verify_latest_backup.ps1
.\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge
.\scripts\backup\verify_latest_backup.ps1 -RequireMedia
```

Script en son manifesti bulur, status `success` değilse non-zero döner, artifact path ve boyutlarını kontrol eder. `-FailIfOlderThanMaxAge` kullanılırsa stale backup da non-zero sonuç üretir.

Admin Console `/admin-console` backup guidance paneli bu komutları kopyalanabilir şekilde gösterir. Komutlar tarayıcıdan çalıştırılmaz; operatör terminalde kendisi çalıştırır.

Onerilen guvenli komutlar:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\run_scheduled_backup.ps1 -Environment production -RetentionDays 30 -RetentionMinCount 10
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\cleanup_old_backups.ps1 -RetentionDays 14 -RetentionMinCount 5 -DryRun
```

Restore scripti yine manuel ve explicit `RESTORE` onaylıdır. Admin Console restore çalıştırmaz.

## Guvenlik

- Backup dosyaları kullanıcı, personel, ticket, audit ve ek dosya verisi içerebilir.
- Backup artifactleri repoya commitlenmez.
- `backups/postgres/*.sql`, `backups/media/*.zip` ve `backups/manifests/*.json` commitlenmez.
- Backup dosyaları paylaşılırken şifreleme ve erişim kontrolü kullanılmalıdır.
- `.env`, secret, key veya password değerleri dokümana ya da repoya yazılmamalıdır.

## Restore testinin onemi

Backup alınmış olması tek başına yeterli değildir. Restore edilmeyen backup'ın işe yarayıp yaramadığı bilinmez. Restore drill, veri kaybı anında geri dönüş süresini ve operasyonel eksikleri önceden gösterir.

## Troubleshooting

### Container calismiyor

```powershell
docker compose ps
docker compose up -d
```

`db` service ayakta değilse PostgreSQL backup/restore çalışmaz.

### Permission hatasi

PowerShell script execution policy sorunları için scripti şu şekilde çalıştırın:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup\backup_postgres.ps1
```

### DB kullanıcı adı yanlış

Script container içindeki `POSTGRES_USER` ve `POSTGRES_DB` değerlerini kullanır. `.env` ve `docker-compose.yml` değerlerinin DB container ile uyumlu olduğunu kontrol edin.

### Backup dosyasi bulunamadi

Restore komutunda `-BackupFile` yolunu tam veya repo kokune gore dogru verin:

```powershell
.\scripts\backup\restore_postgres.ps1 -BackupFile .\backups\postgres\it_inventory_YYYYMMDD_HHMMSS.sql
```

### Restore sirasinda SQL hatasi

Restore scripti `ON_ERROR_STOP=1` kullanir. Ilk SQL hatasinda durur. Hata mesajina gore dump dosyasini, hedef DB versiyonunu ve mevcut schema durumunu kontrol edin.
