# v0.1.0-demo — Demo-ready MVP Checkpoint

## Özet

Bu sürüm, küçük ve orta ölçekli Türk şirketlerinin iç IT ekipleri için geliştirilen self-hosted IT Envanter & Yönetim Platformu'nun demo-ready MVP checkpoint'idir.

Bu checkpoint; envanter, zimmet, bakım, lisans, hatırlatıcı, ticket, onay, audit, personel import, kullanıcı aktivasyonu, backup otomasyonu ve admin operasyon konsolunu kapsar.

## Tag Bilgisi

- Tag: `v0.1.0-demo`
- Commit: `0b3989e`
- Branch: `main`
- Durum: Demo-ready MVP checkpoint

## Kapsanan Ana Modüller

### Envanter / Varlık Yönetimi

- Varlık listesi.
- Kategori/durum bilgisi.
- Garanti ve bakım tarihleri.
- Detail drawer.
- Excel export.

### Zimmet Yönetimi

- Personel-varlık atama.
- Aktif zimmet görünürlüğü.
- İade akışı.
- Zimmet geçmişi.

### Bakım / Onarım / İmha

- Bakım ve onarım kayıtları.
- Maliyet ve servis bilgisi.
- Sonraki bakım tarihi.
- İmha kayıtları.

### Lisans & Abonelik

- Lisans/subscription kayıtları.
- Bitiş tarihi takibi.
- Restore/soft-delete davranışı.
- Audit entegrasyonu.

### Hatırlatıcılar

- Garanti.
- Bakım.
- Lisans bitişi.
- Dismiss/cancel davranışı.

### Ticket / Talep Yönetimi

- Requester portal.
- Approver flow.
- Technician workspace.
- Queue filtreleri.
- Chat.
- İç not / talep sahibine yanıt ayrımı.
- Status/solution composer.
- Context panel.
- Audit trace.

### Personel & HR Import

- Excel/CSV dry-run.
- Commit.
- Import history.
- Error report.
- User linking/create.
- Activation-needed kullanıcı yönetimi.

### Kullanıcı Davet / Aktivasyon

- Inactive + unusable user desteği.
- Token hash yaklaşımı.
- Tek kullanımlık activation link.
- Activation page.
- Davet listesi/revoke/regenerate polish.

### Admin Console

- System health.
- Backup health.
- Operational guidance.
- Copy command yaklaşımı.
- Kullanıcı/personel yönetimi.
- Safe user actions.
- Audit traceability.

### Audit Log

- Merkezi audit sayfası.
- Entity/action filtreleri.
- Detail drawer.
- User/ticket action traceability.

### Backup & Operations

- PostgreSQL backup.
- Media backup.
- Scheduled backup runner.
- Manifest.
- Verify latest backup.
- Retention cleanup.
- Restore drill dokümantasyonu.

## Güvenlik ve Operasyon Notları

- Backend RBAC gerçek güvenlik kaynağıdır.
- Frontend RBAC sadece UX katmanıdır.
- Refresh token httpOnly cookie yaklaşımı korunur.
- Login rate limiting ve Redis/shared cache altyapısı vardır.
- User actions reason + exact confirmation + audit ile çalışır.
- Last active admin guard vardır.
- Self-deactivate/self-role-change engellenir.
- Raw activation token DB veya audit log içinde saklanmaz.
- Browser'dan backup/restore script execute edilmez.
- Restore otomatik değildir; explicit `RESTORE` onayı gerektirir.

## Test / Validation Durumu

Bu checkpoint öncesi tamamlanan doğrulamalar:

- Backend full test suite geçti.
- Frontend TypeScript build geçti.
- Vite production build geçti.
- E2E smoke geçti.
- Backup verify healthy.
- Mojibake/encoding sweep tamamlandı.
- CI yeşil.

## Demo Dokümanları

- `docs/demo/demo-script.md`
- `docs/demo/final-qa-checklist.md`
- `docs/demo/demo-data-checklist.md`
- `docs/demo/manual-smoke-script.md`
- `docs/demo/known-issues-and-limitations.md`

## Operasyon Dokümanları

- `docs/operations/production-readiness.md`
- `docs/operations/backup-restore.md`
- `docs/operations/scheduled-jobs.md`
- `docs/operations/admin-console.md`
- `docs/operations/admin-users.md`
- `docs/operations/ticket-workspace.md`
- `docs/operations/e2e-smoke.md`

## Bilinen Sınırlar

- Email invitation delivery yok.
- WebSocket/realtime yok.
- SNMP/agent discovery yok.
- Multi-tenant/SaaS yok.
- Advanced SLA automation yok.
- Browser'dan backup/restore execute yok.
- Password reset yok.
- User delete yok.
- Büyük veri hacminde bazı filtreler ileride optimize edilebilir.

## Sonraki Olası Fazlar

- P13 — Lightweight Monitoring / Log Review.
- P14 — Deploy Packaging / Self-hosted Install Guide.
- P15 — Email Invitation Delivery.
- Ticket workspace focused tests.
- Code splitting / performance polish.

