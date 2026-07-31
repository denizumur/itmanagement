# Email Invitation Delivery Operasyon Rehberi

## 1. Kapsam

Admin kullanıcı daveti oluşturduğunda sistem e-posta göndermeyi deneyebilir. E-posta gönderimi invitation state'in ana kaynağı değildir; mail gönderilemezse davet yine geçerli kalır. Admin manual copy fallback ile aktivasyon linkini güvenli kanaldan paylaşabilir.

Password reset, bulk invite, email campaign, open/click tracking ve browser'dan SMTP test execute kapsam dışıdır.

## 2. Davranış Özeti

| Durum | Backend sonucu | Admin UI mesajı | Manual fallback |
| --- | --- | --- | --- |
| Email sent | `sent` | Davet e-postası gönderildi | Korunur |
| Email disabled | `skipped` | SMTP yapılandırması kapalı olduğu için e-posta gönderilmedi | Korunur |
| Email failed | `failed` | Davet oluşturuldu ancak e-posta gönderilemedi | Korunur |
| Missing recipient | `skipped` safe reason | Kullanıcı e-postası yok veya teslimata uygun değil | Korunur |

## 3. Güvenlik Kararları

- Raw activation URL sadece create/regenerate response ve email body içinde bulunabilir.
- DB, audit ve backend log içinde raw activation URL yoktur.
- `token_hash` response, audit veya log içine yazılmaz.
- Email body loglanmaz.
- SMTP secret loglanmaz.
- Failure raw exception kullanıcıya dönmez.
- Manual copy fallback bilinçli güvenlik/operasyon fallback'idir.

## 4. Local/dev Davranışı

- Default email delivery kapalıdır.
- `INVITATION_EMAIL_ENABLED=False` ise invitation create çalışır ama email delivery `skipped` döner.
- Local/dev smoke gerçek SMTP gerektirmez.
- E2E smoke production'da çalıştırılmamalıdır.

## 5. Production SMTP Davranışı

- SMTP env değerleri deployment secret olarak yönetilir.
- `EMAIL_HOST_PASSWORD` gerçek secrettir, commit edilmez.
- `DEFAULT_FROM_EMAIL` doğrulanmış sender/domain olmalıdır.
- HTTPS ve frontend base URL doğru olmalıdır.
- Yanlış frontend URL activation linklerini yanlış domainle üretir.
- `EMAIL_USE_TLS` ve `EMAIL_USE_SSL` aynı anda true olmamalıdır.

## 6. Admin Kullanım Akışı

1. Admin Users açılır.
2. Inactive/unusable user seçilir.
3. Davet oluşturulur veya yeni davet üretilir.
4. UI email delivery sonucunu gösterir.
5. Activation URL geçici görünür.
6. Admin gerekirse copy fallback kullanır.
7. Refresh sonrası raw activation URL kaybolur; bu doğru davranıştır.

## 7. Failure Triage

### `email_disabled`

Anlamı: `INVITATION_EMAIL_ENABLED=False`.

Admin: Geçici activation linkini kopyalayıp güvenli kanaldan paylaşabilir.

Ops: SMTP delivery isteniyorsa `.env` ve deploy secret yönetimini kontrol eder.

### `missing_recipient_email`

Anlamı: Kullanıcının e-posta adresi yoktur.

Admin: Personel/kullanıcı e-posta bilgisini kontrol eder veya manual fallback kullanır.

Ops: Import ve user-linking verilerinde e-posta alanının beklenen şekilde dolduğunu kontrol eder.

### `smtp_config_missing`

Anlamı: SMTP için gerekli host/sender/credential yapılandırması eksik olabilir.

Admin: Linki güvenli kanaldan paylaşır.

Ops: SMTP env değerlerini, verified sender değerini ve deployment secret kaynağını kontrol eder.

### `invalid_email`

Anlamı: Recipient veya sender e-posta formatı teslimata uygun değildir.

Admin: Kullanıcı e-postasını doğrular.

Ops: Import verisi, user profile ve SMTP sender/domain yapılandırmasını kontrol eder.

### `send_exception`

Anlamı: Mail backend gönderim sırasında güvenli şekilde sınıflandırılamayan hata aldı.

Admin: Manual copy fallback kullanır.

Ops: Backend loglarında sanitized reason code, SMTP sağlayıcı durumu, timeout ve TLS/SSL ayarlarını kontrol eder.

## 8. Redaction Rules

Asla paylaşılmayacaklar:

- Raw activation URL.
- Raw token.
- `token_hash`.
- SMTP password.
- Email body.
- Cookie/JWT.
- Full `.env`.

Paylaşılabilir:

- Delivery status.
- Safe reason code.
- Masked recipient.
- Endpoint path.
- Timestamp.
- Sanitized error summary.

## 9. İlgili Dokümanlar

- `docs/operations/email-invitation-delivery-design.md`
- `docs/operations/admin-users.md`
- `docs/operations/monitoring-log-review.md`
- `docs/operations/production-readiness.md`
- `docs/deploy/self-hosted-install.md`

