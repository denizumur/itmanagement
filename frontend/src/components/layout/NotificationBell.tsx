import { IconBell } from "@tabler/icons-react";

interface NotificationBellProps {
  count: number;
}

export function NotificationBell({ count }: NotificationBellProps) {
  return (
    <button
      type="button"
      className="relative rounded-app border border-border bg-surface-1 p-sm text-text-primary"
      aria-label="Hatırlatıcı bildirimleri"
    >
      <IconBell size={18} aria-hidden="true" />

      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-danger-bg px-xs text-center text-[10px] text-danger">
          {count}
        </span>
      )}
    </button>
  );
}