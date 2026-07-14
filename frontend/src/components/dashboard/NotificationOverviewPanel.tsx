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

function AlertColumn({
  title,
  description,
  items,
  variant,
}: {
  title: string;
  description: string;
  items: NotificationItem[];
  variant: "danger" | "warning" | "accent";
}) {
  const navigate = useNavigate();

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
          <p className="rounded-2xl bg-surface-0 p-md text-caption text-text-secondary">
            Kayıt yok.
          </p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.url)}
              className="block w-full rounded-2xl border border-border-subtle bg-surface-0 p-md text-left transition hover:border-border-strong"
            >
              <p className="text-body font-semibold text-text-primary">
                {item.message}
              </p>
              <p className="mt-xs text-caption text-text-secondary">
                {item.title} · {itemMeta(item)}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function NotificationOverviewPanel({
  overview,
  isLoading,
}: NotificationOverviewPanelProps) {
  if (isLoading) {
    return (
      <div className="panel">
        <p className="text-h3">Dikkat Gerektirenler</p>
        <p className="mt-sm text-body text-text-secondary">
          Bildirimler yükleniyor...
        </p>
      </div>
    );
  }

  const urgentTickets = overview?.urgent_tickets ?? [];
  const dueToday = overview?.reminders_due_today ?? [];
  const sevenDays = overview?.reminders_7_days ?? [];
  const thirtyDays = overview?.reminders_30_days ?? [];

  return (
    <section>
      <div className="mb-md">
        <h2 className="text-h2">Dikkat Gerektirenler</h2>
        <p className="mt-xs text-body text-text-secondary">
          ACİL ticketlar ve 30/7/bugün yaklaşan hatırlatıcılar.
        </p>
      </div>

      <div className="grid gap-md xl:grid-cols-4">
        <AlertColumn
          title="ACİL Ticketlar"
          description="Önceliği acil olan açık/işlemde ticketlar."
          items={urgentTickets}
          variant="danger"
        />

        <AlertColumn
          title="Bugün / Gecikmiş"
          description="Bugün son gün veya tarihi geçmiş hatırlatıcılar."
          items={dueToday}
          variant="danger"
        />

        <AlertColumn
          title="7 Gün"
          description="Önümüzdeki 7 gün içinde aksiyon gerektirenler."
          items={sevenDays}
          variant="warning"
        />

        <AlertColumn
          title="30 Gün"
          description="Önümüzdeki 30 gün içinde planlanması gerekenler."
          items={thirtyDays}
          variant="accent"
        />
      </div>
    </section>
  );
}