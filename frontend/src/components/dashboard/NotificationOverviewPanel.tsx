import {
  IconAlertTriangle,
  IconBell,
  IconCalendarDue,
  IconTicket,
} from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { MiniMetricCard } from "../common/MiniMetricCard";
import { StatusBadge } from "../ui/StatusBadge";
import { PopupPanel, usePopup } from "../../lib/popupManager";
import { sortNotificationItems } from "../../lib/urgency";
import type {
  NotificationItem,
  NotificationOverview,
} from "../../types/notifications";

interface NotificationOverviewPanelProps {
  overview: NotificationOverview | null | undefined;
  isLoading?: boolean;
}

const MAX_PREVIEW_ITEMS = 3;

type AlertVariant = "danger" | "warning" | "accent" | "success";

type MetricPopupGroup = {
  title: string;
  items: NotificationItem[];
  variant: AlertVariant;
  fallbackUrl: string;
  emptyText: string;
};

function metadataString(item: NotificationItem, key: string) {
  const value = item.metadata[key];

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function metadataNumber(item: NotificationItem, key: string) {
  const value = item.metadata[key];

  return typeof value === "number" ? value : null;
}

function itemMeta(item: NotificationItem) {
  if (item.type === "ticket") {
    return [
      metadataString(item, "priority_label"),
      metadataString(item, "status_label"),
      metadataString(item, "employee_name"),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (item.type === "ticket_approval") {
    return [
      metadataString(item, "priority_label"),
      metadataString(item, "employee_name"),
      metadataString(item, "approver_name"),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const days = metadataNumber(item, "days_until_due");

  if (typeof days === "number") {
    if (days < 0) {
      return `${Math.abs(days)} gün gecikmiş`;
    }

    if (days === 0) {
      return "Bugün son gün";
    }

    return `${days} gün kaldı`;
  }

  return metadataString(item, "source_type_label");
}

function getTargetUrl(items: NotificationItem[], fallbackUrl: string) {
  return items[0]?.url ?? fallbackUrl;
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
  variant: AlertVariant;
  fallbackUrl: string;
  emptyText: string;
}) {
  const navigate = useNavigate();
  const previewItems = items.slice(0, MAX_PREVIEW_ITEMS);
  const remainingCount = Math.max(items.length - MAX_PREVIEW_ITEMS, 0);

  return (
    <div className="rounded-panel border border-border bg-surface-1 p-md shadow-panel">
      <div className="flex items-start justify-between gap-md">
        <div>
          <h3 className="text-h3">{title}</h3>
          <p className="mt-xs text-caption text-text-secondary">{description}</p>
        </div>

        <StatusBadge variant={variant}>{items.length}</StatusBadge>
      </div>

      <div className="mt-md space-y-sm">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-0 p-md">
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
              className="block w-full rounded-2xl border border-border-subtle bg-surface-0 p-md text-left transition duration-150 hover:border-accent/30 hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent/25"
            >
              <div className="flex items-start justify-between gap-md">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-body font-semibold text-text-primary">
                    {item.message}
                  </p>
                  <p className="mt-xs text-caption text-text-secondary">
                    {item.title} · {itemMeta(item)}
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-border bg-surface-1 px-sm py-[2px] text-[11px] font-semibold text-text-secondary">
                  {item.urgency_score}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {items.length > 0 ? (
        <button
          type="button"
          onClick={() => navigate(getTargetUrl(items, fallbackUrl))}
          className="mt-md w-full rounded-xl border border-border bg-surface-1 px-md py-sm text-caption font-semibold text-text-secondary transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        >
          {remainingCount > 0
            ? `Tümünü gör · +${remainingCount} kayıt daha`
            : "Detaya git"}
        </button>
      ) : null}
    </div>
  );
}

function MetricPopupContent({
  groups,
  onNavigate,
}: {
  groups: MetricPopupGroup[];
  onNavigate: (url: string) => void;
}) {
  return (
    <div className="space-y-md">
      {groups.map((group) => (
        <section
          key={group.title}
          className="rounded-panel border border-border bg-surface-1 p-md shadow-panel"
        >
          <div className="flex items-start justify-between gap-md">
            <div>
              <h3 className="text-h3 text-text-primary">{group.title}</h3>
              <p className="mt-xs text-caption text-text-secondary">
                {group.items.length > 0
                  ? `${group.items.length} kayıt listeleniyor.`
                  : group.emptyText}
              </p>
            </div>

            <StatusBadge variant={group.variant}>{group.items.length}</StatusBadge>
          </div>

          <div className="mt-md space-y-sm">
            {group.items.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface-1 p-md text-body text-text-secondary">
                {group.emptyText}
              </div>
            ) : (
              group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.url || group.fallbackUrl)}
                  className="block w-full rounded-2xl border border-border-subtle bg-surface-0 p-md text-left transition duration-150 hover:border-accent/30 hover:bg-accent-bg focus:outline-none focus:ring-2 focus:ring-accent/25"
                >
                  <div className="flex items-start justify-between gap-md">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-body font-semibold text-text-primary">
                        {item.message}
                      </p>

                      <p className="mt-xs text-caption text-text-secondary">
                        {item.title} · {itemMeta(item)}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-border bg-surface-2 px-sm py-[2px] text-[11px] font-semibold text-text-secondary">
                      {item.urgency_score}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {group.items.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                onNavigate(getTargetUrl(group.items, group.fallbackUrl))
              }
              className="mt-md w-full rounded-app border border-border px-md py-sm text-caption font-semibold text-text-secondary transition hover:border-accent hover:text-accent"
            >
              İlgili ekrana git
            </button>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export function NotificationOverviewPanel({
  overview,
  isLoading,
}: NotificationOverviewPanelProps) {
  const navigate = useNavigate();
  const { openDetail, close } = usePopup();

  if (isLoading) {
    return (
      <section className="panel shadow-card">
        <p className="text-h3">Dikkat Gerektirenler</p>
        <p className="mt-sm text-body text-text-secondary">
          Bildirimler yükleniyor...
        </p>
      </section>
    );
  }

  const urgentTickets = overview?.urgent_tickets ?? [];
  const activeTickets = overview?.active_tickets ?? [];
  const pendingApprovals = overview?.pending_approvals ?? [];

  const actionItems = sortNotificationItems([
    ...pendingApprovals,
    ...urgentTickets,
    ...activeTickets,
  ]);

  const dueToday = sortNotificationItems(overview?.reminders_due_today ?? []);
  const sevenDays = sortNotificationItems(overview?.reminders_7_days ?? []);
  const thirtyDays = sortNotificationItems(overview?.reminders_30_days ?? []);

  const criticalOnlyActionItems = actionItems.filter(
    (item) => item.severity === "critical"
  );

  const criticalActionCount = criticalOnlyActionItems.length + dueToday.length;
  const planningCount = sevenDays.length + thirtyDays.length;

  const actionVariant =
    actionItems.some((item) => item.severity === "critical")
      ? "danger"
      : actionItems.length > 0
        ? "warning"
        : "success";

  function openMetricPopup({
    title,
    description,
    groups,
  }: {
    title: string;
    description: string;
    groups: MetricPopupGroup[];
  }) {
    let popupId = "";

    function handleNavigate(url: string) {
      close(popupId);
      navigate(url);
    }

    popupId = openDetail(
      <PopupPanel
        title={title}
        description={description}
        size="lg"
        onClose={() => close(popupId)}
      >
        <MetricPopupContent groups={groups} onNavigate={handleNavigate} />
      </PopupPanel>
    );
  }

  return (
    <section className="panel">
      <div className="flex flex-col gap-md lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-h2">Dikkat Gerektirenler</h2>
          <p className="mt-xs text-body text-text-secondary">
            Kritik aksiyonları, onayları, açık ticketları ve yaklaşan
            hatırlatıcıları tek standart bildirim mantığıyla özetler.
          </p>
        </div>

        <div className="flex flex-wrap gap-sm">
          <MiniMetricCard
            label="Kritik aksiyon"
            value={criticalActionCount}
            tone={criticalActionCount > 0 ? "danger" : "success"}
            icon={<IconAlertTriangle size={15} aria-hidden={true} />}
            ariaLabel="Kritik aksiyon detaylarını aç"
            onClick={() =>
              openMetricPopup({
                title: "Kritik aksiyon detayı",
                description:
                  "Kritik ticket/onay aksiyonları ve bugün/gecikmiş hatırlatıcılar.",
                groups: [
                  {
                    title: "Kritik ticket ve onaylar",
                    items: criticalOnlyActionItems,
                    variant:
                      criticalOnlyActionItems.length > 0 ? "danger" : "success",
                    fallbackUrl: "/tickets",
                    emptyText: "Kritik ticket veya onay yok.",
                  },
                  {
                    title: "Bugün / gecikmiş hatırlatıcılar",
                    items: dueToday,
                    variant: dueToday.length > 0 ? "danger" : "success",
                    fallbackUrl: "/reminders",
                    emptyText: "Bugün veya gecikmiş hatırlatıcı yok.",
                  },
                ],
              })
            }
          />

          <MiniMetricCard
            label="Planlanacak"
            value={planningCount}
            tone={planningCount > 0 ? "accent" : "success"}
            icon={<IconCalendarDue size={15} aria-hidden={true} />}
            ariaLabel="Planlanacak kayıt detaylarını aç"
            onClick={() =>
              openMetricPopup({
                title: "Planlanacak işler",
                description:
                  "Önümüzdeki 7 ve 30 gün içinde takip edilmesi gereken hatırlatıcılar.",
                groups: [
                  {
                    title: "7 gün içinde",
                    items: sevenDays,
                    variant: sevenDays.length > 0 ? "warning" : "success",
                    fallbackUrl: "/reminders",
                    emptyText: "7 gün içinde planlanacak kayıt yok.",
                  },
                  {
                    title: "30 gün içinde",
                    items: thirtyDays,
                    variant: thirtyDays.length > 0 ? "accent" : "success",
                    fallbackUrl: "/reminders",
                    emptyText: "30 gün içinde planlanacak kayıt yok.",
                  },
                ],
              })
            }
          />
        </div>
      </div>

      <div className="mt-lg grid gap-md xl:grid-cols-4">
        <AlertGroup
          title="Aksiyonlar"
          description="Onay bekleyen işler ve açık / işlemde olan ticketlar, aciliyete göre sıralı."
          items={actionItems}
          variant={actionVariant}
          fallbackUrl="/tickets"
          emptyText="Aksiyon gerektiren ticket veya onay yok"
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