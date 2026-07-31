# Final QA Checklist

Demo öncesi bu liste rol bazlı manuel smoke için kullanılır. Bu doküman yeni test veya workflow tanımlamaz; mevcut ekranların beklendiği gibi açıldığını ve güvenlik sınırlarının korunduğunu kontrol eder.

## Admin QA

- [ ] Login olur.
- [ ] Dashboard açılır.
- [ ] Envanter listesi görünür.
- [ ] Varlık detayları açılır.
- [ ] Personel listesi görünür.
- [ ] HR import paneli görünür.
- [ ] Import history/error report akışı görünür.
- [ ] Admin Console açılır.
- [ ] Backup health görünür.
- [ ] Admin Users açılır.
- [ ] User - Employee bağlantısı görünür.
- [ ] Safe actions panel görünür.
- [ ] Audit sayfası açılır.
- [ ] Production guidance dokümanları tutarlı.

## Teknisyen QA

- [ ] Login olur.
- [ ] Ticket workspace açılır.
- [ ] Queue görünür.
- [ ] Filter/search çalışır.
- [ ] Ticket detail açılır.
- [ ] Chat talep sahibine yanıt / iç not ayrımı nettir.
- [ ] Status composer görünür.
- [ ] Context panel görünür.
- [ ] Audit link görünür.
- [ ] İç not talep sahibine sızmaz.

## Talep Sahibi QA

- [ ] Login olur.
- [ ] `/my-tickets` açılır.
- [ ] Talep oluşturma formu görünür.
- [ ] Kendi ticketlarını görür.
- [ ] Progress stepper görünür.
- [ ] Public yanıtları görür.
- [ ] İç not görmez.
- [ ] Aktivasyon/davet akışı gerekiyorsa login yapabilir.

## Onaycı QA

- [ ] Login olur.
- [ ] `/approvals` açılır.
- [ ] Bekleyen onayları görür.
- [ ] Approve/reject davranışı mevcut testlerle uyumludur.
- [ ] Reddedilen ticket IT queue'ya düşmez.
- [ ] Onaylanan ticket IT queue'ya düşer.

## Security QA

- [ ] Non-admin admin console göremez.
- [ ] Talep sahibi iç not göremez.
- [ ] Last active admin guard korunur.
- [ ] Token, hash veya password görünmez.
- [ ] Backup artifact download yoktur.
- [ ] Restore otomasyonu yoktur.
- [ ] Explicit confirmation gerektiren işlemler korunur.

