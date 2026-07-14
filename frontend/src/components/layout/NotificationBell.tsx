import { IconAlertTriangle, IconBell } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { NotificationItem } from "../../types/notifications";
import { cn } from "../../lib/cn";

interface NotificationBellProps {
  count: number;
  items: NotificationItem[];
  variant: "normal" | "critical";
  title: string;
  emptyText: string;
}

function formatNotificationMeta(item: NotificationItem) {
  if (item.type === "ticket") {
    return [
      item.metadata.priority_label,
      item.metadata.status_label,
      item.metadata.employee_name,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (typeof item.metadata.days_until_due === "number") {
    if (item.metadata.days_until_due < 0) {
      return `${Math.abs(item.metadata.days_until_due)} gün gecikmiş`;
    }

    if (item.metadata.days_until_due === 0) {
      return "Bugün son gün";
    }

    return `${item.metadata.days_until_due} gün kaldı`;
  }

  return item.metadata.source_type_label ?? "";
}

export function NotificationBell({
  count,
  items,
  variant,
  title,
  emptyText,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const isCritical = variant === "critical";
  const Icon = isCritical ? IconAlertTriangle : IconBell;

  function handleItemClick(item: NotificationItem) {
    setIsOpen(false);
    navigate(item.url);
  }

  return (
    <div className="relative">
      <motion.button
        type="button"
        className={cn(
          "relative rounded-app border p-sm shadow-panel transition",
          isCritical
            ? "border-danger/40 bg-danger-bg text-danger"
            : "border-border bg-surface-1 text-text-primary"
        )}
        aria-label={title}
        onClick={() => setIsOpen((current) => !current)}
        whileHover={{
          y: -2,
          scale: 1.03,
        }}
        whileTap={{
          scale: 0.96,
        }}
      >
        <Icon size={18} aria-hidden="true" />

        {count > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 min-w-[20px] rounded-full px-xs text-center text-[10px]",
              isCritical
                ? "bg-danger text-white"
                : "bg-danger-bg text-danger"
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </motion.button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-sm w-[360px] overflow-hidden rounded-panel border border-border bg-surface-1 shadow-panel">
          <div className="border-b border-border-subtle px-md py-sm">
            <p className="text-body font-semibold text-text-primary">{title}</p>
            <p className="text-caption text-text-secondary">
              {count > 0 ? `${count} kayıt var` : emptyText}
            </p>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-md py-lg text-center text-body text-text-secondary">
                {emptyText}
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className="block w-full px-md py-sm text-left transition hover:bg-surface-2"
                  >
                    <div className="flex items-start justify-between gap-md">
                      <div>
                        <p className="text-body font-semibold text-text-primary">
                          {item.title}
                        </p>
                        <p className="mt-xs line-clamp-2 text-caption text-text-secondary">
                          {item.message}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "shrink-0 rounded-full px-xs py-[2px] text-[10px]",
                          isCritical
                            ? "bg-danger-bg text-danger"
                            : "bg-accent-bg text-accent"
                        )}
                      >
                        {item.type === "ticket" ? "Ticket" : "Reminder"}
                      </span>
                    </div>

                    <p className="mt-xs text-[11px] text-text-secondary">
                      {formatNotificationMeta(item)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}