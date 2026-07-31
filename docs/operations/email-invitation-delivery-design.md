# Email Invitation Delivery Design Gate

## 1. Kapsam

Bu doküman implementation değildir. Bu fazda kod değişikliği yapılmaz. Amaç P15b/P15c/P15d için email invitation delivery kararlarını güvenli ürün, backend, frontend, operasyon ve QA perspektifinden netleştirmektir.

Mevcut manuel copy fallback korunacaktır. Password reset, user delete ve bulk email/invite campaign kapsam dışıdır. Bu doküman SMTP secret, raw activation URL, token, token hash, gerçek domain veya gerçek kullanıcı verisi içermez.

## 2. Current State

Mevcut davet/aktivasyon akışı şu şekilde çalışır:

- Admin inactive/unusable password user için invitation oluşturabilir.
- `UserInvitation` modeli `token_hash` saklar.
- Raw token sadece create response sırasında activation URL olarak döner.
- Activation URL DB'de saklanmaz.
- Accept endpoint token ile password set eder, user active yapar ve invitation status değerini accepted yapar.
- Revoke ve regenerate/new invitation akışı vardır; yeni pending invitation oluşturulurken önceki pending invitation revoked yapılır.
- Admin Users drawer manual copy fallback sağlar.
- E2E activation smoke vardır.
- Local/dev smoke runner test kullanıcılarını hazırlar.
- Production email delivery şu an yoktur.

Kaynak dosya referansları:

- `backend/apps/accounts/models.py`
- `backend/apps/accounts/views.py`
- `backend/apps/accounts/serializers.py`
- `backend/apps/accounts/urls.py`
- `backend/apps/accounts/tests.py`
- `frontend/src/api/accounts.ts`
- `frontend/src/pages/AdminUsersPage.tsx`
- `frontend/src/types/adminUsers.ts`
- `docs/operations/admin-users.md`

## 3. Goals / Non-goals

Goals:

- Invitation create sonrası e-posta gönderimi tasarlamak.
- Regenerate/new invitation sonrası e-posta gönderimi tasarlamak.
- Revoke sonrası e-posta gönderilmemesi kararını netleştirmek.
- Manual copy fallback davranışını korumak.
- Email failure state davranışını netleştirmek.
- Local/dev email backend yaklaşımını tanımlamak.
- Production SMTP/env yaklaşımını tanımlamak.
- Audit/log redaction kurallarını belirlemek.
- Monitoring/log review güncelleme ihtiyacını tarif etmek.
- Backend test planını hazırlamak.
- Frontend UX planını hazırlamak.
- E2E/local smoke etkisini netleştirmek.

Non-goals:

- Password reset.
- User delete.
- Bulk invitation.
- Email campaign.
- Rich HTML marketing email.
- Celery/background queue.
- Retry queue.
- Webhook tracking.
- Email open/click tracking.
- SaaS/multi-tenant email settings.
- Browser'dan SMTP test execute.
- SMTP secret UI'da gösterme.

## 4. Event Matrix

| Event | Email gönderilsin mi? | Manual copy fallback | Audit | Not |
| --- | --- | --- | --- | --- |
| New invitation created for inactive user | Yes, send attempt | Yes | Yes | Ana P15 delivery noktası. |
| Regenerate invitation / create new pending invitation | Yes, send attempt | Yes | Yes | Sadece en yeni invitation linki geçerli olmalı. |
| Revoke invitation | No | Not needed | Yes | P15'te revoke notification yok. |
| Accepted invitation | No | Not needed | Yes | P15'te activation success email yok. |
| Expired invitation | No | Admin new invitation oluşturabilir | Status/audit mevcut akışla izlenir | Scheduled expiry email yok. |
| Admin creates inactive user via HR import | No | Invitation henüz yok | Import audit | HR import otomatik mail göndermez. |
| Admin creates invitation after HR import | Yes, send attempt | Yes | Yes | Explicit admin invitation action gerekir. |
| Admin reactivates existing user | No | Not needed | Yes | Invitation flow kullanılmadıkça mail yok. |
| User activation failed due invalid token | No | Not applicable | Security/audit mevcut yaklaşımla | Invalid token için mail yok. |
| User activation success | No | Not needed | Yes | P15'te success email yok. |

## 5. Failure Handling Design

Email send failure durumunda:

- `UserInvitation` create işlemi geri alınmayacak.
- Invitation geçerli kalacak.
- Activation URL create response içinde yine dönebilecek.
- Admin manual copy fallback kullanabilecek.
- API response güvenli bir `email_delivery` özeti dönebilir.
- Email failure raw exception detayları kullanıcıya dönmeyecek.
- Backend log sanitized summary yazacak.
- Audit log activation URL veya token içermeyecek.

Tasarım seçenekleri:

| Seçenek | Davranış | Artı | Eksi |
| --- | --- | --- | --- |
| A | Email failure invitation creation'ı fail eder | Mail teslimatı zorunlu hale gelir | SMTP sorunu kullanıcı/davet state'ini bozar |
| B | Email failure invitation creation'ı fail etmez; response warning döner | Manual fallback korunur, davet geçerli kalır | Admin warning'i okumalı ve linki güvenli kanaldan paylaşmalı |

Karar: B seçilmeli.

Gerekçe:

- Davet linkinin üretilmesi ana iş akışıdır.
- E-posta ikinci kanal teslimatıdır.
- Mail sağlayıcı problemi kullanıcı oluşturma/davet state'ini bozmamalıdır.
- Manual copy fallback zaten vardır.

## 6. Backend Design

P15b için önerilen backend tasarımı:

- Django built-in email backend kullanılmalı.
- Yeni dependency eklenmemeli.
- Local/dev için console, file veya locmem email backend tercih edilmeli.
- Production için SMTP env config ile etkinleştirilmeli.
- Email gönderimi service/helper içinde izole edilmeli.
- Önerilen dosya adı: `backend/apps/accounts/emailing.py`.
- Mevcut service pattern varsa aynı pattern takip edilmeli.
- Invitation create/regenerate flow içinde send attempt yapılmalı.
- Send sonucu response'a safe metadata olarak eklenmeli.
- Audit log email attempt bilgisini güvenli şekilde yazabilir.

Önerilen safe response alanı:

```json
{
  "email_delivery": {
    "attempted": true,
    "status": "sent",
    "reason": "safe_short_code",
    "recipient_masked_email": "masked value"
  }
}
```

Status değerleri P15b'de netleştirilmeli:

- `sent`
- `failed`
- `skipped`

Audit metadata içine yazılabilir:

- `email_delivery_attempted`
- `email_delivery_status`
- `email_delivery_error_code`
- masked recipient email

Audit/log/response içine yazılmayacaklar:

- activation URL
- raw token
- email body
- SMTP username/password
- stack trace
- token hash

## 7. Email Template Design

E-posta içeriği sade ve güvenli olmalıdır. Plain text önceliklidir. HTML opsiyonel olabilir ama P15'te zorunlu değildir.

İçerik:

- Ürün/platform adı.
- Kullanıcıya hesap aktivasyonu için davet edildiği bilgisi.
- Activation link.
- Linkin süreli olduğu bilgisi.
- Daveti beklemiyorsa IT/admin ile iletişime geçmesi gerektiği.
- Şifre bu mailde yoktur bilgisi.
- Generic admin contact yönlendirmesi.

Yazılmayacaklar:

- Temporary password.
- Raw token dışında ayrı gizli bilgi.
- Kullanıcının tüm profil/personel detayları.
- Internal role/permission detayları.
- Audit/debug bilgisi.
- SMTP detayları.

Activation link mailde bulunacaktır, çünkü email delivery'nin amacı budur. Ancak DB, audit, backend log, frontend kalıcı state veya dokümana raw activation URL yazılmayacaktır.

## 8. Environment / SMTP Design

P15b/P15d için önerilen env alanları:

- `EMAIL_BACKEND`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS`
- `EMAIL_USE_SSL`
- `DEFAULT_FROM_EMAIL`
- `SERVER_EMAIL`
- `INVITATION_EMAIL_ENABLED`
- `APP_FRONTEND_URL`

Kararlar:

- Local/dev default console/file/locmem backend veya disabled-send + manual copy fallback olmalı.
- Production SMTP env ile etkinleştirilmeli.
- `EMAIL_HOST_PASSWORD` gerçek secret kabul edilmeli ve commit edilmemeli.
- `.env.example` ve `docs/deploy/env.production.example` sadece placeholder içermeli.
- `EMAIL_USE_TLS` ve `EMAIL_USE_SSL` aynı anda true olmamalı.
- From email verified sender/domain olmalı.
- Activation URL frontend base URL üzerinden üretilmeli.
- Mevcut repo içinde frontend base URL için net env contract görünmediğinden P15b'de `APP_FRONTEND_URL` gibi açık ve backend tarafından kullanılan bir env adı seçilmeli veya mevcut deploy topolojisiyle uyumlu bir isim belirlenmeli.

## 9. Frontend / Admin UX Design

Admin Users drawer içinde davet oluştur/regenerate sonrası:

- Email sent success state gösterilebilir.
- Email failed warning gösterilebilir.
- SMTP disabled/skipped state gösterilebilir.
- Manual copy fallback korunur.
- Activation URL create response sonrası geçici gösterilmeye devam eder.
- Sayfa refresh sonrası raw activation URL kaybolur; bu doğru davranıştır.
- Email failed ise admin linki kopyalayıp güvenli kanaldan paylaşabilir.
- Revoke sonrası email gönderilmez.
- Accepted/revoked/expired state mesajları net olmalıdır.

Önerilen UX metinleri:

- "Davet e-postası gönderildi."
- "Davet oluşturuldu ancak e-posta gönderilemedi. Linki kopyalayıp güvenli kanaldan paylaşabilirsiniz."
- "Davet linki yalnızca bu işlem sonrası geçici olarak gösterilir."
- "SMTP yapılandırması kapalı olduğu için e-posta gönderilmedi."

## 10. Audit / Logging / Monitoring Rules

Audit içine yazılabilir:

- `invitation_id`
- `target_user_id`
- `actor_user_id`
- `operation`
- `email_delivery_attempted`
- `email_delivery_status`
- safe failure code
- masked recipient email

Audit içine yazılmayacak:

- activation URL
- raw token
- token hash
- SMTP password/user
- email body
- full exception trace
- full raw response from SMTP provider

Backend log:

- sanitized error summary yazabilir.
- raw token/URL yazmaz.
- SMTP secret yazmaz.
- full email body yazmaz.

Monitoring doc güncelleme ihtiyacı:

P15d'de `docs/operations/monitoring-log-review.md` içine Email delivery debug bölümü eklenmeli:

- SMTP config missing.
- SMTP auth failed.
- Connection timeout.
- TLS/SSL mismatch.
- Sender rejected.
- Email disabled.

## 11. Security Review

Riskler:

1. Raw activation URL loglanabilir.
2. Token audit metadata'ya yazılabilir.
3. Email failure create transaction'ı bozabilir.
4. SMTP secret commitlenebilir.
5. Mail body fazla kişisel veri içerebilir.
6. Link yanlış frontend domain ile üretilebilir.
7. Expired/revoked link tekrar gönderilebilir.
8. Accepted invitation için tekrar link gönderilebilir.
9. Rate limiting/abuse konusu.

Kararlar:

- Token sadece email body ve create response içinde bulunabilir.
- DB/audit/log asla token içermez.
- Email send accepted/revoked/expired invitation için yapılmaz.
- Email gönderimi sadece admin invitation action sonrası olur.
- HR import otomatik mail göndermez.
- Manual copy fallback korunur.
- Email enabled/disabled env ile kontrol edilebilir.
- Rate limiting mevcut admin/auth güvenliğiyle sınırlıdır; bulk invite P15 kapsam dışıdır.

## 12. Backend Test Plan

P15b için test planı:

1. Invitation create email enabled ise `send_mail` çağrılır veya outbox email içerir.
2. Email body activation link içerir.
3. Email body password içermez.
4. DB invitation token hash içerir ama raw token saklamaz.
5. Audit log activation URL/raw token içermez.
6. Email failure invitation creation'ı rollback etmez.
7. Email failure response safe warning döner.
8. Email disabled durumunda invitation create çalışır, email skipped olur.
9. Revoked invitation email göndermez.
10. Accepted invitation email göndermez.
11. Regenerate/new invitation yalnız latest link için send attempt yapar.
12. Production env missing SMTP safe failure/skip behavior verir.
13. TLS/SSL config sanity mümkünse check veya docs warning ile korunur.
14. Non-admin invitation create hala blocked.
15. Requester/technician invitation endpoint erişemez.

## 13. Frontend QA Plan

P15c için QA planı:

Admin:

- Inactive user için invitation create.
- Email sent success message.
- Email failed warning + copy fallback.
- SMTP disabled skipped message.
- Regenerate invitation.
- Revoke invitation.
- Refresh sonrası raw activation URL görünmez.
- Accepted/revoked invitation state doğru.

Non-admin:

- Admin Users route/action erişemez.

Requester activation:

- Email link ile gelen URL activation page'i açar.
- Password set sonrası login olur.
- Token reuse rejected.

## 14. E2E / Smoke Impact

P15d için E2E kararları:

- Mevcut activation E2E smoke korunmalı.
- E2E smoke production'da çalışmamalı uyarısı korunmalı.
- Email delivery E2E'ye zorunlu SMTP gerektirmemeli.
- Local/dev'de console/file backend veya Django locmem outbox testleri backend testlerde yeterli olabilir.
- E2E sadece activation flow'u kırmadığını doğrular.
- Email send UI state için Playwright test eklenirse SMTP/mock dependency gerektirmemeli.

## 15. Rollout Plan

P15b — Backend Email Delivery:

- env/config.
- email service.
- template.
- invitation create/regenerate send attempt.
- failure handling.
- backend tests.

P15c — Admin Users Email UX Polish:

- response email_delivery render.
- success/warning/skipped messages.
- manual fallback korunması.
- frontend build.
- manual QA.

P15d — Email Delivery QA / Docs / E2E:

- docs update.
- env template update.
- production readiness update.
- monitoring debug update.
- E2E smoke impact.
- final validation.

## 16. Acceptance Criteria

- Current state açık.
- Goals/non-goals açık.
- Event matrix var.
- Failure handling kararı var.
- Backend design var.
- Email template design var.
- Env/SMTP design var.
- Frontend/Admin UX design var.
- Audit/log/monitoring kuralları var.
- Security review var.
- Backend test planı var.
- Frontend QA planı var.
- E2E/smoke impact var.
- P15b/P15c/P15d rollout planı var.
- Secret/password/token yok.
- Raw activation URL örneği yok.
- Kod değişikliği yok.
- Mojibake yok.
- `git diff --check` temiz.

