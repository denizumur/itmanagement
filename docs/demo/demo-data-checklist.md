# Demo Data Checklist

Demo sırasında boş veya anlamsız ekran kalmaması için bu liste local/demo ortam hazırlığında kullanılır. Production verisi gibi riskli otomatik reset yapılmaz.

## Mevcut seed komutları

Repo içinde domain bazlı demo/seed komutları vardır:

- `python manage.py seed_company_org`
- `python manage.py seed_asset_categories`
- `python manage.py seed_demo_employees`
- `python manage.py seed_demo_assets`
- `python manage.py seed_demo_assignments`
- `python manage.py seed_demo_maintenance_records`
- `python manage.py seed_demo_licenses`

Bu komutlar gerçek production seed planı değildir; local/demo hazırlığında kullanılmadan önce hedef ortamın production olmadığından emin olun.

## Veri kategorileri

- [ ] Envanter varlıkları var.
- [ ] Kategoriler var.
- [ ] Departmanlar var.
- [ ] Personeller var.
- [ ] User - Employee bağlantıları kontrol edildi.
- [ ] Admin, Teknisyen, Talep sahibi ve Onaycı demo kullanıcıları hazır.
- [ ] Aktif zimmet kayıtları var.
- [ ] Bakım kayıtları var.
- [ ] Lisans/subscription kayıtları var.
- [ ] Hatırlatıcılar var.
- [ ] Açık ticket var.
- [ ] İşlemde ticket var.
- [ ] Onay bekleyen ticket var.
- [ ] Reddedilmiş ticket var.
- [ ] Çözülmüş ticket var.
- [ ] Audit log örnekleri var.
- [ ] Backup manifest var.

## Demo kullanıcıları

E2E smoke runner local/dev ortamda şu kullanıcıları hazırlar:

| Rol | Kullanıcı |
| --- | --- |
| Admin | `deniz` |
| Talep sahibi | `requester.demo` |
| Teknisyen | `technician.demo` |
| Onaycı | `idari.mali.manager` |
| Invitation smoke | `e2e.invite.user` |

Gerçek şifreler dokümana yazılmaz. Local demo ortamında girişten önce belirlenen demo şifresi güvenli kanaldan paylaşılır veya runner/seed hazırlığı sırasında ayarlanır.

## Demo öncesi manuel hazırlık

1. Ortamın production olmadığını doğrulayın.
2. Docker servislerini başlatın.
3. Migration ve backend check çalıştırın.
4. Gerekliyse seed komutlarını local/demo veritabanında çalıştırın.
5. E2E smoke runner ile rol kullanıcılarının giriş yapabildiğini doğrulayın.
6. Admin Console üzerinde backup manifest, Redis/cache ve security uyarılarını kontrol edin.
7. Ticket demo akışı için gerekli açık/onay bekleyen/çözülmüş kayıtların varlığını kontrol edin.

E2E user hazırlık scriptleri gerçek demo seed scriptleriyle karıştırılmamalıdır. Smoke runner kullanıcı şifrelerini local/dev amaçlı resetler.

