# Admin Users Runbook

`/admin-console/users` ekranı kullanıcı hesapları ile personel kayıtları arasındaki bağlantıyı admin-only ve read-only olarak gösterir.

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

## Güvenlik sınırları

Bu ekran şunları göstermez ve çalıştırmaz:

- Password hash.
- Raw token, token hash veya activation URL.
- User create/update/delete/deactivate.
- Role change.
- Password reset.
- Invitation create/revoke.

Davet linki gerektiğinde Personel detay ekranındaki mevcut güvenli davet akışı kullanılmalıdır.

## Troubleshooting

- Inactive + no invitation: Personel sayfasında kullanıcı bağlantısını ve davet durumunu kontrol edin.
- Pending expired: Personel detayından yeni davet linki üretin.
- User without employee: Personel kaydıyla eşleştirme gerekip gerekmediğini kontrol edin.
- Employee without user: Personel import/linking akışını Personel sayfasından yönetin.
