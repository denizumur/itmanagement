import {
  IconAlertTriangle,
  IconBell,
  IconCheck,
  IconClock,
  IconRefresh,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { ErrorState } from "../components/common/ErrorState";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { Skeleton } from "../components/common/Skeleton";
import { TablePagination } from "../components/common/TablePagination";
import { AppShell } from "../components/layout/AppShell";
import { AppToast } from "../components/ui/AppToast";
import { GlowButton } from "../components/ui/GlowButton";
import { PageHeader } from "../components/ui/PageHeader";
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
  value?: string | number | null;
}) {
  const displayValue =
    value === undefined || value === null || value === "" ? "-" : value;

  return (
    <div className="rounded-app border border-border bg-surface-1 p-md">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-xs text-body text-text-primary">{displayValue}</p>
    </div>
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
  onSelectReminder,
  onSnoozeToday,
  onDismiss,
  onCancel,
}: {
  userCanManage: boolean;
  isSubmitting: boolean;
  onSelectReminder: (reminder: Reminder) => void;
  onSnoozeToday: (reminder: Reminder) => void;
  onDismiss: (reminder: Reminder) => void;
  onCancel: (reminder: Reminder) => void;
}): DataTableColumn<Reminder>[] {
  return [
    {
      key: "title",
      label: "Hatırlatıcı",
      sortable: true,
      sortKey: "title",
      render: (reminder) => (
        <div>
          <p className="text-text-primary">{reminder.title}</p>
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
      render: (reminder) => (
        <div className="text-text-secondary">
          <p>{getSourceLabel(reminder)}</p>
          <p className="text-caption">Kaynak ID: {reminder.source_id}</p>
        </div>
      ),
    },
    {
      key: "due_date",
      label: "Son tarih",
      sortable: true,
      sortKey: "due_date",
      render: (reminder) => (
        <div className="text-text-secondary">
          <p className="text-body text-text-primary">
            {formatDate(reminder.due_date)}
          </p>
          <p className="text-caption">{getDueLabel(reminder)}</p>
        </div>
      ),
    },
    {
      key: "scheduled_for",
      label: "Gösterim",
      sortable: true,
      sortKey: "scheduled_for",
      render: (reminder) => (
        <span className="text-text-secondary">
          {formatDate(reminder.scheduled_for)}
        </span>
      ),
    },
    {
      key: "channel",
      label: "Kanal",
      sortable: true,
      sortKey: "channel",
      render: (reminder) => (
        <span className="text-text-secondary">
          {reminder.channel_label ?? reminder.channel}
        </span>
      ),
    },
    {
      key: "status",
      label: "Zaman / İşlem",
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
      label: "İşlem",
      className: "text-right",
      render: (reminder) => (
        <div className="flex justify-end gap-sm">
          <GlowButton variant="ghost" onClick={() => onSelectReminder(reminder)}>
            Detay
          </GlowButton>

          {userCanManage && reminder.status === "pending" ? (
            <>
              <GlowButton
                variant="ghost"
                onClick={() => onSnoozeToday(reminder)}
                disabled={isSubmitting}
                icon={<IconClock size={16} aria-hidden={true} />}
              >
                Bugün Gizle
              </GlowButton>

              <GlowButton
                variant="ghost"
                onClick={() => onDismiss(reminder)}
                disabled={isSubmitting}
                icon={<IconCheck size={16} aria-hidden={true} />}
              >
                Kalıcı Kapat
              </GlowButton>

              <GlowButton
                variant="ghost"
                onClick={() => onCancel(reminder)}
                disabled={isSubmitting}
                icon={<IconX size={16} aria-hidden={true} />}
              >
                İptal
              </GlowButton>
            </>
          ) : null}
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
      `"${reminder.title}" hatırlatıcısı bugün gizlenecek. Yarın hâlâ geçerliyse tekrar görünecek. Devam edilsin mi?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await snoozeTodayMutation.mutateAsync(reminder.id);

      setToast({
        type: "success",
        message:
          "Hatırlatıcı bugün gizlendi. Yarın hâlâ geçerliyse tekrar görünür.",
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
        onSelectReminder: setSelectedReminder,
        onSnoozeToday: handleSnoozeToday,
        onDismiss: handleDismiss,
        onCancel: handleCancel,
      }),
    [userCanManage, isSubmitting, selectedReminder?.id]
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
        <PageHeader
          eyebrow="Operasyonel Hatırlatıcılar"
          title="Hatırlatıcılar"
          description="Garanti, bakım, lisans ve ileride ticket SLA kaynaklı görünür hatırlatıcıları takip et."
          actions={
            <>
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
            </>
          }
        />

        <section className="mt-lg flex flex-wrap gap-sm">
          <MiniMetricCard
            label="Gösterilen kayıt"
            value={tableData?.count ?? reminders.length}
            icon={<IconBell size={15} aria-hidden={true} />}
            tone="accent"
          />

          <MiniMetricCard
            label="Görünür bekleyen"
            value={summary?.visible_pending ?? 0}
            icon={<IconBell size={15} aria-hidden={true} />}
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
            icon={<IconClock size={15} aria-hidden={true} />}
            tone="warning"
          />

          <MiniMetricCard
            label="Bugün gizlenen"
            value={summary?.snoozed_today ?? 0}
            icon={<IconCheck size={15} aria-hidden={true} />}
          />
        </section>

        <section className="mt-lg rounded-panel border border-border bg-surface-1 p-md shadow-panel">
          <div className="grid gap-md xl:grid-cols-[1fr_200px_220px_220px_240px_auto]">
            <label className="flex items-center gap-sm rounded-app border border-border bg-surface-2 px-md py-sm shadow-panel">
              <IconSearch
                size={18}
                className="text-text-secondary"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                placeholder="Başlık, mesaj veya oluşturan ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
              value={selectedSourceType}
              onChange={(event) =>
                setFilter("source_type", event.target.value || null)
              }
              aria-label="Kaynak filtresi"
            >
              {sourceTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none disabled:opacity-60"
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
              className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
              value={selectedTimeStatus}
              onChange={(event) =>
                setFilter("time_status", event.target.value || null)
              }
              aria-label="Zaman durumu filtresi"
            >
              {timeStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-sm rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel">
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
              className="inline-flex items-center justify-center rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
            >
              Temizle
            </button>
          </div>
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
            <div className="space-y-md">
              <div className="flex items-center justify-between gap-md rounded-panel border border-border bg-surface-1 p-md shadow-panel">
                <div>
                  <p className="text-caption text-text-secondary">
                    Zaman / İşlem
                  </p>

                  <div className="mt-xs flex flex-wrap gap-xs">
                    <StatusBadge variant={getTimeStatusVariant(selectedReminder)}>
                      {getTimeStatusLabel(selectedReminder)}
                    </StatusBadge>

                    <StatusBadge variant={getActionStatusVariant(selectedReminder)}>
                      {getActionStatusLabel(selectedReminder)}
                    </StatusBadge>
                  </div>
                </div>

                {userCanManage && selectedReminder.status === "pending" && (
                  <div className="flex flex-wrap justify-end gap-sm">
                    <GlowButton
                      variant="ghost"
                      icon={<IconClock size={16} aria-hidden={true} />}
                      onClick={() => handleSnoozeToday(selectedReminder)}
                      disabled={isSubmitting}
                    >
                      Bugün Gizle
                    </GlowButton>

                    <GlowButton
                      variant="ghost"
                      icon={<IconCheck size={16} aria-hidden={true} />}
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

              <div className="grid gap-md sm:grid-cols-2">
                <DetailRow
                  label="Kaynak"
                  value={getSourceLabel(selectedReminder)}
                />
                <DetailRow
                  label="Kaynak ID"
                  value={selectedReminder.source_id}
                />
                <DetailRow
                  label="Son tarih"
                  value={formatDate(selectedReminder.due_date)}
                />
                <DetailRow
                  label="Kalan gün"
                  value={getDueLabel(selectedReminder)}
                />
                <DetailRow
                  label="Zaman durumu"
                  value={getTimeStatusLabel(selectedReminder)}
                />
                <DetailRow
                  label="İşlem durumu"
                  value={getActionStatusLabel(selectedReminder)}
                />
                <DetailRow
                  label="Gösterim tarihi"
                  value={formatDate(selectedReminder.scheduled_for)}
                />
                <DetailRow
                  label="Eşik"
                  value={`${selectedReminder.threshold_days} gün önce`}
                />
                <DetailRow
                  label="Kanal"
                  value={selectedReminder.channel_label ?? selectedReminder.channel}
                />
                <DetailRow
                  label="Oluşturan"
                  value={selectedReminder.created_by_username}
                />
                <DetailRow
                  label="Bildirim zamanı"
                  value={formatDate(selectedReminder.notified_at)}
                />
                <DetailRow
                  label="Bugün gizlenme tarihi"
                  value={formatDate(selectedReminder.snoozed_until)}
                />
                <DetailRow
                  label="Bugün gizlenme zamanı"
                  value={formatDate(selectedReminder.snoozed_at)}
                />
                <DetailRow
                  label="Kalıcı kapatma zamanı"
                  value={formatDate(selectedReminder.dismissed_at)}
                />
                <DetailRow
                  label="İptal zamanı"
                  value={formatDate(selectedReminder.cancelled_at)}
                />
              </div>

              <DetailRow label="Mesaj" value={selectedReminder.message} />
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