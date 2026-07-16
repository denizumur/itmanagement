import type { ReactNode } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useNotificationCenter } from "../../hooks/useNotificationCenter";
import { NotificationBell } from "./NotificationBell";

interface SimplePortalShellProps {
  title: string;
  subtitle: string;
  badge: string;
  children: ReactNode;
}

export function SimplePortalShell({
  title,
  subtitle,
  badge,
  children,
}: SimplePortalShellProps) {
  const { user, logout } = useAuth();
  const { data } = useNotificationCenter();

  async function handleLogout() {
    await logout();
  }

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "Kullanıcı";

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <header className="border-b border-border-subtle bg-surface-1/80 px-lg py-md backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-md">
          <div>
            <div className="flex items-center gap-sm">
              <span className="rounded-full border border-border-subtle bg-surface-2 px-sm py-xs text-caption text-text-secondary">
                {badge}
              </span>
              <span className="text-caption text-text-secondary">
                IT Envanter & Yönetim Platformu
              </span>
            </div>

            <h1 className="mt-xs text-h2">{title}</h1>
            <p className="mt-xs text-body text-text-secondary">{subtitle}</p>
          </div>

          <div className="flex items-center gap-md">
            <NotificationBell
              variant="normal"
              title="Bildirimler"
              emptyText="Normal bildirim yok."
              count={data?.counts.normal ?? 0}
              items={data?.normal ?? []}
            />

            <NotificationBell
              variant="critical"
              title="Kritik Uyarılar"
              emptyText="Kritik uyarı yok."
              count={data?.counts.critical ?? 0}
              items={data?.critical ?? []}
            />

            <div className="hidden text-right sm:block">
              <p className="text-body font-semibold">{displayName}</p>
              <p className="text-caption text-text-secondary">{user?.email}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-border-subtle px-md py-sm text-body font-semibold text-text-secondary transition hover:border-border-strong hover:text-text-primary"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-lg py-xl">{children}</main>
    </div>
  );
}