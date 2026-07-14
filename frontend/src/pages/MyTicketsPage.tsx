import { SimplePortalShell } from "../components/layout/SimplePortalShell";

export function MyTicketsPage() {
  return (
    <SimplePortalShell
      badge="Requester Portalı"
      title="Benim Ticketlarım"
      subtitle="IT taleplerini buradan oluşturabilir ve mevcut taleplerinin durumunu takip edebilirsin."
    >
      <div className="grid gap-lg lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel">
          <div className="flex items-start justify-between gap-md">
            <div>
              <h2 className="text-h3">Ticket ekranı hazırlanıyor</h2>
              <p className="mt-sm text-body text-text-secondary">
                N2 fazında bu alana gerçek “Yeni Ticket Oluştur” ve “Benim
                Ticketlarım” listesi bağlanacak.
              </p>
            </div>

            <span className="rounded-full bg-surface-2 px-sm py-xs text-caption text-text-secondary">
              N1 iskelet
            </span>
          </div>

          <div className="mt-lg grid gap-md sm:grid-cols-3">
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-md">
              <p className="text-caption text-text-secondary">Açık Talepler</p>
              <p className="mt-xs text-h2">0</p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-md">
              <p className="text-caption text-text-secondary">İşlemde</p>
              <p className="mt-xs text-h2">0</p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-md">
              <p className="text-caption text-text-secondary">Tamamlanan</p>
              <p className="mt-xs text-h2">0</p>
            </div>
          </div>

          <div className="mt-lg rounded-2xl border border-dashed border-border-subtle bg-surface-0 p-lg text-center">
            <p className="text-body font-semibold">Henüz ticket listesi bağlı değil.</p>
            <p className="mt-xs text-body text-text-secondary">
              Backend Ticketing 4A tamamlanınca sadece kendi taleplerin burada
              görünecek.
            </p>
          </div>
        </section>

        <aside className="panel">
          <h2 className="text-h3">Requester için sade deneyim</h2>
          <p className="mt-sm text-body text-text-secondary">
            Bu kullanıcı tipi envanter, lisans, bakım, dashboard veya operasyonel
            IT ekranlarını görmez. Sadece kendi taleplerini oluşturur ve takip eder.
          </p>

          <div className="mt-lg space-y-sm text-body text-text-secondary">
            <p>• Dashboard yok</p>
            <p>• Sidebar yok</p>
            <p>• Operasyonel modül yok</p>
            <p>• Sadece kişisel ticket akışı</p>
          </div>
        </aside>
      </div>
    </SimplePortalShell>
  );
}