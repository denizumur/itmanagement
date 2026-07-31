# Known Issues and Limitations

Bu doküman demo öncesi bilinen sınırları dürüstçe görünür kılar. Liste güvenli ürün anlatımı için hazırlanmıştır; yeni feature vaadi değildir.

## Bilinen sınırlamalar

- Email invitation delivery SMTP ile etkinleştirilebilir; default kapalıysa activation link admin tarafından güvenli kanaldan paylaşılır.
- Real-time/WebSocket yoktur; bazı ekranlarda güncel durum için refresh veya yeniden sorgu gerekir.
- Enterprise ITSM seviyesinde SLA automation yoktur.
- Scheduled backup OS scheduler ile kurulmalıdır; uygulama içinden çalıştırılmaz.
- Restore otomatik değildir; explicit `RESTORE` onayı gerektirir.
- SNMP/agent discovery yoktur; inventory manual-first ilerler.
- Multi-tenant/SaaS yoktur; self-hosted single-tenant yaklaşımı vardır.
- Büyük veri hacminde bazı admin filtreleri ileride optimize edilebilir.
- Advanced alerting/monitoring henüz ürüne gömülü değildir; host ve Docker logları izlenmelidir.

## Bilinçli güvenlik kararları

- Browser'dan backup/restore script execute yoktur.
- Raw token sadece activation link create response sonrasında geçici gösterilir.
- Password reset yoktur.
- User delete yoktur.
- Bulk destructive action yoktur.
- Last active admin guard vardır.
- Backup artifact download linki gösterilmez.
- Secret, password hash, token hash, connection string, full backup path ve import row data UI veya dokümanlarda paylaşılmaz.

## Demo sırasında söylenecek güvenli açıklamalar

- MVP'de kontrollü ve güvenli operasyonu tercih ettik.
- Riskli aksiyonları explicit confirmation ve audit ile sınırlandırdık.
- Advanced SLA, discovery ve gelişmiş monitoring sonraki fazlara bırakıldı.
- Bu ürün self-hosted şirket içi operasyon odağında tasarlandı; SaaS/multi-tenant platform gibi konumlandırılmamalıdır.
