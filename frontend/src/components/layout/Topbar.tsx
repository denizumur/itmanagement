import { IconSearch } from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext";
import { NotificationBell } from "./NotificationBell";

interface TopbarProps {
  reminderCount: number;
}

export function Topbar({ reminderCount }: TopbarProps) {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface-1 px-lg py-md">
      <div className="flex w-full max-w-xl items-center gap-sm rounded-app border border-border bg-surface-2 px-md py-sm text-text-secondary">
        <IconSearch size={18} aria-hidden="true" />
        <span className="text-caption">Ara veya komut çalıştır... Ctrl+K</span>
      </div>

      <div className="ml-lg flex items-center gap-md">
        <NotificationBell count={reminderCount} />

        <div className="hidden text-right sm:block">
          <p className="text-caption text-text-primary">{user?.username}</p>
          <p className="text-caption text-text-secondary">
            {user?.role ?? "role yok"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="rounded-app border border-border px-md py-sm text-caption text-text-secondary hover:bg-surface-2"
        >
          Çıkış
        </button>
      </div>
    </header>
  );
}