import { SimplePortalShell } from "../components/layout/SimplePortalShell";

export function ApprovalsPage() {
  return (
    <SimplePortalShell
      badge="Approver Portalı"
      title="Onay Kuyruğum"
      subtitle="Ekibinden gelen IT taleplerini burada onaylayabilir veya reddedebilirsin."
    >
      <div className="grid gap-lg lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel">
          <div className="flex items-start justify-between gap-md">
            <div>
              <h2 className="text-h3">Onay kuyruğu hazırlanıyor</h2>
              <p className="mt-sm text-body text-text-secondary">
                N4 fazında bu alana gerçek onay bekleyen ticket listesi,
                onay/red aksiyonları ve gerekçe girişi bağlanacak.
              </p>
            </div>

            <span className="rounded-full bg-surface-2 px-sm py-xs text-caption text-text-secondary">
              N1 iskelet
            </span>
          </div>

          <div className="mt-lg rounded-2xl border border-dashed border-border-subtle bg-surface-0 p-lg text-center">
            <p className="text-body font-semibold">Henüz onay bekleyen talep yok.</p>
            <p className="mt-xs text-body text-text-secondary">
              Approval hiyerarşisi tamamlanınca sadece sana atanmış onaylar
              burada görünecek.
            </p>
          </div>
        </section>

        <aside className="panel">
          <h2 className="text-h3">Approver için sınırlı yetki</h2>
          <p className="mt-sm text-body text-text-secondary">
            Approver rolü IT operasyon ekranlarını kullanmaz. Sadece kendi onay
            kuyruğundaki taleplere aksiyon verir.
          </p>

          <div className="mt-lg space-y-sm text-body text-text-secondary">
            <p>• Envanter CRUD yok</p>
            <p>• Lisans/Bakım yönetimi yok</p>
            <p>• Sadece onay/red akışı</p>
            <p>• Eksik hiyerarşide sistem IT kuyruğuna düşecek</p>
          </div>
        </aside>
      </div>
    </SimplePortalShell>
  );
}