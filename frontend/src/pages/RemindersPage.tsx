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
import { ErrorState } from "../components/common/ErrorState";
import { Skeleton } from "../components/common/Skeleton";
import { AppShell } from "../components/layout/AppShell";
import { AppToast } from "../components/ui/AppToast";
import { DataCard } from "../components/ui/DataCard";
import { DataTable } from "../components/ui/DataTable";
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
  useReminders,
} from "../hooks/useReminders";
import { canManage } from "../lib/rbac";
import type { Reminder, ReminderFilters } from "../types/reminders";

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

const statusOptions = [
  { value: "", label: "Tüm durumlar" },
  { value: "pending", label: "Bekliyor" },
  { value: "sent", label: "Gönderildi" },
  { value: "dismissed", label: "Kapatıldı" },
  { value: "cancelled", label: "İptal edildi" },
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

function getStatusVariant(
  reminder: Reminder
): "accent" | "success" | "warning" | "danger" | "neutral" {
  if (reminder.status === "dismissed" || reminder.status === "cancelled") {
    return "neutral";
  }

  if (reminder.status === "sent") {
    return "success";
  }

  if (reminder.status === "pending" && reminder.days_until_due < 0) {
    return "danger";
  }

  if (reminder.status === "pending" && reminder.days_until_due <= 7) {
    return "warning";
  }

  return "accent";
}

function getStatusLabel(reminder: Reminder) {
  if (reminder.status_label) {
    return reminder.status_label;
  }

  const labels: Record<string, string> = {
    pending: "Bekliyor",
    sent: "Gönderildi",
    dismissed: "Kapatıldı",
    cancelled: "İptal edildi",
  };

  return labels[reminder.status] ?? reminder.status;
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

export function RemindersPage() {
  const { user } = useAuth();
  const userCanManage = canManage(user?.role);

  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [visibleOnly, setVisibleOnly] = useState(true);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const filters: ReminderFilters = useMemo(() => {
    const nextFilters: ReminderFilters = {
      source_type: sourceType,
      status: statusFilter,
    };

    if (visibleOnly) {
      nextFilters.visible = "true";
    }

    return nextFilters;
  }, [sourceType, statusFilter, visibleOnly]);

  const remindersQuery = useReminders(filters);
  const summaryQuery = useReminderSummary();

  const generateMutation = useGenerateReminders();
  const dismissMutation = useDismissReminder();
  const cancelMutation = useCancelReminder();

  const reminders = remindersQuery.data ?? [];
  const summary = summaryQuery.data;

  const isSubmitting =
    generateMutation.isPending ||
    dismissMutation.isPending ||
    cancelMutation.isPending;

  const isInitialLoading = remindersQuery.isLoading || summaryQuery.isLoading;
  const hasError = remindersQuery.isError || summaryQuery.isError;

  const filteredReminders = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("tr-TR");

    if (!normalizedSearch) {
      return reminders;
    }

    return reminders.filter((reminder) => {
      const haystack = [
        reminder.title,
        reminder.message,
        reminder.source_type,
        reminder.source_type_label,
        reminder.status_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(normalizedSearch);
    });
  }, [reminders, search]);

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

  async function handleDismiss(reminder: Reminder) {
    const confirmed = window.confirm(
      `"${reminder.title}" hatırlatıcısı kapatılacak. Devam edilsin mi?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await dismissMutation.mutateAsync(reminder.id);

      setToast({
        type: "success",
        message: "Hatırlatıcı kapatıldı.",
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

  if (isInitialLoading) {
    return (
      <AppShell>
        <div className="grid gap-md md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
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

        <section className="grid gap-md md:grid-cols-2 xl:grid-cols-4">
          <DataCard className="metric-card-accent p-lg">
            <IconBell size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {summary?.visible_pending ?? 0}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Görünür bekleyen
            </p>
          </DataCard>

          <DataCard className="metric-card-danger p-lg">
            <IconAlertTriangle size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {summary?.overdue_due_date ?? 0}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Geciken son tarih
            </p>
          </DataCard>

          <DataCard className="metric-card-warning p-lg">
            <IconClock size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {summary?.upcoming_7_days ?? 0}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              7 gün içinde
            </p>
          </DataCard>

          <DataCard className="metric-card-success p-lg">
            <IconCheck size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {summary?.dismissed ?? 0}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Kapatılan
            </p>
          </DataCard>
        </section>

        <DataCard className="mt-lg p-lg">
          <div className="grid gap-md xl:grid-cols-[1fr_220px_220px_220px]">
            <label className="flex items-center gap-sm rounded-app border border-border bg-surface-1 px-md py-sm shadow-panel">
              <IconSearch
                size={18}
                className="text-text-secondary"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                placeholder="Başlık, mesaj veya kaynak ara..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
              aria-label="Kaynak filtresi"
            >
              {sourceTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none disabled:opacity-60"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Durum filtresi"
              disabled={visibleOnly}
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-sm rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary shadow-panel">
              <input
                type="checkbox"
                checked={visibleOnly}
                onChange={(event) => {
                  setVisibleOnly(event.target.checked);

                  if (event.target.checked) {
                    setStatusFilter("pending");
                  }
                }}
              />
              <span>Bugün görünür olanlar</span>
            </label>
          </div>
        </DataCard>

        <section className="mt-lg">
          <DataTable
            title="Hatırlatıcı listesi"
            description={`${filteredReminders.length} kayıt görüntüleniyor.`}
          >
            {!filteredReminders.length ? (
              <div className="rounded-app border border-border bg-surface-1 p-lg text-center text-text-secondary">
                Filtrelere uygun hatırlatıcı bulunamadı.
              </div>
            ) : (
              <table className="w-full min-w-[1240px] border-separate border-spacing-0 text-left text-body">
                <thead>
                  <tr className="text-caption text-text-secondary">
                    <th className="border-b border-border px-md py-sm font-normal">
                      Hatırlatıcı
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Kaynak
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Son tarih
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Gösterim
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Kanal
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Durum
                    </th>
                    <th className="border-b border-border px-md py-sm text-right font-normal">
                      İşlem
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReminders.map((reminder) => (
                    <tr
                      key={reminder.id}
                      className="transition hover:bg-surface-1"
                    >
                      <td className="border-b border-border px-md py-md">
                        <p className="text-text-primary">{reminder.title}</p>
                        <p className="max-w-[420px] truncate text-caption text-text-secondary">
                          {reminder.message}
                        </p>
                      </td>

                      <td className="border-b border-border px-md py-md text-text-secondary">
                        <p>{getSourceLabel(reminder)}</p>
                        <p className="text-caption text-text-secondary">
                          Kaynak ID: {reminder.source_id}
                        </p>
                      </td>

                      <td className="border-b border-border px-md py-md text-text-secondary">
                        <p className="text-body text-text-primary">
                          {formatDate(reminder.due_date)}
                        </p>
                        <p className="text-caption text-text-secondary">
                          {getDueLabel(reminder)}
                        </p>
                      </td>

                      <td className="border-b border-border px-md py-md text-text-secondary">
                        {formatDate(reminder.scheduled_for)}
                      </td>

                      <td className="border-b border-border px-md py-md text-text-secondary">
                        {reminder.channel_label ?? reminder.channel}
                      </td>

                      <td className="border-b border-border px-md py-md">
                        <StatusBadge variant={getStatusVariant(reminder)}>
                          {getStatusLabel(reminder)}
                        </StatusBadge>
                      </td>

                      <td className="border-b border-border px-md py-md">
                        <div className="flex justify-end gap-sm">
                          <GlowButton
                            variant="ghost"
                            onClick={() => setSelectedReminder(reminder)}
                          >
                            Detay
                          </GlowButton>

                          {userCanManage && reminder.status === "pending" && (
                            <>
                              <GlowButton
                                variant="ghost"
                                onClick={() => handleDismiss(reminder)}
                                disabled={isSubmitting}
                                icon={<IconCheck size={16} aria-hidden={true} />}
                              >
                                Kapat
                              </GlowButton>

                              <GlowButton
                                variant="ghost"
                                onClick={() => handleCancel(reminder)}
                                disabled={isSubmitting}
                                icon={<IconX size={16} aria-hidden={true} />}
                              >
                                İptal
                              </GlowButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataTable>
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
                  <p className="text-caption text-text-secondary">Durum</p>
                  <StatusBadge variant={getStatusVariant(selectedReminder)}>
                    {getStatusLabel(selectedReminder)}
                  </StatusBadge>
                </div>

                {userCanManage && selectedReminder.status === "pending" && (
                  <div className="flex gap-sm">
                    <GlowButton
                      variant="ghost"
                      icon={<IconCheck size={16} aria-hidden={true} />}
                      onClick={() => handleDismiss(selectedReminder)}
                      disabled={isSubmitting}
                    >
                      Kapat
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
                <DetailRow label="Kaynak" value={getSourceLabel(selectedReminder)} />
                <DetailRow label="Kaynak ID" value={selectedReminder.source_id} />
                <DetailRow
                  label="Son tarih"
                  value={formatDate(selectedReminder.due_date)}
                />
                <DetailRow label="Kalan gün" value={getDueLabel(selectedReminder)} />
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
                  label="Kapatılma zamanı"
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