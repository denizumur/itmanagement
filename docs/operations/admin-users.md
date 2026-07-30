# Admin Users Runbook

`/admin-console/users` ekranı kullanıcı hesapları ile personel kayıtları arasındaki bağlantıyı admin-only olarak gösterir ve sınırlı güvenli kullanıcı aksiyonları sağlar.

## Filtreler

- Search: kullanıcı adı, görünen ad, personel adı veya personel kodu.
- Role: admin, technician, viewer, requester, approver.
- Active status: aktif veya pasif.
- Activation state: active, needs activation, pending invitation, expired invitation, no employee.
- Has employee: personel bağlantısı var/yok.
- Invitation status: pending, accepted, revoked, expired veya none.

## Durum anlamları

- Active: kullanıcı aktif ve kullanılabilir kimlik bilgisine sahip.
- Needs activation: kullanıcı pasif veya henüz kullanılabilir kimlik bilgisi yok.
- Pending invitation: geçerli bekleyen davet var.
- Expired invitation: davet süresi dolmuş.
- No employee: kullanıcı personel kaydıyla bağlı değil.

## Güvenli Kullanıcı Aksiyonları

Admin kullanıcılar detay panelinden şu sınırlı işlemleri yapabilir:

- Kullanıcı pasifleştirme.
- Kullanıcıyı yeniden aktifleştirme.
- Rol değiştirme.
- Davet oluşturma.
- Bekleyen daveti iptal etme.

Pasifleştirme, yeniden aktifleştirme ve rol değiştirme işlemleri gerekçe ve tam onay metni ister. Onay metinleri hedef kullanıcı adına bağlıdır:

- `DEACTIVATE <username>`
- `REACTIVATE <username>`
- `CHANGE ROLE <username>`

Backend son kararı verir. Kendi hesabını pasifleştirme, kendi rolünü değiştirme, son aktif admin kullanıcısını pasifleştirme veya admin rolünden düşürme engellenir. Kullanılabilir kimlik bilgisi olmayan kullanıcılar davet akışı tamamlanmadan yeniden aktifleştirilemez.

Her state-changing işlem audit log üretir. Metadata içinde operasyon, actor/target id, target username, eski/yeni aktiflik, eski/yeni rol, gerekçe ve `source=admin_console` bulunur.

## Güvenlik sınırları

Bu ekran şunları göstermez ve çalıştırmaz:

- Hash veya raw credential.
- Raw token, token hash veya activation URL list/detail response içinde.
- User create/delete veya hard delete.
- Bulk action.
- Raw credential set veya reset.

Activation URL sadece davet oluşturma isteği başarılı olduktan sonra frontend üzerinde geçici olarak gösterilir; list/detail API response içine yazılmaz.

## Troubleshooting

- Inactive + no invitation: Admin Users detay panelinden yeni davet oluşturun.
- Pending expired: Yeni davet oluşturun veya bekleyen daveti iptal edip akışı tekrarlayın.
- User without employee: Personel kaydıyla eşleştirme gerekip gerekmediğini kontrol edin.
- Last active admin guard: Önce ikinci aktif admin hesabını doğrulayın, sonra rol veya aktiflik değişikliği yapın.
