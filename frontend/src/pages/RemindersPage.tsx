import {
  IconAlertTriangle,
  IconArchive,
  IconBell,
  IconCalendarDue,
  IconDatabase,
  IconEyeOff,
  IconFilter,
  IconInfoCircle,
  IconClock,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { ErrorState } from "../components/common/ErrorState";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { Skeleton } from "../components/common/Skeleton";
import { TablePagination } from "../components/common/TablePagination";
import { AppShell } from "../components/layout/AppShell";
import { AppToast } from "../components/ui/AppToast";
import { GlowButton } from "../components/ui/GlowButton";
import { PageTransition } from "../components/ui/PageTransition";
import { SlideOverPanel } from "../components/ui/SlideOverPanel";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  useCancelReminder,
  useDismissReminder,
  useGenerateReminders,
  useReminderSummary,
  useRemindersTable,
  useSnoozeReminderToday,
} from "../hooks/useReminders";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { canManage } from "../lib/rbac";
import type { TableQueryState } from "../types/table";
import type { Reminder } from "../types/reminders";

type ToastState = {
  type: "success" | "error";
  message: string;
};

const sourceTypeOptions = [
  { value: "", label: "Tüm kaynaklar" },
  { value: "warranty", label: "Garanti" },
  { value: "maintenance", label: "Bakım" },
  { value: "license", label: "Lisans" },
  { value: "ticket_sla", label: "Ticket SLA" },
];

const actionStatusOptions = [
  { value: "all", label: "Tüm işlem durumları" },
  { value: "pending", label: "Bekliyor" },
  { value: "sent", label: "Gönderildi" },
  { value: "dismissed", label: "Kalıcı kapatıldı" },
  { value: "cancelled", label: "İptal edildi" },
];

const timeStatusOptions = [
  { value: "", label: "Tüm zaman durumları" },
  { value: "overdue", label: "Geciken" },
  { value: "today", label: "Bugün" },
  { value: "next_7_days", label: "7 gün içinde" },
  { value: "next_30_days", label: "30 gün içinde" },
  { value: "snoozed_today", label: "Bugün gizlenen" },
  { value: "future", label: "İleride" },
];

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getMutationErrorMessage(error: unknown) {
  const fallback = "İşlem tamamlanamadı. Lütfen tekrar dene.";

  if (!error || typeof error !== "object" || !("response" in error)) {
    return fallback;
  }

  const response = (
    error as {
      response?: {
        data?: unknown;
      };
    }
  ).response;

  const data = response?.data;

  if (!data) {
    return fallback;
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object" && "detail" in data) {
    const detail = (data as { detail?: unknown }).detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  return fallback;
}

function getActionStatusVariant(
  reminder: Reminder
): "accent" | "success" | "warning" | "danger" | "neutral" {
  if (reminder.status === "dismissed" || reminder.status === "cancelled") {
    return "neutral";
  }

  if (reminder.status === "sent") {
    return "success";
  }

  return "accent";
}

function getActionStatusLabel(reminder: Reminder) {
  const labels: Record<string, string> = {
    pending: "Bekliyor",
    sent: "Gönderildi",
    dismissed: "Kalıcı kapatıldı",
    cancelled: "İptal edildi",
  };

  return labels[reminder.status] ?? reminder.status_label ?? reminder.status;
}

function getTimeStatusVariant(
  reminder: Reminder
): "accent" | "success" | "warning" | "danger" | "neutral" {
  if (reminder.status !== "pending") {
    return "neutral";
  }

  if (reminder.is_snoozed_today) {
    return "neutral";
  }

  if (reminder.days_until_due < 0) {
    return "danger";
  }

  if (reminder.days_until_due === 0) {
    return "warning";
  }

  if (reminder.days_until_due <= 7) {
    return "warning";
  }

  if (reminder.days_until_due <= 30) {
    return "accent";
  }

  return "neutral";
}

function getTimeStatusLabel(reminder: Reminder) {
  if (reminder.status !== "pending") {
    return "-";
  }

  if (reminder.is_snoozed_today) {
    return "Bugün gizlendi";
  }

  if (reminder.days_until_due < 0) {
    return "Gecikti";
  }

  if (reminder.days_until_due === 0) {
    return "Bugün";
  }

  if (reminder.days_until_due <= 7) {
    return "7 gün içinde";
  }

  if (reminder.days_until_due <= 30) {
    return "30 gün içinde";
  }

  return "İleride";
}

function getDueLabel(reminder: Reminder) {
  if (reminder.days_until_due < 0) {
    return `${Math.abs(reminder.days_until_due)} gün gecikti`;
  }

  if (reminder.days_until_due === 0) {
    return "Bugün";
  }

  return `${reminder.days_until_due} gün kaldı`;
}

function getSourceLabel(reminder: Reminder) {
  if (reminder.source_type_label) {
    return reminder.source_type_label;
  }

  const labels: Record<string, string> = {
    warranty: "Garanti",
    maintenance: "Bakım",
    license: "Lisans",
    ticket_sla: "Ticket SLA",
  };

  return labels[reminder.source_type] ?? reminder.source_type;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  const displayValue =
    value === undefined || value === null || value === "" ? "-" : value;

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-0/85 p-md shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {label}
      </p>
      <div className="mt-xs text-body font-medium text-text-primary">
        {displayValue}
      </div>
    </div>
  );
}

function DetailSection({
  title,
  icon,
  tone = "accent",
  children,
}: {
  title: string;
  icon: ReactNode;
  tone?: "accent" | "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}) {
  const toneClasses = {
    accent: "border-accent/20 bg-accent-bg text-accent",
    success: "border-success/20 bg-success-bg text-success",
    warning: "border-warning/25 bg-warning-bg text-warning",
    danger: "border-danger/25 bg-danger-bg text-danger",
    neutral: "border-border-subtle bg-surface-2 text-text-secondary",
  };

  return (
    <section className="rounded-panel border border-border-subtle bg-surface-1/80 p-md shadow-panel">
      <div className="mb-md flex items-center gap-sm">
        <span
          className={`inline-flex size-9 items-center justify-center rounded-2xl border shadow-sm ${toneClasses[tone]}`}
        >
          {icon}
        </span>
        <h3 className="text-body font-semibold text-text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-xs rounded-full border border-accent/25 bg-accent-bg px-sm py-xs text-caption font-semibold text-accent shadow-sm">
      <span>
        {label}: {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 transition hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none"
        aria-label={`${label} filtresini kaldır`}
        title={`${label} filtresini kaldır`}
      >
        <IconX size={13} aria-hidden={true} />
      </button>
    </span>
  );
}

function SourceMark({ reminder }: { reminder: Reminder }) {
  const sourceLabel = getSourceLabel(reminder);

  return (
    <div className="flex min-w-[150px] items-center gap-sm">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent-bg text-xs font-bold uppercase text-accent shadow-sm">
        {sourceLabel.slice(0, 2)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-text-primary">{sourceLabel}</p>
        <p className="text-caption text-text-secondary">
          Kaynak ID: {reminder.source_id}
        </p>
      </div>
    </div>
  );
}

function IconActionButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-9 items-center justify-center rounded-2xl border border-border-subtle bg-surface-0/90 text-text-secondary shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function buildEffectiveReminderTableState({
  state,
  selectedVisible,
  selectedActionStatus,
}: {
  state: TableQueryState;
  selectedVisible: string;
  selectedActionStatus: string;
}): TableQueryState {
  const filters: TableQueryState["filters"] = {
    ...state.filters,
  };

  delete filters.visible;
  delete filters.status;

  if (selectedVisible === "true") {
    filters.visible = "true";
    filters.status = "pending";
  } else if (selectedActionStatus && selectedActionStatus !== "all") {
    filters.status = selectedActionStatus;
  }

  return {
    ...state,
    filters,
  };
}

function buildReminderColumns({
  userCanManage,
  isSubmitting,
  onSnoozeToday,
  onDismiss,
  onCancel,
}: {
  userCanManage: boolean;
  isSubmitting: boolean;
  onSnoozeToday: (reminder: Reminder) => void;
  onDismiss: (reminder: Reminder) => void;
  onCancel: (reminder: Reminder) => void;
}): DataTableColumn<Reminder>[] {
  return [
    {
      key: "title",
      label: "Hatırlatma",
      sortable: true,
      sortKey: "title",
      render: (reminder) => (
        <div className="min-w-[280px]">
          <div className="flex flex-wrap items-center gap-xs">
            <p className="font-semibold text-text-primary">{reminder.title}</p>
            <span className="rounded-full border border-accent/20 bg-accent-bg px-sm py-[2px] text-[11px] font-semibold text-accent">
              {getSourceLabel(reminder)}
            </span>
          </div>
          <p className="max-w-[420px] truncate text-caption text-text-secondary">
            {reminder.message}
          </p>
        </div>
      ),
    },
    {
      key: "source_type",
      label: "Kaynak",
      sortable: true,
      sortKey: "source_type",
      render: (reminder) => <SourceMark reminder={reminder} />,
    },
    {
      key: "due_date",
      label: "Risk / Tarih",
      sortable: true,
      sortKey: "due_date",
      render: (reminder) => (
        <div className="min-w-[150px]">
          <p className="text-body font-semibold text-text-primary">
            {formatDate(reminder.due_date)}
          </p>
          <div className="mt-xs flex flex-wrap gap-xs">
            <StatusBadge variant={getTimeStatusVariant(reminder)}>
              {getTimeStatusLabel(reminder)}
            </StatusBadge>
            <span className="rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-caption text-text-secondary">
              {getDueLabel(reminder)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "scheduled_for",
      label: "Gösterim",
      sortable: true,
      sortKey: "scheduled_for",
      render: (reminder) => (
        <div className="min-w-[135px] rounded-2xl border border-border-subtle bg-surface-0/80 px-sm py-xs shadow-sm">
          <p className="font-medium text-text-primary">
            {formatDate(reminder.scheduled_for)}
          </p>
          <p className="text-caption text-text-secondary">
            Eşik: {reminder.threshold_days} gün
          </p>
        </div>
      ),
    },
    {
      key: "channel",
      label: "Kanal",
      sortable: true,
      sortKey: "channel",
      render: (reminder) => (
        <span className="inline-flex rounded-full border border-border-subtle bg-surface-0 px-sm py-xs text-caption font-semibold text-text-secondary shadow-sm">
          {reminder.channel_label ?? reminder.channel}
        </span>
      ),
    },
    {
      key: "status",
      label: "Durum",
      sortable: true,
      sortKey: "status",
      render: (reminder) => (
        <div className="flex flex-col items-start gap-xs">
          <StatusBadge variant={getTimeStatusVariant(reminder)}>
            {getTimeStatusLabel(reminder)}
          </StatusBadge>
          <StatusBadge variant={getActionStatusVariant(reminder)}>
            {getActionStatusLabel(reminder)}
          </StatusBadge>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Aksiyon",
      className: "text-right",
      render: (reminder) => (
        <div className="flex justify-end gap-xs">
          {userCanManage && reminder.status === "pending" ? (
            <>
              <IconActionButton
                label="Bugün gizle"
                onClick={() => onSnoozeToday(reminder)}
                disabled={isSubmitting}
              >
                <IconEyeOff size={16} aria-hidden={true} />
              </IconActionButton>
              <IconActionButton
                label="Kalıcı kapat"
                onClick={() => onDismiss(reminder)}
                disabled={isSubmitting}
              >
                <IconArchive size={16} aria-hidden={true} />
              </IconActionButton>
              <IconActionButton
                label="İptal"
                onClick={() => onCancel(reminder)}
                disabled={isSubmitting}
              >
                <IconX size={16} aria-hidden={true} />
              </IconActionButton>
            </>
          ) : (
            <span className="text-caption text-text-muted">Aksiyon yok</span>
          )}
        </div>
      ),
    },
  ];
}
export function RemindersPage() {
  const { user } = useAuth();
  const userCanManage = canManage(user?.role);

  const {
    state,
    setSearch,
    setSort,
    setPage,
    setPageSize,
    setFilter,
    resetFilters,
  } = useTableQueryState({
    page: 1,
    pageSize: 25,
    ordering: "scheduled_for",
  });

  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const selectedSourceType =
    typeof state.filters.source_type === "string" ? state.filters.source_type : "";
  const selectedActionStatus =
    typeof state.filters.status === "string" ? state.filters.status : "pending";
  const selectedTimeStatus =
    typeof state.filters.time_status === "string" ? state.filters.time_status : "";
  const selectedVisible =
    typeof state.filters.visible === "string" ? state.filters.visible : "true";

  const visibleOnly = selectedVisible === "true";
  const selectedSourceLabel =
    sourceTypeOptions.find((option) => option.value === selectedSourceType)
      ?.label ?? "";
  const selectedActionStatusLabel =
    actionStatusOptions.find((option) => option.value === selectedActionStatus)
      ?.label ?? "";
  const selectedTimeStatusLabel =
    timeStatusOptions.find((option) => option.value === selectedTimeStatus)
      ?.label ?? "";
  const hasActiveFilters = Boolean(
    state.search ||
      selectedSourceType ||
      selectedTimeStatus ||
      selectedActionStatus !== "pending" ||
      !visibleOnly
  );

  const effectiveTableState = useMemo(
    () =>
      buildEffectiveReminderTableState({
        state,
        selectedVisible,
        selectedActionStatus,
      }),
    [state, selectedVisible, selectedActionStatus]
  );

  const remindersQuery = useRemindersTable(effectiveTableState);
  const summaryQuery = useReminderSummary();

  const generateMutation = useGenerateReminders();
  const snoozeTodayMutation = useSnoozeReminderToday();
  const dismissMutation = useDismissReminder();
  const cancelMutation = useCancelReminder();

  const tableData = remindersQuery.data;
  const reminders = tableData?.results ?? [];
  const summary = summaryQuery.data;

  const isSubmitting =
    generateMutation.isPending ||
    snoozeTodayMutation.isPending ||
    dismissMutation.isPending ||
    cancelMutation.isPending;

  const isInitialLoading = remindersQuery.isLoading || summaryQuery.isLoading;
  const hasError = remindersQuery.isError || summaryQuery.isError;

  function refetchAll() {
    remindersQuery.refetch();
    summaryQuery.refetch();
  }

  async function handleGenerate() {
    try {
      await generateMutation.mutateAsync({ channel: "in_app" });

      setToast({
        type: "success",
        message: "Hatırlatıcılar başarıyla üretildi/güncellendi.",
      });

      refetchAll();
    } catch (error) {
      setToast({
        type: "error",
        message: getMutationErrorMessage(error),
      });
    }
  }

  async function handleSnoozeToday(reminder: Reminder) {
    const confirmed = window.confirm(
      `"${reminder.title}" hatırlatıcısı bugün gizlenecek. Yarın hala geçerliyse tekrar görünecek. Devam edilsin mi?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await snoozeTodayMutation.mutateAsync(reminder.id);

      setToast({
        type: "success",
        message:
          "Hatırlatıcı bugün gizlendi. Yarın hala geçerliyse tekrar görünür.",
      });

      if (selectedReminder?.id === reminder.id) {
        setSelectedReminder(null);
      }

      refetchAll();
    } catch (error) {
      setToast({
        type: "error",
        message: getMutationErrorMessage(error),
      });
    }
  }

  async function handleDismiss(reminder: Reminder) {
    const confirmed = window.confirm(
      `"${reminder.title}" hatırlatıcısı kalıcı olarak kapatılacak. Yarın tekrar görünmez. Devam edilsin mi?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await dismissMutation.mutateAsync(reminder.id);

      setToast({
        type: "success",
        message: "Hatırlatıcı kalıcı olarak kapatıldı.",
      });

      if (selectedReminder?.id === reminder.id) {
        setSelectedReminder(null);
      }

      refetchAll();
    } catch (error) {
      setToast({
        type: "error",
        message: getMutationErrorMessage(error),
      });
    }
  }

  async function handleCancel(reminder: Reminder) {
    const confirmed = window.confirm(
      `"${reminder.title}" hatırlatıcısı iptal edilecek. Devam edilsin mi?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await cancelMutation.mutateAsync(reminder.id);

      setToast({
        type: "success",
        message: "Hatırlatıcı iptal edildi.",
      });

      if (selectedReminder?.id === reminder.id) {
        setSelectedReminder(null);
      }

      refetchAll();
    } catch (error) {
      setToast({
        type: "error",
        message: getMutationErrorMessage(error),
      });
    }
  }

  function handleVisibleOnlyChange(checked: boolean) {
    setFilter("visible", checked ? "true" : "all");

    if (checked) {
      setFilter("status", "pending");
    }
  }

  const reminderColumns = useMemo(
    () =>
      buildReminderColumns({
        userCanManage,
        isSubmitting,
        onSnoozeToday: handleSnoozeToday,
        onDismiss: handleDismiss,
        onCancel: handleCancel,
      }),
    [userCanManage, isSubmitting]
  );

  if (isInitialLoading) {
    return (
      <AppShell>
        <div className="flex flex-wrap gap-sm">
          <Skeleton className="h-14 w-36 rounded-full" />
          <Skeleton className="h-14 w-36 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-36 rounded-full" />
        </div>

        <div className="mt-lg">
          <Skeleton className="h-[420px]" />
        </div>
      </AppShell>
    );
  }

  if (hasError) {
    return (
      <AppShell>
        <ErrorState message="Hatırlatıcı verisi alınamadı. API endpointlerini ve yetki durumunu kontrol et." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <section className="relative overflow-hidden rounded-panel border border-border-strong/60 bg-surface-1/85 shadow-panel backdrop-blur-sm">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(79,70,229,0.18),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(20,184,166,0.16),transparent_24%)]" />
          <div className="relative flex flex-col gap-lg p-lg">
            <div className="flex flex-col gap-md xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-xs rounded-full border border-accent/25 bg-accent-bg px-sm py-xs text-caption font-semibold text-accent shadow-sm">
                  <IconSparkles size={14} aria-hidden={true} />
                  Reminder Risk Operations Console
                </div>
                <h1 className="mt-sm text-h1 text-text-primary">
                  Hatırlatma Operasyon Merkezi
                </h1>
                <p className="mt-xs max-w-2xl text-body text-text-secondary">
                  Geciken, yaklaşan ve gizlenen operasyon sinyallerini tek ekrandan takip et.
                </p>
              </div>

              <div className="flex flex-wrap gap-sm">
                <GlowButton
                  variant="ghost"
                  onClick={refetchAll}
                  disabled={remindersQuery.isFetching || isSubmitting}
                  icon={<IconRefresh size={16} aria-hidden={true} />}
                >
                  {remindersQuery.isFetching ? "Yenileniyor" : "Veriyi yenile"}
                </GlowButton>

                {userCanManage && (
                  <GlowButton
                    onClick={handleGenerate}
                    disabled={isSubmitting}
                    icon={<IconBell size={16} aria-hidden={true} />}
                  >
                    Hatırlatıcı üret
                  </GlowButton>
                )}
              </div>
            </div>

            <div className="grid gap-sm sm:grid-cols-2 xl:grid-cols-6">
              <MiniMetricCard
                label="Toplam reminder"
                value={summary?.total ?? tableData?.count ?? reminders.length}
                icon={<IconBell size={15} aria-hidden={true} />}
                tone="accent"
              />
              <MiniMetricCard
                label="Görünür bekleyen"
                value={summary?.visible_pending ?? 0}
                icon={<IconInfoCircle size={15} aria-hidden={true} />}
                tone="accent"
              />
              <MiniMetricCard
                label="Geciken"
                value={summary?.overdue_due_date ?? 0}
                icon={<IconAlertTriangle size={15} aria-hidden={true} />}
                tone="danger"
              />
              <MiniMetricCard
                label="Bugün"
                value={summary?.due_today ?? 0}
                icon={<IconClock size={15} aria-hidden={true} />}
                tone="warning"
              />
              <MiniMetricCard
                label="7 gün"
                value={summary?.upcoming_7_days ?? 0}
                icon={<IconCalendarDue size={15} aria-hidden={true} />}
                tone="warning"
              />
              <MiniMetricCard
                label="Bugün gizlenen"
                value={summary?.snoozed_today ?? 0}
                icon={<IconEyeOff size={15} aria-hidden={true} />}
              />
            </div>
          </div>
        </section>

        <section className="mt-lg rounded-panel border border-border-subtle bg-surface-1/80 p-md shadow-panel backdrop-blur-sm">
          <div className="mb-sm flex items-center gap-xs text-caption font-semibold uppercase tracking-[0.08em] text-text-muted">
            <IconFilter size={14} aria-hidden={true} />
            Risk command bar
          </div>

          <div className="grid gap-sm xl:grid-cols-[minmax(260px,1fr)_180px_190px_180px_220px_auto]">
            <label className="flex items-center gap-sm rounded-2xl border border-border-subtle bg-surface-0/90 px-md py-sm shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none">
              <IconSearch size={18} className="text-text-secondary" aria-hidden={true} />
              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                placeholder="Başlık, mesaj veya oluşturan ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="rounded-2xl border border-border-subtle bg-surface-0/90 px-md py-sm text-body text-text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
              value={selectedSourceType}
              onChange={(event) => setFilter("source_type", event.target.value || null)}
              aria-label="Kaynak filtresi"
            >
              {sourceTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="rounded-2xl border border-border-subtle bg-surface-0/90 px-md py-sm text-body text-text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60 motion-reduce:transition-none"
              value={selectedActionStatus}
              onChange={(event) => setFilter("status", event.target.value)}
              aria-label="İşlem durumu filtresi"
              disabled={visibleOnly}
            >
              {actionStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="rounded-2xl border border-border-subtle bg-surface-0/90 px-md py-sm text-body text-text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
              value={selectedTimeStatus}
              onChange={(event) => setFilter("time_status", event.target.value || null)}
              aria-label="Zaman durumu filtresi"
            >
              {timeStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-sm rounded-2xl border border-border-subtle bg-surface-0/90 px-md py-sm text-body text-text-primary shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none">
              <input
                type="checkbox"
                checked={visibleOnly}
                onChange={(event) => handleVisibleOnlyChange(event.target.checked)}
              />
              <span>Bugün görünür bekleyenler</span>
            </label>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center rounded-2xl border border-border-subtle bg-surface-0/80 px-md py-sm text-body font-semibold text-text-secondary shadow-sm transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none"
            >
              Temizle
            </button>
          </div>

          {hasActiveFilters ? (
            <div className="mt-md flex flex-wrap gap-xs">
              {state.search ? (
                <FilterChip label="Arama" value={state.search} onRemove={() => setSearch("")} />
              ) : null}
              {selectedSourceType ? (
                <FilterChip label="Kaynak" value={selectedSourceLabel} onRemove={() => setFilter("source_type", null)} />
              ) : null}
              {selectedTimeStatus ? (
                <FilterChip label="Zaman" value={selectedTimeStatusLabel} onRemove={() => setFilter("time_status", null)} />
              ) : null}
              {selectedActionStatus !== "pending" ? (
                <FilterChip label="İşlem" value={selectedActionStatusLabel} onRemove={() => setFilter("status", "pending")} />
              ) : null}
              {!visibleOnly ? (
                <FilterChip label="Görünür" value="Tüm kayıtlar" onRemove={() => handleVisibleOnlyChange(true)} />
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="mt-lg flex flex-col gap-md">
          <DataTable
            columns={reminderColumns}
            data={reminders}
            getRowKey={(reminder) => reminder.id}
            ordering={state.ordering}
            onSortChange={setSort}
            isLoading={remindersQuery.isLoading}
            emptyMessage="Filtrelere uygun hatırlatıcı bulunamadı."
            onViewDetails={setSelectedReminder}
            viewDetailsLabel="Hatırlatma detayını gör"
          />

          <TablePagination
            page={state.page}
            pageSize={state.pageSize}
            totalCount={tableData?.count ?? 0}
            hasNext={Boolean(tableData?.next)}
            hasPrevious={Boolean(tableData?.previous)}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </section>

        <SlideOverPanel
          open={Boolean(selectedReminder)}
          title={selectedReminder?.title ?? "Hatırlatıcı detayı"}
          description={selectedReminder?.message ?? undefined}
          onClose={() => setSelectedReminder(null)}
        >
          {selectedReminder && (
            <div className="flex flex-col gap-lg">
              <section className="overflow-hidden rounded-panel border border-warning/20 bg-surface-0 shadow-panel">
                <div className="h-1 bg-warning" />
                <div className="flex flex-col gap-md p-md lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-xs">
                      <StatusBadge variant={getTimeStatusVariant(selectedReminder)}>
                        {getTimeStatusLabel(selectedReminder)}
                      </StatusBadge>
                      <StatusBadge variant={getActionStatusVariant(selectedReminder)}>
                        {getActionStatusLabel(selectedReminder)}
                      </StatusBadge>
                      {selectedReminder.is_snoozed_today ? (
                        <StatusBadge variant="neutral">Bugün gizlenen</StatusBadge>
                      ) : null}
                    </div>
                    <h3 className="mt-sm text-lg font-semibold text-text-primary">
                      {selectedReminder.title}
                    </h3>
                    <p className="mt-xs text-body leading-7 text-text-secondary">
                      {selectedReminder.message}
                    </p>
                    <div className="mt-sm flex flex-wrap gap-xs">
                      <span className="rounded-full border border-accent/20 bg-accent-bg px-sm py-[2px] text-caption font-semibold text-accent">
                        {getSourceLabel(selectedReminder)}
                      </span>
                      <span className="rounded-full border border-warning/25 bg-warning-bg px-sm py-[2px] text-caption font-semibold text-warning">
                        {formatDate(selectedReminder.due_date)} · {getDueLabel(selectedReminder)}
                      </span>
                    </div>
                  </div>

                  {userCanManage && selectedReminder.status === "pending" && (
                    <div className="flex flex-wrap justify-end gap-sm">
                      <GlowButton
                        variant="ghost"
                        icon={<IconEyeOff size={16} aria-hidden={true} />}
                        onClick={() => handleSnoozeToday(selectedReminder)}
                        disabled={isSubmitting}
                      >
                        Bugün Gizle
                      </GlowButton>
                      <GlowButton
                        variant="ghost"
                        icon={<IconArchive size={16} aria-hidden={true} />}
                        onClick={() => handleDismiss(selectedReminder)}
                        disabled={isSubmitting}
                      >
                        Kalıcı Kapat
                      </GlowButton>
                      <GlowButton
                        variant="ghost"
                        icon={<IconX size={16} aria-hidden={true} />}
                        onClick={() => handleCancel(selectedReminder)}
                        disabled={isSubmitting}
                      >
                        İptal
                      </GlowButton>
                    </div>
                  )}
                </div>
              </section>

              <DetailSection title="Hatırlatma Bilgisi" icon={<IconBell size={17} aria-hidden={true} />} tone="accent">
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Başlık" value={selectedReminder.title} />
                  <DetailRow label="Kanal" value={selectedReminder.channel_label ?? selectedReminder.channel} />
                  <DetailRow label="Oluşturan" value={selectedReminder.created_by_username} />
                  <DetailRow label="Reminder ID" value={selectedReminder.id} />
                </div>
              </DetailSection>

              <DetailSection title="Risk / Zamanlama" icon={<IconCalendarDue size={17} aria-hidden={true} />} tone={getTimeStatusVariant(selectedReminder)}>
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Son tarih" value={formatDate(selectedReminder.due_date)} />
                  <DetailRow label="Kalan gün" value={getDueLabel(selectedReminder)} />
                  <DetailRow label="Zaman durumu" value={getTimeStatusLabel(selectedReminder)} />
                  <DetailRow label="Gösterim tarihi" value={formatDate(selectedReminder.scheduled_for)} />
                  <DetailRow label="Eşik" value={`${selectedReminder.threshold_days} gün önce`} />
                  <DetailRow label="Bugün görünür mü" value={selectedReminder.is_visible_today ? "Evet" : "Hayır"} />
                </div>
              </DetailSection>

              <DetailSection title="Kaynak" icon={<IconDatabase size={17} aria-hidden={true} />} tone="success">
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Kaynak türü" value={getSourceLabel(selectedReminder)} />
                  <DetailRow label="Kaynak ID" value={selectedReminder.source_id} />
                </div>
              </DetailSection>

              <DetailSection title="Aksiyon Durumu" icon={<IconArchive size={17} aria-hidden={true} />} tone={getActionStatusVariant(selectedReminder)}>
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="İşlem durumu" value={getActionStatusLabel(selectedReminder)} />
                  <DetailRow label="Bildirim zamanı" value={formatDate(selectedReminder.notified_at)} />
                  <DetailRow label="Bugün gizlenme tarihi" value={formatDate(selectedReminder.snoozed_until)} />
                  <DetailRow label="Bugün gizlenme zamanı" value={formatDate(selectedReminder.snoozed_at)} />
                  <DetailRow label="Kalıcı kapatma zamanı" value={formatDate(selectedReminder.dismissed_at)} />
                  <DetailRow label="İptal zamanı" value={formatDate(selectedReminder.cancelled_at)} />
                </div>
              </DetailSection>

              <DetailSection title="Notlar" icon={<IconInfoCircle size={17} aria-hidden={true} />} tone="neutral">
                <div className="rounded-2xl border border-border-subtle bg-surface-0/90 p-md text-body leading-7 text-text-secondary shadow-sm">
                  {selectedReminder.message || "-"}
                </div>
              </DetailSection>

              <DetailSection title="Sistem bilgisi" icon={<IconClock size={17} aria-hidden={true} />} tone="success">
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Oluşturulma" value={formatDate(selectedReminder.created_at)} />
                  <DetailRow label="Güncellenme" value={formatDate(selectedReminder.updated_at)} />
                </div>
              </DetailSection>
            </div>
          )}
        </SlideOverPanel>
        {toast && (
          <AppToast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
      </PageTransition>
    </AppShell>
  );
}
