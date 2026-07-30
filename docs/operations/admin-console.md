# Admin Console Runbook

`/admin-console` ekranı admin kullanıcılar için sistem operasyon özetini tek yerde toplar. Amaç yeni bir workflow yaratmak değil; mevcut backup, security, davet, import, audit, ticket ve reminder sinyallerini güvenli şekilde görünür kılmaktır.

## Gösterilen veriler

- Sistem sağlığı: database, Redis/cache, environment ve DEBUG/security uyarıları.
- Backup health: son manifest status, çalışma zamanı, backup yaşı, dosya boyutları, retention sonucu ve warning/error sayıları.
- Davet ve aktivasyon: pending/expired invitation, son 30 gün accepted/revoked, pasif kullanıcı ve aktivasyon bekleyen kullanıcı sayıları.
- Personel import: son import status, created/error/warning count ve commit zamanı.
- Operasyon: son 24 saat audit sayısı, kritik audit sayısı, açık/acil ticket ve geciken reminder sayısı.

## Güvenlik sınırları

Admin Console şunları özellikle göstermez:

- Secret değerleri.
- Raw token veya token hash.
- DB password veya connection string.
- Full backup path.
- E-posta/telefon listeleri.
- Import row data.
- Backup artifact download linki.

## Troubleshooting

Manifest yoksa:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\run_scheduled_backup.ps1 -Environment production -RetentionDays 30 -RetentionMinCount 10
```

Backup partial/failed görünüyorsa:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge
```

Redis/cache error görünüyorsa production `.env` içindeki `REDIS_URL` ve Docker Compose `redis` service durumunu kontrol edin.

Pending/expired invitation birikirse personel detay ekranından ilgili kullanıcıların davetlerini yenileyin veya revoke akışını kullanın.
