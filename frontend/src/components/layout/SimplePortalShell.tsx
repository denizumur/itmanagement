import { IconLogout, IconSparkles } from "@tabler/icons-react";
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
    <div className="app-bg min-h-screen text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-1/90 px-md py-sm backdrop-blur md:px-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-md">
          <div className="flex min-w-0 items-center gap-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-bg text-accent">
              <IconSparkles size={20} aria-hidden={true} />
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-xs">
                <span className="shrink-0 rounded-full border border-accent/20 bg-accent-bg px-sm py-[3px] text-[11px] font-semibold text-accent">
                  {badge}
                </span>

                <span className="hidden truncate text-caption text-text-secondary sm:inline">
                  IT Envanter & Yönetim Platformu
                </span>
              </div>

              <h1 className="mt-xs truncate text-h2 font-semibold text-text-primary">
                {title}
              </h1>

              {subtitle ? (
                <p className="mt-xs line-clamp-1 text-body text-text-secondary">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-sm">
            <NotificationBell
              variant="unified"
              title="Bildirim Merkezi"
              emptyText="Bildirim yok."
              count={data?.counts.total ?? 0}
              criticalCount={data?.counts.critical ?? 0}
              items={data?.items ?? []}
            />

            <div className="hidden min-w-[150px] rounded-xl border border-border bg-surface-1 px-md py-sm text-right shadow-sm sm:block">
              <p className="truncate text-caption font-semibold text-text-primary">
                {displayName}
              </p>
              <p className="mt-[2px] truncate text-[11px] font-medium text-text-secondary">
                {user?.email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-1 text-text-secondary shadow-sm transition hover:border-danger/40 hover:bg-danger-bg hover:text-danger focus:outline-none focus:ring-2 focus:ring-danger/25"
              aria-label="Çıkış yap"
              title="Çıkış yap"
            >
              <IconLogout size={18} aria-hidden={true} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-md py-lg md:px-lg xl:py-xl">
        {children}
      </main>
    </div>
  );
}