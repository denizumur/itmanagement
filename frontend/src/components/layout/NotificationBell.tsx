import {
  IconAlertTriangle,
  IconBell,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  getNotificationTone,
  getNotificationTypeLabel,
  notificationToneClass,
  sortNotificationItems,
} from "../../lib/urgency";
import type { NotificationItem } from "../../types/notifications";

type NotificationBellProps = {
  title?: string;
  emptyText?: string;
  count?: number;
  criticalCount?: number;
  items?: NotificationItem[];
  variant?: "normal" | "critical" | "unified";
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function NotificationBell({
  title = "Bildirimler",
  emptyText = "Bildirim yok.",
  count = 0,
  criticalCount = 0,
  items = [],
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  const sortedItems = useMemo(() => sortNotificationItems(items), [items]);
  const hasCritical = criticalCount > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border bg-surface-1 shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ${
          hasCritical
            ? "border-danger/40 text-danger"
            : "border-border text-text-secondary"
        }`}
        aria-label={title}
        aria-expanded={open}
      >
        {hasCritical ? (
          <IconAlertTriangle size={19} aria-hidden={true} />
        ) : (
          <IconBell size={19} aria-hidden={true} />
        )}

        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white shadow-sm">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-sm w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-panel border border-border bg-surface-1 shadow-popover">
          <div className="flex items-center justify-between gap-md border-b border-border bg-surface-1 px-md py-sm">
            <div>
              <p className="text-body font-semibold text-text-primary">
                {title}
              </p>
              <p className="text-caption text-text-secondary">
                {count} toplam · {criticalCount} kritik
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              aria-label="Bildirim panelini kapat"
              title="Kapat"
            >
              <IconX size={16} aria-hidden={true} />
            </button>
          </div>

          {sortedItems.length === 0 ? (
            <div className="p-lg text-center text-body text-text-secondary">
              {emptyText}
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto p-sm">
              {sortedItems.map((item) => {
                const tone = getNotificationTone(item.urgency_score);

                return (
                  <Link
                    key={item.id}
                    to={item.url}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl border border-transparent p-sm transition hover:border-border hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <div className="flex items-start gap-sm">
                      <span
                        className={`mt-xs rounded-full border px-sm py-[2px] text-[11px] font-medium ${notificationToneClass[tone]}`}
                      >
                        {item.urgency_score}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-md">
                          <div className="min-w-0">
                            <p className="truncate text-body font-semibold text-text-primary">
                              {item.title}
                            </p>
                            <p className="mt-xs text-caption text-text-secondary">
                              {getNotificationTypeLabel(item)} ·{" "}
                              {item.urgency_label}
                            </p>
                          </div>

                          <IconChevronRight
                            size={16}
                            className="mt-xs shrink-0 text-text-secondary"
                            aria-hidden={true}
                          />
                        </div>

                        <p className="mt-xs line-clamp-2 text-body text-text-secondary">
                          {item.message}
                        </p>

                        <p className="mt-xs text-caption text-text-secondary">
                          {formatDateTime(item.created_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}