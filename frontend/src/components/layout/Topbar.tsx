import { IconLogout, IconMenu2, IconSearch } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext";
import { useNotificationCenter } from "../../hooks/useNotificationCenter";
import { NotificationBell } from "./NotificationBell";

interface TopbarProps {
  reminderCount?: number;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function Topbar({
  reminderCount = 0,
  sidebarCollapsed = false,
  onToggleSidebar,
}: TopbarProps) {
  const { user, logout } = useAuth();
  const { data } = useNotificationCenter();

  const totalCount = data?.counts.total ?? reminderCount;
  const criticalCount = data?.counts.critical ?? 0;
  const items = data?.items ?? [];

  return (
    <header className="topbar-glass sticky top-0 z-20 border-b border-border bg-surface-1/90 px-md py-sm backdrop-blur md:px-lg">
      <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-md">
        <div className="flex min-w-0 items-center gap-sm">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-1 text-text-secondary shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 md:inline-flex"
            aria-label={sidebarCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            title={sidebarCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          >
            <IconMenu2 size={19} aria-hidden={true} />
          </button>

          <div className="hidden min-w-0 items-center gap-sm rounded-xl border border-border bg-surface-1 px-md py-[9px] text-text-secondary shadow-sm lg:flex lg:w-[420px]">
            <IconSearch size={18} aria-hidden={true} />
            <span className="truncate text-caption">Ara veya komut çalıştır</span>
            <span className="ml-auto rounded-md border border-border bg-surface-2 px-xs py-[2px] text-[10px] font-semibold text-text-muted">
              Ctrl K
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-sm">
          <NotificationBell
            title="Bildirim Merkezi"
            emptyText="Bildirim yok."
            count={totalCount}
            criticalCount={criticalCount}
            items={items}
            variant="unified"
          />

          <div className="hidden min-w-[150px] rounded-xl border border-border bg-surface-1 px-md py-sm text-right shadow-sm sm:block">
            <p className="truncate text-caption font-semibold text-text-primary">
              {user?.username ?? "Kullanıcı"}
            </p>
            <p className="mt-[2px] truncate text-[11px] font-medium text-text-secondary">
              {user?.role ?? "role yok"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-1 text-text-secondary shadow-sm transition hover:border-danger/40 hover:bg-danger-bg hover:text-danger focus:outline-none focus:ring-2 focus:ring-danger/25"
            aria-label="Çıkış yap"
            title="Çıkış yap"
          >
            <IconLogout size={18} aria-hidden={true} />
          </button>
        </div>
      </div>
    </header>
  );
}