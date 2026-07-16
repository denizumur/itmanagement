import { IconLogout, IconSearch } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext";
import { useNotificationCenter } from "../../hooks/useNotificationCenter";
import { GlowButton } from "../ui/GlowButton";
import { NotificationBell } from "./NotificationBell";

interface TopbarProps {
  reminderCount?: number;
}

export function Topbar({ reminderCount = 0 }: TopbarProps) {
  const { user, logout } = useAuth();
  const { data } = useNotificationCenter();

  const totalCount = data?.counts.total ?? reminderCount;
  const criticalCount = data?.counts.critical ?? 0;
  const items = data?.items ?? [];

  return (
    <header className="topbar-glass sticky top-0 z-20 flex items-center justify-between px-lg py-md">
      <div className="flex w-full max-w-xl items-center gap-sm rounded-app border border-border bg-surface-1 px-md py-sm text-text-secondary shadow-panel">
        <IconSearch size={18} aria-hidden="true" />
        <span className="text-caption">Ara veya komut çalıştır... Ctrl+K</span>
      </div>

      <div className="ml-lg flex items-center gap-md">
        <NotificationBell
          title="Bildirim Merkezi"
          emptyText="Bildirim yok."
          count={totalCount}
          criticalCount={criticalCount}
          items={items}
          variant="unified"
        />

        <div className="hidden rounded-app border border-border bg-surface-1 px-md py-sm text-right shadow-panel sm:block">
          <p className="text-caption text-text-primary">{user?.username}</p>
          <p className="text-caption text-text-secondary">
            {user?.role ?? "role yok"}
          </p>
        </div>

        <GlowButton
          variant="ghost"
          onClick={() => logout()}
          icon={<IconLogout size={16} aria-hidden="true" />}
        >
          Çıkış
        </GlowButton>
      </div>
    </header>
  );
}