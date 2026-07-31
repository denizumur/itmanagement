# Manual Smoke Script

Demo öncesi her çalıştırmada bu kısa sıra izlenir. Production ortamda kullanıcı şifresi resetleyen E2E runner çalıştırılmaz.

## Hazırlık

```powershell
cd C:\Users\deniz\it-inventory-platform
docker compose up -d
docker compose ps
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend python manage.py check
```

## Backend ve backup doğrulama

```powershell
docker compose exec backend python manage.py test --verbosity 1
powershell.exe -ExecutionPolicy Bypass -File .\scripts\backup\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge
```

## Frontend doğrulama

```powershell
cd C:\Users\deniz\it-inventory-platform\frontend
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build
```

## E2E smoke

```powershell
cd C:\Users\deniz\it-inventory-platform
.\scripts\e2e\run_e2e_smoke.ps1
```

Node PATH'te değilse `-NodePath` ile `node.exe` yolu verilir.

## Manuel rol turu

1. Admin ile login olun; dashboard, `/assets`, `/personnel`, `/admin-console`, `/admin-console/users` ve `/audit` sayfalarını açın.
2. Teknisyen ile login olun; `/tickets` queue, detail, chat, status composer ve context panelini kontrol edin.
3. Talep sahibi ile login olun; `/my-tickets` portalını ve talep formunu kontrol edin.
4. Onaycı ile login olun; `/approvals` portalında bekleyen onay görünürlüğünü kontrol edin.
5. Talep sahibi portalında iç notların görünmediğini doğrulayın.
6. Admin Console backup health ve security guidance panellerini kontrol edin.
7. Audit trace linklerinin token, secret veya raw path içermediğini kontrol edin.
8. Admin Users davet oluşturma sonucunda email delivery mesajını kontrol edin; SMTP kapalıysa skipped mesajı ve manual copy fallback beklenir.

## Kapanış kriteri

- Frontend typecheck ve build geçti.
- Backend check/test geçti.
- E2E smoke geçti.
- Backup verify healthy döndü.
- Role-based QA checklist tamamlandı.
- Known issues dokümanı demo anlatımıyla uyumlu.
