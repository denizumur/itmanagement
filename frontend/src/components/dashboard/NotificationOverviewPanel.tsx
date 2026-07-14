import {
  IconAlertTriangle,
  IconBell,
  IconCalendarDue,
  IconTicket,
} from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { StatusBadge } from "../ui/StatusBadge";
import type {
  NotificationItem,
  NotificationOverview,
} from "../../types/notifications";

interface NotificationOverviewPanelProps {
  overview: NotificationOverview | null | undefined;
  isLoading?: boolean;
}

const MAX_PREVIEW_ITEMS = 3;

const ticketPriorityOrder: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function itemMeta(item: NotificationItem) {
  if (item.type === "ticket") {
    return [
      item.metadata.priority_label,
      item.metadata.status_label,
      item.metadata.employee_name,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const days = item.metadata.days_until_due;

  if (typeof days === "number") {
    if (days < 0) {
      return `${Math.abs(days)} gün gecikmiş`;
    }

    if (days === 0) {
      return "Bugün son gün";
    }

    return `${days} gün kaldı`;
  }

  return item.metadata.source_type_label ?? "";
}

function getTargetUrl(items: NotificationItem[], fallbackUrl: string) {
  return items[0]?.url ?? fallbackUrl;
}

function sortTicketsByPriority(items: NotificationItem[]) {
  return [...items].sort((a, b) => {
    const aPriority = ticketPriorityOrder[a.metadata.priority ?? "normal"] ?? 99;
    const bPriority = ticketPriorityOrder[b.metadata.priority ?? "normal"] ?? 99;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

function AlertGroup({
  title,
  description,
  items,
  variant,
  fallbackUrl,
  emptyText,
}: {
  title: string;
  description: string;
  items: NotificationItem[];
  variant: "danger" | "warning" | "accent" | "success";
  fallbackUrl: string;
  emptyText: string;
}) {
  const navigate = useNavigate();
  const previewItems = items.slice(0, MAX_PREVIEW_ITEMS);
  const remainingCount = Math.max(items.length - MAX_PREVIEW_ITEMS, 0);

  return (
    <div className="rounded-panel border border-border-subtle bg-surface-1 p-md">
      <div className="flex items-start justify-between gap-md">
        <div>
          <h3 className="text-h3">{title}</h3>
          <p className="mt-xs text-caption text-text-secondary">{description}</p>
        </div>

        <StatusBadge variant={variant}>{items.length}</StatusBadge>
      </div>

      <div className="mt-md space-y-sm">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-surface-0 p-md">
            <p className="text-body font-semibold text-text-primary">
              {emptyText}
            </p>
            <p className="mt-xs text-caption text-text-secondary">
              Bu alanda aksiyon gerektiren kayıt yok.
            </p>
          </div>
        ) : (
          previewItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.url)}
              className="block w-full rounded-2xl border border-border-subtle bg-surface-0 p-md text-left transition hover:border-border-strong hover:bg-surface-2"
            >
              <p className="line-clamp-1 text-body font-semibold text-text-primary">
                {item.message}
              </p>
              <p className="mt-xs text-caption text-text-secondary">
                {item.title} · {itemMeta(item)}
              </p>
            </button>
          ))
        )}
      </div>

      {items.length > 0 && (
        <button
          type="button"
          onClick={() => navigate(getTargetUrl(items, fallbackUrl))}
          className="mt-md w-full rounded-app border border-border-subtle px-md py-sm text-caption font-semibold text-text-secondary transition hover:border-border-strong hover:text-text-primary"
        >
          {remainingCount > 0
            ? `Tümünü gör · +${remainingCount} kayıt daha`
            : "Detaya git"}
        </button>
      )}
    </div>
  );
}

export function NotificationOverviewPanel({
  overview,
  isLoading,
}: NotificationOverviewPanelProps) {
  if (isLoading) {
    return (
      <section className="panel">
        <p className="text-h3">Dikkat Gerektirenler</p>
        <p className="mt-sm text-body text-text-secondary">
          Bildirimler yükleniyor...
        </p>
      </section>
    );
  }

  const urgentTickets = overview?.urgent_tickets ?? [];
  const activeTickets = overview?.active_tickets ?? [];
  const allOpenTickets = sortTicketsByPriority([
    ...urgentTickets,
    ...activeTickets,
  ]);

  const dueToday = overview?.reminders_due_today ?? [];
  const sevenDays = overview?.reminders_7_days ?? [];
  const thirtyDays = overview?.reminders_30_days ?? [];

  const criticalCount = urgentTickets.length + dueToday.length;
  const planningCount = sevenDays.length + thirtyDays.length;

  return (
    <section className="panel">
      <div className="flex flex-col gap-md lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-h2">Dikkat Gerektirenler</h2>
          <p className="mt-xs text-body text-text-secondary">
            Kritik aksiyonları ve yaklaşan 30/7/bugün hatırlatmalarını özetler.
            Detay listeler için ilgili modüle geç.
          </p>
        </div>

        <div className="grid gap-sm sm:grid-cols-2">
          <div className="rounded-2xl border border-danger/20 bg-danger-bg px-md py-sm">
            <div className="flex items-center gap-sm">
              <IconAlertTriangle size={18} aria-hidden="true" />
              <p className="text-caption font-semibold text-danger">
                Kritik aksiyon
              </p>
            </div>
            <p className="mt-xs text-h3 text-danger">{criticalCount}</p>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface-0 px-md py-sm">
            <div className="flex items-center gap-sm text-text-secondary">
              <IconCalendarDue size={18} aria-hidden="true" />
              <p className="text-caption font-semibold">Planlanacak</p>
            </div>
            <p className="mt-xs text-h3">{planningCount}</p>
          </div>
        </div>
      </div>

      <div className="mt-lg grid gap-md xl:grid-cols-4">
        <AlertGroup
          title="Açık Ticketlar"
          description="Açık / işlemde olan ticketlar, aciliğe göre sıralı."
          items={allOpenTickets}
          variant={urgentTickets.length > 0 ? "danger" : allOpenTickets.length > 0 ? "warning" : "success"}
          fallbackUrl="/tickets"
          emptyText="Açık ticket yok"
        />

        <AlertGroup
          title="Bugün / Gecikmiş"
          description="Bugün son gün veya tarihi geçmiş hatırlatıcılar."
          items={dueToday}
          variant={dueToday.length > 0 ? "danger" : "success"}
          fallbackUrl="/reminders"
          emptyText="Bugün kritik hatırlatıcı yok"
        />

        <AlertGroup
          title="7 Gün"
          description="Önümüzdeki 7 gün içinde aksiyon gerektirenler."
          items={sevenDays}
          variant={sevenDays.length > 0 ? "warning" : "success"}
          fallbackUrl="/reminders"
          emptyText="7 gün içinde risk yok"
        />

        <AlertGroup
          title="30 Gün"
          description="Önümüzdeki 30 gün içinde planlanması gerekenler."
          items={thirtyDays}
          variant={thirtyDays.length > 0 ? "accent" : "success"}
          fallbackUrl="/reminders"
          emptyText="30 gün içinde plan yok"
        />
      </div>

      <div className="mt-md flex flex-wrap items-center gap-sm text-caption text-text-secondary">
        <span className="inline-flex items-center gap-xs">
          <IconTicket size={14} aria-hidden="true" />
          Ticket aksiyonları /tickets ekranında yönetilir.
        </span>
        <span className="inline-flex items-center gap-xs">
          <IconBell size={14} aria-hidden="true" />
          Hatırlatıcı detayları /reminders ekranında yönetilir.
        </span>
      </div>
    </section>
  );
}