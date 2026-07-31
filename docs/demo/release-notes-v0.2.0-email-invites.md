# v0.2.0-email-invites — Email Invitation Delivery Checkpoint

## Özet

Bu sürüm, IT Envanter & Yönetim Platformu'na güvenli ve opsiyonel Email Invitation Delivery desteği ekleyen ürünleşme checkpoint'idir.

Bu checkpoint ile admin tarafından oluşturulan kullanıcı davetlerinde sistem e-posta göndermeyi deneyebilir. SMTP/email delivery kapalıysa veya gönderim başarısız olursa davet geçerli kalır ve admin manual copy fallback ile aktivasyon linkini güvenli kanaldan paylaşabilir.

## Tag Bilgisi

- Tag: `v0.2.0-email-invites`
- Durum: Email invitation delivery checkpoint
- Önceki önemli checkpoint: `v0.1.0-demo`

## Bu Sürümde Kapanan Fazlar

### P15a — Email Invitation Delivery Design Gate

- Email invitation delivery tasarım kararları netleştirildi.
- Event matrix yazıldı.
- Failure handling kararı alındı.
- Audit/log/security guardrail'leri belirlendi.
- P15b/P15c/P15d rollout planı oluşturuldu.

### P15b — Backend Email Delivery

- Django built-in email backend ile invitation email delivery altyapısı eklendi.
- Yeni dependency eklenmedi.
- Invitation create/regenerate sonrası email send attempt yapılıyor.
- `email_delivery` response metadata eklendi.
- Email disabled/sent/failed davranışları backend testleriyle doğrulandı.
- Email failure invitation transaction'ını rollback etmiyor.
- Raw activation URL, raw token ve `token_hash` audit/log içine yazılmıyor.

### P15c — Admin Users Email UX Polish

- Admin Users ekranı `email_delivery` sonucunu gösterecek şekilde güncellendi.
- `sent`, `failed`, `skipped` durumları admin'e anlaşılır mesajlarla gösteriliyor.
- Manual copy fallback korundu.
- Activation URL transient davranışı korundu.
- Backend davranışı değiştirilmedi.

### P15d — Email Delivery QA / Docs / E2E

- Email delivery operasyon rehberi eklendi.
- `.env.example` ve production env template placeholder SMTP alanlarıyla güncellendi.
- Monitoring/log review dokümanına email debug bölümü eklendi.
- Production readiness, deploy, admin users, demo QA ve README güncellendi.
- E2E smoke geçti.
- Full backend ve frontend validation geçti.

## Email Delivery Davranışı

| Durum | Backend sonucu | Admin UI | Manual fallback |
| --- | --- | --- | --- |
| E-posta gönderildi | `sent` | Davet e-postası gönderildi | Korunur |
| E-posta kapalı | `skipped` | E-posta gönderimi kapalı, link manuel paylaşılabilir | Korunur |
| E-posta başarısız | `failed` | Davet oluşturuldu ama e-posta gönderilemedi | Korunur |

Ana karar:
Email gönderimi başarısız olsa bile davet geçerli kalır. E-posta ikinci teslimat kanalıdır; invitation state ana kaynaktır.

## Güvenlik Kararları

- Raw activation URL sadece transient create/regenerate response ve email body içinde bulunabilir.
- Raw activation URL DB/audit/log içine yazılmaz.
- Raw token DB/audit/log içine yazılmaz.
- `token_hash` response/audit/log içine yazılmaz.
- Email body loglanmaz.
- SMTP secret loglanmaz.
- Email failure raw exception olarak kullanıcıya dönmez.
- Manual copy fallback korunur.
- Password reset bu sürümün kapsamı değildir.
- Bulk invite bu sürümün kapsamı değildir.

## Environment / SMTP Notları

- Email delivery default olarak kapalı olabilir.
- `INVITATION_EMAIL_ENABLED=false` iken davet akışı çalışmaya devam eder.
- Production'da SMTP değerleri deployment secret olarak yönetilmelidir.
- `EMAIL_HOST_PASSWORD` gerçek secrettir ve commit edilmez.
- `APP_FRONTEND_URL` doğru frontend domain'i göstermelidir.
- HTTPS production cookie ve activation link güvenliği için önemlidir.

## Test / Validation Durumu

Bu checkpoint öncesi:

- Backend accounts tests geçti.
- Full backend test suite geçti.
- Frontend TypeScript build geçti.
- Vite production build geçti.
- E2E smoke 6/6 geçti.
- CI yeşil.
- Mojibake taraması temiz.
- Secret/raw activation URL taraması gerçek secret bulmadı.

## Güncellenen Dokümantasyon

- `docs/operations/email-invitation-delivery-design.md`
- `docs/operations/email-invitation-delivery.md`
- `docs/operations/monitoring-log-review.md`
- `docs/operations/production-readiness.md`
- `docs/operations/admin-users.md`
- `docs/deploy/self-hosted-install.md`
- `docs/deploy/env.production.example`
- `docs/demo/known-issues-and-limitations.md`
- `docs/demo/final-qa-checklist.md`
- `docs/demo/manual-smoke-script.md`
- `README.md`

## v0.1.0-demo'dan Farkı

`v0.1.0-demo` sürümü demo-ready MVP checkpoint idi.

`v0.2.0-email-invites` ile ürün şu açıdan gelişti:

- Kullanıcı davetleri artık opsiyonel SMTP email delivery destekli.
- Admin UI email gönderim sonucunu gösterebiliyor.
- SMTP kapalı/başarısız olsa bile manual fallback güvenli şekilde korunuyor.
- Email delivery için operasyon, monitoring, deploy ve production readiness dokümantasyonu tamamlandı.

## Bilinen Sınırlar

- Password reset yok.
- Bulk invitation yok.
- Email retry queue/background worker yok.
- Email open/click tracking yok.
- Gerçek SMTP delivery production env ile ayrıca yapılandırılmalıdır.
- SMTP kapalıysa sistem manual copy fallback ile çalışır.
- WebSocket/realtime yok.
- SNMP/agent discovery yok.
- Multi-tenant/SaaS yok.

## Sonraki Olası Fazlar

- P16 — Fresh Clone / Fresh Machine Install Drill
- P17 — Production-like SMTP Smoke Drill
- P18 — Demo Package / Presentation Kit
- P19 — Lightweight Monitoring Implementation veya Performance Polish
