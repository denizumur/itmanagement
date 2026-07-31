# Demo Script

Bu doküman IT Envanter ve Yönetim Platformu için 5-8 dakikalık ürün demosu akışını özetler.

## Ürün pozisyonlaması

Bu platform, küçük ve orta ölçekli Türk şirketlerinde IT ekiplerinin Excel, WhatsApp ve e-posta üzerinde dağınık yürüttüğü envanter, zimmet, bakım, lisans, hatırlatıcı ve ticket süreçlerini tek self-hosted panelde toplar.

## Hedef kullanıcılar

- IT yöneticisi / admin.
- Teknisyen.
- Talep sahibi personel.
- Onaycı yönetici.

## Açılış cümlesi

Şirket içi IT operasyonlarında sorun çoğu zaman araç eksikliği değil, bilginin dağınık olmasıdır: varlıklar Excel'de, zimmetler e-postada, bakım hatırlatmaları kişisel takvimlerde, talepler WhatsApp konuşmalarında kalır. Bu ürün bu dağınıklığı tek, self-hosted ve audit izli bir operasyon panelinde toplar. Amaç büyük enterprise ITSM karmaşıklığı değil; güvenli, anlaşılır ve gerçek günlük iş akışına yakın bir omurga sağlamaktır.

## Demo akış sırası

1. Login: Admin hesabıyla giriş yapılır; erişim, refresh ve logout akışının güvenli cookie/JWT yapısı vurgulanır.
2. Admin Dashboard / Genel Bakış: Operasyonun ana sinyalleri ve hızlı taranabilir yapı gösterilir.
3. Envanter / Varlıklar: Varlık listesi, filtreler, detay paneli, kategori/durum bilgisi ve audit bağlantıları gösterilir.
4. Zimmet: Aktif zimmet kayıtları, personel-varlık ilişkisi ve geçmiş izlenebilirliği anlatılır.
5. Bakım: Bakım kayıtları, gecikme riski ve planlı operasyon görünürlüğü gösterilir.
6. Lisans: Lisans/subscription takibi, bitiş tarihleri ve sorumlu kişi görünürlüğü anlatılır.
7. Hatırlatıcılar: Kritik tarihlerin ve operasyon hatırlatmalarının merkezi takibi gösterilir.
8. Personel import + user activation: Excel import dry-run/commit, import geçmişi, hata raporu ve davet/aktivasyon hikayesi anlatılır.
9. Admin Console: Sistem sağlığı, Redis/cache, backup manifest, import, davet ve operasyon sinyalleri gösterilir.
10. Admin Users: User - Employee bağlantısı, güvenli aksiyonlar, explicit confirmation ve audit trace gösterilir.
11. Talep sahibi ticket oluşturma: `/my-tickets` portalı ve talep formu gösterilir.
12. Onaycı akışı: `/approvals` portalında bekleyen talebin onay/red davranışı anlatılır.
13. Teknisyen ticket workspace: `/tickets` kuyruğu, chat, talep sahibine yanıt, iç not ve status composer gösterilir.
14. Audit trace: Kullanıcı aksiyonları, ticket geçişleri ve operasyon kayıtlarının audit sayfasında izlenebilir olduğu gösterilir.
15. Backup health / production readiness: Son backup verify sonucu, restore drill yaklaşımı ve production checklist kapanışta vurgulanır.

## Kapanış

Bu sistem MVP olarak gerçek IT operasyonunun omurgasını kapsıyor. Büyük enterprise ITSM değil; Excel, WhatsApp ve e-posta karmaşasını azaltan, self-hosted, pratik ve güvenlik sınırları belirgin bir çözüm.

