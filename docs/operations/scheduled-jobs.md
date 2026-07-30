# Scheduled Jobs Runbook

Bu dokuman P8 backup otomasyonu icin Windows Task Scheduler, Linux cron ve systemd timer orneklerini toplar. P8 kapsaminda Celery/RQ/APScheduler gibi uygulama ici job framework yoktur; backup otomasyonu host scheduler ile calistirilir.

## Kapsam

- PostgreSQL ve media backup runner.
- Manifest uretimi.
- Retention cleanup.
- Son backup health kontrolu.
- Restore drill hatirlatmasi.

Otomatik restore yoktur. Restore islemleri hala `scripts/backup/restore_postgres.ps1` icindeki explicit `RESTORE` onayina baglidir.

## Onerilen periyot

- Gunluk backup: gece dusuk kullanim saatinde.
- Backup verify: backup job hemen sonrasinda.
- Haftalik restore drill: staging veya izole local ortamda.
- Offsite kopyalama: backup tamamlandiktan sonra kurumun guvenli storage cozumune.

## Windows Task Scheduler

Program:

```text
powershell.exe
```

Arguments:

```text
-ExecutionPolicy Bypass -File "C:\Users\deniz\it-inventory-platform\scripts\backup\run_scheduled_backup.ps1" -Environment production -RetentionDays 30 -RetentionMinCount 10
```

Start in:

```text
C:\Users\deniz\it-inventory-platform
```

Verify icin ikinci bir task veya ayni task sonunda ek komut kullanilabilir:

```powershell
.\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge
```

Task Scheduler exit code'u job sonucunu izlemek icin kullanilmalidir. Non-zero sonuc backup'in basarisiz, partial veya stale oldugunu gosterebilir.

## Linux cron

PowerShell Core kurulu Linux hostlarda `pwsh` ile calistirilabilir:

```cron
15 2 * * * cd /opt/it-inventory-platform && pwsh -File ./scripts/backup/run_scheduled_backup.ps1 -Environment production -RetentionDays 30 -RetentionMinCount 10 >> /var/log/it-inventory-backup.log 2>&1
45 2 * * * cd /opt/it-inventory-platform && pwsh -File ./scripts/backup/verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge >> /var/log/it-inventory-backup-verify.log 2>&1
```

Linux production icin ileride native bash backup scripti eklenebilir. P8 kapsaminda mevcut PowerShell scriptleri korunur.

## systemd timer ornegi

Service:

```ini
[Unit]
Description=IT Inventory scheduled backup

[Service]
Type=oneshot
WorkingDirectory=/opt/it-inventory-platform
ExecStart=/usr/bin/pwsh -File /opt/it-inventory-platform/scripts/backup/run_scheduled_backup.ps1 -Environment production -RetentionDays 30 -RetentionMinCount 10
```

Timer:

```ini
[Unit]
Description=Daily IT Inventory scheduled backup

[Timer]
OnCalendar=*-*-* 02:15:00
Persistent=true

[Install]
WantedBy=timers.target
```

## Monitoring notlari

- Runner `0` exit code ile success, non-zero ile failed/partial sonuc verir.
- Verify script `0` exit code ile healthy, `1` ile missing/failed/stale sonuc verir.
- Manifestler `backups/manifests/` altinda tutulur ve repoya commitlenmez.
- Loglarda secret, DB password, connection string veya PII tutulmamalidir.
- Backup artifactleri hassas veri icerdigi icin offsite kopyalama sifreli ve erisim kontrollu olmalidir.

## Restore drill

Haftalik veya en azindan duzenli araliklarla staging/izole local ortamda restore drill yapilmalidir:

```powershell
.\scripts\backup\restore_postgres.ps1 -BackupFile .\backups\postgres\it_inventory_YYYYMMDD_HHMMSS.sql
docker compose exec backend python manage.py check
```

Production DB uzerinde dogrudan drill yapilmaz. Restore scripti kullanici tam olarak `RESTORE` yazmadan devam etmez.
