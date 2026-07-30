# Ticket Workspace Runbook

`/tickets` ekranı technician ve admin kullanıcıların IT ticket kuyruğunu günlük operasyon içinde yönetmesi için kullanılır. Ekran mevcut workflow'u değiştirmez; queue, chat, status composer ve context bilgisini tek workspace içinde görünür kılar.

## Queue filtreleri

- Search: başlık, açıklama, requester veya varlık bilgisi.
- Status: açık, işlemde, çözüldü gibi mevcut durum filtreleri.
- Priority: düşük, normal, yüksek, acil.
- Reset: aktif filtreleri temizler.

Ana queue açık/işlem bekleyen işleri gösterir. Çözülen ticketlar ayrı kompakt alanda listelenir ve ana operasyon kuyruğuyla karışmaz.

## Urgency ve priority

Acil ve yüksek öncelikli ticketlar badge ile görünür. Header telemetry alanı açık, işlemde, acil ve yüksek/acil sayıları hızlı tarama için gösterir. Queue kartları requester, atanan kişi, mesaj/ek sayısı ve son güncelleme bilgisini içerir.

## Requester reply vs internal note

Chat composer iki modu destekler:

- Talep sahibine yanıt: requester tarafından görülebilen public reply.
- İç not: sadece yetkili IT workspace içinde görünen ekip notu.

Internal note requester portalına sızmamalıdır. Backend guard ve mevcut yorum endpoint davranışı korunur. İç not modu görsel olarak warning tonuyla ayrılır ve composer üzerinde talep sahibinin görmeyeceği belirtilir.

## Status transition ve solution note

Status composer mevcut status'u ve seçilecek yeni status'u gösterir. `resolved` veya `closed` seçildiğinde solution/closing note zorunlu alan olarak açılır. Backend zorunluluğu kaynak olmaya devam eder; frontend yalnızca hatayı daha erken ve okunur gösterir.

Başarılı status update sonrası ticket, queue, context ve summary yeniden okunur. Success paneli audit izine bağlantı verir.

## Resolved tickets alanı

Sol alt bölüm son çözülen ticketları kompakt olarak gösterir. Başlık, requester, öncelik ve tarih bilgisiyle hızlı geçmiş taraması yapılır. Detay açma mevcut ticket seçme davranışını kullanır.

## Context panel

Sağ panel read-only operasyon dossier'ıdır:

- Requester özeti.
- İlgili asset ve aktif zimmetler.
- Onay durumu.
- Son requester ticket geçmişi.
- Aksiyon uygunluğu ve blocked reason.
- Audit trace linki.

Pending approval ticketlarda IT aksiyonları guard altında kalır. Rejected ticketlar IT queue davranışını mevcut backend kurallarıyla korur.

## Audit trace

Ticket audit link standardı:

`/audit?entity_type=tickets.Ticket&entity_id=<ticketId>`

Bu link token, secret, password, internal note içeriği veya full path içermez.

## Troubleshooting

- Pending approval ticket queue'da yoksa ilgili approver kararını bekliyordur.
- Rejected ticket IT queue'da yoksa talep reddedilmiş ve kapatılmıştır.
- Resolved/closed için çözüm notu isteniyorsa backend kuralı devrededir.
- Requester internal note görmüyorsa beklenen güvenlik davranışı korunuyor demektir.
