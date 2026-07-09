import { AppShell } from "../components/layout/AppShell";

export function WorkspacePage() {
  return (
    <AppShell>
      <h1 className="text-display">Çalışma alanı</h1>
      <p className="mt-sm text-text-secondary">
        Ticket kanban ve dikkat gerektiren envanter listesi burada olacak.
      </p>

      <div className="mt-lg grid gap-md md:grid-cols-3">
        <div className="panel">
          <p className="text-h3">Açık</p>
          <p className="mt-sm text-caption text-text-secondary">
            Ticket modülü eklenecek.
          </p>
        </div>

        <div className="panel">
          <p className="text-h3">İşlemde</p>
          <p className="mt-sm text-caption text-text-secondary">
            Ticket modülü eklenecek.
          </p>
        </div>

        <div className="panel">
          <p className="text-h3">Bugün çözülen</p>
          <p className="mt-sm text-caption text-text-secondary">
            Ticket modülü eklenecek.
          </p>
        </div>
      </div>
    </AppShell>
  );
}