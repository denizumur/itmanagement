# Backup ve Restore Operasyonu

Bu dokuman IT Envanter ve Yonetim Platformu icin PostgreSQL veritabani ve `backend/media` dosyalarinin guvenli sekilde yedeklenmesi ve restore drill yapilmasi icin hazirlandi.

## Backup stratejisi

P4 v1 yaklasimi iki ana veri kaynagini hedefler:

- PostgreSQL: uygulamanin asil is verisi, kullanicilar, envanter, zimmet, ticket, audit ve token blacklist kayitlari.
- `backend/media`: ticket ekleri ve runtime dosya yuklemeleri.

Redis cache yedeklenmez. Redis login rate limit ve cache verisi icindir; kalici is verisi kaynagi olarak kabul edilmez.

## Neler yedeklenir?

- PostgreSQL veritabani, plain SQL dump olarak.
- `backend/media` dizini, zip arsivi olarak.

## Neler yedeklenmez?

- Redis cache.
- `frontend/node_modules`.
- Python virtualenv, `__pycache__`, `.pyc` dosyalari.
- Docker image ve build cache.
- Lokal `.env` dosyasi. Secret degerler repoya yazilmaz.

## Klasor standardi

Backup scriptleri varsayilan olarak su dizinleri kullanir:

```text
backups/
  postgres/
  media/
```

Gercek backup dosyalari `.gitignore` ile ignore edilir. Sadece klasor standardini tutmak icin `.gitkeep` dosyalari repoda kalir.

## Local PostgreSQL backup

Repo kok dizininden calistirin:

```powershell
.\scripts\backup\backup_postgres.ps1
```

Script `docker compose exec -T db` ile compose service adi olan `db` uzerinden `pg_dump` calistirir. Container adi yerine service adi kullanilir. DB adi ve kullanicisi container icindeki `POSTGRES_DB` ve `POSTGRES_USER` ortam degiskenlerinden okunur.

Ornek cikti:

```text
backups/postgres/it_inventory_20260729_213000.sql
```

## Local media backup

Repo kok dizininden calistirin:

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

Script devam etmeden once kullanicidan tam olarak `RESTORE` yazmasini ister. Confirmation verilmezse islem iptal edilir.

Guvenli drill onerisi:

1. Production dump dosyasini lokal ve izole bir ortama alin.
2. Production DB yerine lokal Docker Compose DB kullanin.
3. Restore oncesi mevcut lokal verinin onemli olmadigindan emin olun.
4. Restore scriptini calistirin ve `RESTORE` confirmation verin.
5. `docker compose exec backend python manage.py check` calistirin.
6. Kritik ekranlari ve API'leri smoke test edin: login, assets/personnel listeleri, ticket ekleri, Excel export.

Production DB uzerinde dogrudan restore drill yapmayin. Once ayri bir staging veya gecici restore ortami kullanin.

## Media restore notu

P4 v1 media restore icin otomatik destructive script eklemez. Media restore yaparken:

1. Mevcut `backend/media` dizinini once ayri bir yere yedekleyin.
2. Zip arsivini gecici dizine acin.
3. Dosya sahipligi ve izinlerini kontrol edin.
4. Icerigi `backend/media` altina kontrollu olarak kopyalayin.
5. Ticket ekleri gibi dosya referanslarini uygulama uzerinden smoke test edin.

## Production onerisi

- PostgreSQL ve media backup ayni zaman penceresinde alinmali.
- Backup dosyalari uygulama sunucusundan farkli ve guvenli bir lokasyona kopyalanmali.
- Backup dosyalari hassas veri icerebilir; sifreli saklama tercih edilmeli.
- Restore drill periyodik olarak staging ortaminda denenmeli.
- Backup scriptleri cron, Windows Task Scheduler veya deployment platformunun scheduled job mekanizmasi ile calistirilabilir.

## Saklama politikasi onerisi

Baslangic icin makul bir politika:

- Gunluk backup: 7 gun.
- Haftalik backup: 4 hafta.
- Aylik backup: 6 ay.

Regulasyon, sozlesme veya sirket politikasina gore bu sureler artirilabilir.

## Guvenlik

- Backup dosyalari kullanici, personel, ticket, audit ve ek dosya verisi icerebilir.
- Backup artifactleri repoya commitlenmez.
- Backup dosyalari paylasilirken sifreleme ve erisim kontrolu kullanilmalidir.
- `.env`, secret, key veya password degerleri dokumana ya da repoya yazilmamalidir.

## Restore testinin onemi

Backup alinmis olmasi tek basina yeterli degildir. Restore edilmeyen backup'in ise yarayip yaramadigi bilinmez. Restore drill, veri kaybi aninda geri donus suresini ve operasyonel eksikleri onceden gosterir.

## Troubleshooting

### Container calismiyor

```powershell
docker compose ps
docker compose up -d
```

`db` service ayakta degilse PostgreSQL backup/restore calismaz.

### Permission hatasi

PowerShell script execution policy sorunlari icin scripti su sekilde calistirin:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup\backup_postgres.ps1
```

### DB kullanici adi yanlis

Script container icindeki `POSTGRES_USER` ve `POSTGRES_DB` degerlerini kullanir. `.env` ve `docker-compose.yml` degerlerinin DB container ile uyumlu oldugunu kontrol edin.

### Backup dosyasi bulunamadi

Restore komutunda `-BackupFile` yolunu tam veya repo kokune gore dogru verin:

```powershell
.\scripts\backup\restore_postgres.ps1 -BackupFile .\backups\postgres\it_inventory_YYYYMMDD_HHMMSS.sql
```

### Restore sirasinda SQL hatasi

Restore scripti `ON_ERROR_STOP=1` kullanir. Ilk SQL hatasinda durur. Hata mesajina gore dump dosyasini, hedef DB versiyonunu ve mevcut schema durumunu kontrol edin.
