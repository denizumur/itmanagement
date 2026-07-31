import {
  IconActivityHeartbeat,
  IconAlertTriangle,
  IconCalendarDue,
  IconClipboardList,
  IconDeviceDesktop,
  IconHistory,
  IconNotes,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconTool,
  IconTrash,
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
import { MaintenanceForm } from "../components/maintenance/MaintenanceForm";
import { AppToast } from "../components/ui/AppToast";
import { GlowButton } from "../components/ui/GlowButton";
import { PageHeader } from "../components/ui/PageHeader";
import { PageTransition } from "../components/ui/PageTransition";
import { SlideOverPanel } from "../components/ui/SlideOverPanel";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAssets } from "../hooks/useInventory";
import {
  useCreateMaintenanceRecord,
  useMaintenanceSummary,
  useMaintenanceTable,
} from "../hooks/useMaintenance";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { cn } from "../lib/cn";
import {
  formatMaintenanceCost,
  formatMaintenanceDate,
  getMaintenanceAssetCode,
  getMaintenanceAssetName,
  getMaintenanceRecordDate,
  getMaintenanceRecordType,
  getMaintenanceStatusLabel,
  getMaintenanceStatusVariant,
  getMaintenanceSummaryCount,
  getMaintenanceTypeLabel,
  getMaintenanceTypeVariant,
  isMaintenanceOverdue,
} from "../lib/maintenance";
import { canManage } from "../lib/rbac";
import type {
  MaintenanceCreatePayload,
  MaintenanceRecord,
  MaintenanceSummary,
} from "../types/maintenance";

type ToastState = {
  type: "success" | "error";
  message: string;
};

const typeFilterOptions = [
  { value: "", label: "Tüm kayıtlar" },
  { value: "maintenance", label: "Bakım" },
  { value: "repair", label: "Onarım" },
  { value: "disposal", label: "İmha" },
];

const overdueFilterOptions = [
  { value: "", label: "Tüm durumlar" },
  { value: "true", label: "Gecikmiş" },
  { value: "false", label: "Gecikmemiş" },
];

function getRecordTitle(record: MaintenanceRecord) {
  if (record.title) {
    return record.title;
  }

  return `${getMaintenanceTypeLabel(record)} kaydı`;
}

function getRecordDescription(record: MaintenanceRecord) {
  return record.description || record.notes || "-";
}

function getMutationErrorMessage(error: unknown) {
  const fallback =
    "İşlem tamamlanamadı. Lütfen alanları kontrol edip tekrar dene.";

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

  if (typeof data === "object") {
    const firstEntry = Object.entries(data as Record<string, unknown>)[0];

    if (firstEntry) {
      const [field, value] = firstEntry;

      if (Array.isArray(value)) {
        return `${field}: ${value.join(", ")}`;
      }

      if (typeof value === "string") {
        return `${field}: ${value}`;
      }
    }
  }

  return fallback;
}

function getSummaryTypeCount(
  summary: MaintenanceSummary | undefined,
  type: string,
  fallback: number
) {
  const byType = summary?.by_type;

  if (Array.isArray(byType)) {
    const item = byType.find((entry) => entry.type === type);

    if (item) {
      return item.count;
    }
  }

  return getMaintenanceSummaryCount(summary, `${type}_count`) || fallback;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-0/90 p-md shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-panel focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <p className="text-caption text-text-secondary">{label}</p>
      <div className="mt-xs text-body font-medium text-text-primary">
        {value || "-"}
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
  tone?: "accent" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const toneClasses = {
    accent: "border-accent/20 bg-accent-bg text-accent",
    success: "border-success/20 bg-success-bg text-success",
    warning: "border-warning/25 bg-warning-bg text-warning",
    danger: "border-danger/25 bg-danger-bg text-danger",
  };

  return (
    <section className="rounded-panel border border-border-subtle bg-surface-1/80 p-md shadow-panel">
      <div className="mb-md flex items-center gap-sm">
        <span
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-2xl border shadow-sm",
            toneClasses[tone]
          )}
        >
          {icon}
        </span>
        <h3 className="text-body font-semibold text-text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function EntityAvatar({
  label,
  icon,
  tone = "accent",
}: {
  label: string;
  icon: ReactNode;
  tone?: "accent" | "warning" | "danger";
}) {
  const initial = label.slice(0, 1).toLocaleUpperCase("tr-TR") || "?";
  const toneClasses = {
    accent: "border-accent/25 bg-accent-bg text-accent",
    warning: "border-warning/25 bg-warning-bg text-warning",
    danger: "border-danger/25 bg-danger-bg text-danger",
  };

  return (
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border text-body font-semibold shadow-sm",
        toneClasses[tone]
      )}
    >
      <span aria-hidden={true}>{initial}</span>
      <span className="absolute -right-1 -top-1 rounded-full border border-surface-1 bg-surface-1 text-text-secondary">
        {icon}
      </span>
    </span>
  );
}

function DateChip({
  label,
  value,
  tone = "accent",
}: {
  label: string;
  value?: string | null;
  tone?: "accent" | "success" | "warning" | "danger";
}) {
  const toneClasses = {
    accent: "border-accent/25 bg-accent-bg/70 text-accent",
    success: "border-success/25 bg-success-bg/70 text-success",
    warning: "border-warning/25 bg-warning-bg/70 text-warning",
    danger: "border-danger/25 bg-danger-bg/70 text-danger",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-xs rounded-xl border px-sm py-xs text-caption font-medium shadow-sm transition hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        toneClasses[tone]
      )}
    >
      <IconCalendarDue size={14} aria-hidden={true} />
      <span>{label}</span>
      <span className="text-text-primary">{formatMaintenanceDate(value)}</span>
    </span>
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

function TypeIcon({ record }: { record: MaintenanceRecord }) {
  const type = getMaintenanceRecordType(record);

  if (type === "disposal") {
    return <IconTrash size={15} aria-hidden={true} />;
  }

  if (type === "repair") {
    return <IconTool size={15} aria-hidden={true} />;
  }

  return <IconActivityHeartbeat size={15} aria-hidden={true} />;
}

function buildMaintenanceColumns(): DataTableColumn<MaintenanceRecord>[] {
  return [
    {
      key: "asset",
      label: "Varlık",
      sortable: true,
      sortKey: "asset__name",
      render: (record) => {
        const assetName = getMaintenanceAssetName(record);
        const assetCode = getMaintenanceAssetCode(record) ?? "-";

        return (
          <div className="flex min-w-[230px] items-center gap-sm">
            <EntityAvatar
              label={assetName}
              icon={<IconDeviceDesktop size={15} aria-hidden={true} />}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-text-primary">
                {assetName}
              </p>
              <span className="mt-xs inline-flex max-w-full rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-[11px] font-medium text-text-secondary shadow-sm">
                <span className="truncate">{assetCode}</span>
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: "record",
      label: "Kayıt",
      render: (record) => (
        <div className="min-w-[260px]">
          <p className="font-semibold text-text-primary">{getRecordTitle(record)}</p>
          <p className="line-clamp-2 max-w-[320px] text-caption text-text-secondary">
            {getRecordDescription(record)}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      label: "Tür",
      sortable: true,
      sortKey: "type",
      render: (record) => (
        <span className="inline-flex items-center gap-xs rounded-full border border-border-subtle bg-surface-0 px-sm py-xs text-caption font-semibold text-text-primary shadow-sm">
          <TypeIcon record={record} />
          <StatusBadge variant={getMaintenanceTypeVariant(record)}>
            {getMaintenanceTypeLabel(record)}
          </StatusBadge>
        </span>
      ),
    },
    {
      key: "status",
      label: "Durum",
      render: (record) => {
        const overdue = isMaintenanceOverdue(record);

        return (
          <StatusBadge
            variant={overdue ? "danger" : getMaintenanceStatusVariant(record)}
          >
            {overdue ? "Gecikmiş" : getMaintenanceStatusLabel(record)}
          </StatusBadge>
        );
      },
    },
    {
      key: "timeline",
      label: "Tarihler",
      sortable: true,
      sortKey: "performed_at",
      render: (record) => (
        <div className="flex min-w-[210px] flex-col gap-xs">
          <DateChip
            label="İşlem"
            value={getMaintenanceRecordDate(record)}
            tone={isMaintenanceOverdue(record) ? "danger" : "accent"}
          />
          <DateChip
            label="Sonraki"
            value={record.next_due_date}
            tone={isMaintenanceOverdue(record) ? "danger" : "warning"}
          />
        </div>
      ),
    },
    {
      key: "performed_by",
      label: "Firma / Sorumlu",
      sortable: true,
      sortKey: "performed_by",
      render: (record) => (
        <div className="min-w-[170px] rounded-2xl border border-border-subtle bg-surface-0/80 px-sm py-xs shadow-sm">
          <p className="text-body font-medium text-text-primary">
            {record.vendor || record.performed_by || "-"}
          </p>
          {record.vendor && record.performed_by ? (
            <p className="text-caption text-text-secondary">
              {record.performed_by}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "cost",
      label: "Maliyet",
      sortable: true,
      sortKey: "cost",
      className: "text-right",
      render: (record) => (
        <div className="flex flex-col items-end gap-xs">
          <span className="font-semibold text-text-primary">
            {formatMaintenanceCost(record.cost)}
          </span>
          {record.notes || record.description ? (
            <span className="inline-flex items-center gap-xs rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-[11px] font-medium text-text-secondary shadow-sm">
              <IconNotes size={13} aria-hidden={true} />
              Not var
            </span>
          ) : null}
        </div>
      ),
    },
  ];
}
const maintenanceColumns = buildMaintenanceColumns();

export function MaintenancePage() {
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
    ordering: "-performed_at",
  });

  const [toast, setToast] = useState<ToastState | null>(null);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [selectedMaintenanceRecord, setSelectedMaintenanceRecord] =
    useState<MaintenanceRecord | null>(null);

  const recordsQuery = useMaintenanceTable(state);
  const summaryQuery = useMaintenanceSummary();
  const assetsQuery = useAssets({});
  const createRecordMutation = useCreateMaintenanceRecord();

  const recordTableData = recordsQuery.data;
  const records = recordTableData?.results ?? [];
  const summary = summaryQuery.data;
  const assets = assetsQuery.data ?? [];

  const selectedType =
    typeof state.filters.type === "string" ? state.filters.type : "";

  const selectedOverdue =
    typeof state.filters.overdue === "string" ? state.filters.overdue : "";

  const selectedTypeLabel =
    typeFilterOptions.find((option) => option.value === selectedType)?.label ??
    "";

  const selectedOverdueLabel =
    overdueFilterOptions.find((option) => option.value === selectedOverdue)
      ?.label ?? "";

  const hasActiveFilters = Boolean(state.search || selectedType || selectedOverdue);

  const repairCount = useMemo(
    () =>
      records.filter((record) => getMaintenanceRecordType(record) === "repair")
        .length,
    [records]
  );

  const disposalCount = useMemo(
    () =>
      records.filter((record) => getMaintenanceRecordType(record) === "disposal")
        .length,
    [records]
  );

  const isSubmitting = createRecordMutation.isPending;

  const isLoading =
    recordsQuery.isLoading || summaryQuery.isLoading || assetsQuery.isLoading;

  const hasError =
    recordsQuery.isError || summaryQuery.isError || assetsQuery.isError;

  function refetchAll() {
    recordsQuery.refetch();
    summaryQuery.refetch();
    assetsQuery.refetch();
  }

  function handleCreateClick() {
    setIsCreatePanelOpen(true);
  }

  function closeCreatePanel() {
    if (isSubmitting) {
      return;
    }

    setIsCreatePanelOpen(false);
  }

  async function handleCreateRecord(payload: MaintenanceCreatePayload) {
    try {
      await createRecordMutation.mutateAsync(payload);

      setToast({
        type: "success",
        message: "Bakım / onarım / imha kaydı başarıyla oluşturuldu.",
      });

      setIsCreatePanelOpen(false);
      refetchAll();
    } catch (error) {
      setToast({
        type: "error",
        message: getMutationErrorMessage(error),
      });
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-wrap gap-sm">
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
        </div>

        <div className="mt-lg">
          <Skeleton className="h-[460px]" />
        </div>
      </AppShell>
    );
  }

  if (hasError) {
    return (
      <AppShell>
        <ErrorState message="Bakım / onarım / imha verisi alınamadı. Maintenance endpointlerini ve yetki durumunu kontrol et." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          eyebrow="Operasyonel Yaşam Döngüsü"
          title="Bakım / Onarım / İmha"
          description="Cihazların bakım, onarım ve imha süreçlerini takip et; yaklaşan ve gecikmiş operasyonları görünür hale getir."
          actions={
            <>
              <GlowButton
                variant="ghost"
                onClick={refetchAll}
                disabled={
                  recordsQuery.isFetching ||
                  summaryQuery.isFetching ||
                  assetsQuery.isFetching ||
                  isSubmitting
                }
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                {recordsQuery.isFetching ||
                summaryQuery.isFetching ||
                assetsQuery.isFetching
                  ? "Yenileniyor"
                  : "Veriyi yenile"}
              </GlowButton>

              {userCanManage && (
                <GlowButton
                  icon={<IconPlus size={16} aria-hidden={true} />}
                  onClick={handleCreateClick}
                  disabled={isSubmitting}
                >
                  Yeni Kayıt
                </GlowButton>
              )}
            </>
          }
        />

        <section className="mt-lg overflow-hidden rounded-panel border border-border-strong/60 bg-surface-1/75 shadow-panel backdrop-blur-sm">
          <div className="relative grid gap-md border-b border-border-subtle/80 p-md lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,var(--surface-1),transparent),radial-gradient(circle_at_0%_0%,var(--bg-danger),transparent_32%),radial-gradient(circle_at_88%_0%,var(--bg-warning),transparent_28%)] opacity-80" />

            <div className="relative min-w-0">
              <div className="flex flex-wrap items-center gap-sm">
                <span className="inline-flex items-center gap-xs rounded-full border border-danger/25 bg-danger-bg/70 px-sm py-xs text-caption font-semibold text-danger shadow-sm">
                  <IconSparkles size={14} aria-hidden={true} />
                  Maintenance Operations Console
                </span>
                <span className="inline-flex items-center gap-xs rounded-full border border-border bg-surface-0/80 px-sm py-xs text-caption text-text-secondary shadow-sm">
                  Bakım Operasyon Merkezi
                </span>
              </div>

              <p className="mt-sm max-w-3xl text-body leading-7 text-text-secondary">
                Bakım, onarım ve imha süreçlerini tek ekrandan takip et; tarih,
                maliyet, sorumlu ve varlık sinyallerini hızlı tara.
              </p>
            </div>

            <div className="relative grid grid-cols-2 gap-xs sm:grid-cols-4 lg:min-w-[520px]">
              <MiniMetricCard
                label="Toplam"
                value={recordTableData?.count ?? records.length}
                icon={<IconClipboardList size={14} aria-hidden={true} />}
                tone="accent"
              />
              <MiniMetricCard
                label="Açık risk"
                value={summary?.overdue_next_due ?? 0}
                icon={<IconAlertTriangle size={14} aria-hidden={true} />}
                tone="danger"
              />
              <MiniMetricCard
                label="Onarım"
                value={getSummaryTypeCount(summary, "repair", repairCount)}
                icon={<IconTool size={14} aria-hidden={true} />}
                tone="warning"
              />
              <MiniMetricCard
                label="İmha"
                value={getSummaryTypeCount(summary, "disposal", disposalCount)}
                icon={<IconTrash size={14} aria-hidden={true} />}
                tone="danger"
              />
            </div>
          </div>

          <div className="grid gap-sm p-md lg:grid-cols-[1fr_190px_190px_auto]">
            <label className="flex min-h-10 items-center gap-sm rounded-xl border border-danger/25 bg-surface-0/85 px-md py-xs shadow-sm transition focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20 motion-reduce:transition-none">
              <IconSearch
                size={18}
                className="text-danger"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="Varlık, açıklama, firma veya işlem yapan ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="min-h-10 rounded-xl border border-border bg-surface-0/85 px-sm py-xs text-body text-text-primary shadow-sm outline-none transition focus:border-danger focus:ring-2 focus:ring-danger/20 motion-reduce:transition-none"
              value={selectedType}
              onChange={(event) => setFilter("type", event.target.value || null)}
              aria-label="Tür filtresi"
            >
              {typeFilterOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="min-h-10 rounded-xl border border-border bg-surface-0/85 px-sm py-xs text-body text-text-primary shadow-sm outline-none transition focus:border-danger focus:ring-2 focus:ring-danger/20 motion-reduce:transition-none"
              value={selectedOverdue}
              onChange={(event) =>
                setFilter("overdue", event.target.value || null)
              }
              aria-label="Gecikme filtresi"
            >
              {overdueFilterOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-surface-0/85 px-md py-xs text-body font-medium text-text-primary shadow-sm transition hover:border-danger hover:bg-danger-bg hover:text-danger focus:outline-none focus:ring-2 focus:ring-danger/25 motion-reduce:transition-none"
            >
              Temizle
            </button>
          </div>

          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-sm border-t border-border-subtle/80 px-md py-sm">
              {state.search ? (
                <FilterChip
                  label="Arama"
                  value={state.search}
                  onRemove={() => setSearch("")}
                />
              ) : null}

              {selectedType ? (
                <FilterChip
                  label="Tür"
                  value={selectedTypeLabel}
                  onRemove={() => setFilter("type", null)}
                />
              ) : null}

              {selectedOverdue ? (
                <FilterChip
                  label="Gecikme"
                  value={selectedOverdueLabel}
                  onRemove={() => setFilter("overdue", null)}
                />
              ) : null}
            </div>
          ) : null}
        </section>
        {!userCanManage && (
          <section className="mt-lg rounded-panel border border-warning bg-warning-bg p-md">
            <p className="text-body text-warning">
              İzleyici rolündesin. Bakım / onarım / imha kayıtlarını
              görüntüleyebilirsin; yeni kayıt oluşturma ve güncelleme işlemleri
              admin veya technician rolü gerektirir.
            </p>
          </section>
        )}

        <section className="mt-lg flex flex-col gap-md">
          <DataTable
            columns={maintenanceColumns}
            data={records}
            getRowKey={(record) => record.id}
            ordering={state.ordering}
            onSortChange={setSort}
            isLoading={recordsQuery.isLoading}
            emptyMessage="Bakım / onarım / imha kaydı bulunamadı."
            onViewDetails={setSelectedMaintenanceRecord}
            viewDetailsLabel="Bakım detayını gör"
            getRowClassName={(record) =>
              selectedMaintenanceRecord?.id === record.id ? "bg-surface-2" : ""
            }
          />

          <TablePagination
            page={state.page}
            pageSize={state.pageSize}
            totalCount={recordTableData?.count ?? 0}
            hasNext={Boolean(recordTableData?.next)}
            hasPrevious={Boolean(recordTableData?.previous)}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </section>

        <SlideOverPanel
          open={isCreatePanelOpen}
          title="Yeni Bakım / Onarım / İmha Kaydı"
          description="Varlık için bakım, onarım veya imha süreci oluştur. İşlem sonrası varlık durumunu gerektiğinde güncelle."
          onClose={closeCreatePanel}
        >
          <MaintenanceForm
            assets={assets}
            isSubmitting={createRecordMutation.isPending}
            onCancel={closeCreatePanel}
            onSubmit={handleCreateRecord}
          />
        </SlideOverPanel>

        <SlideOverPanel
          open={Boolean(selectedMaintenanceRecord)}
          title={
            selectedMaintenanceRecord
              ? getRecordTitle(selectedMaintenanceRecord)
              : "Bakım kaydı detayı"
          }
          description={
            selectedMaintenanceRecord
              ? getMaintenanceAssetName(selectedMaintenanceRecord)
              : undefined
          }
          onClose={() => setSelectedMaintenanceRecord(null)}
        >
          {selectedMaintenanceRecord ? (
            <div className="space-y-md">
              <section className="overflow-hidden rounded-panel border border-danger/20 bg-surface-0 shadow-panel">
                <div className="h-1 bg-danger" />
                <div className="flex flex-wrap items-center justify-between gap-md p-md">
                  <div className="flex min-w-0 items-center gap-md">
                    <EntityAvatar
                      label={getMaintenanceAssetName(selectedMaintenanceRecord)}
                      tone={isMaintenanceOverdue(selectedMaintenanceRecord) ? "danger" : "accent"}
                      icon={<IconDeviceDesktop size={15} aria-hidden={true} />}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-sm">
                        <h3 className="truncate text-lg font-semibold text-text-primary">
                          {getRecordTitle(selectedMaintenanceRecord)}
                        </h3>
                        <StatusBadge
                          variant={getMaintenanceTypeVariant(selectedMaintenanceRecord)}
                        >
                          {getMaintenanceTypeLabel(selectedMaintenanceRecord)}
                        </StatusBadge>
                        <StatusBadge
                          variant={
                            isMaintenanceOverdue(selectedMaintenanceRecord)
                              ? "danger"
                              : getMaintenanceStatusVariant(selectedMaintenanceRecord)
                          }
                        >
                          {isMaintenanceOverdue(selectedMaintenanceRecord)
                            ? "Gecikmiş"
                            : getMaintenanceStatusLabel(selectedMaintenanceRecord)}
                        </StatusBadge>
                      </div>
                      <div className="mt-xs flex flex-wrap gap-xs">
                        <span className="rounded-full border border-border-subtle bg-surface-1 px-sm py-[2px] text-caption font-medium text-text-secondary">
                          {getMaintenanceAssetName(selectedMaintenanceRecord)}
                        </span>
                        <span className="rounded-full border border-accent/20 bg-accent-bg px-sm py-[2px] text-caption font-medium text-accent">
                          {getMaintenanceAssetCode(selectedMaintenanceRecord) ?? "-"}
                        </span>
                        <span className="rounded-full border border-border-subtle bg-surface-1 px-sm py-[2px] text-caption text-text-secondary">
                          İşlem: {formatMaintenanceDate(getMaintenanceRecordDate(selectedMaintenanceRecord))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <DetailSection
                title="Bakım Bilgisi"
                icon={<IconClipboardList size={17} aria-hidden={true} />}
                tone={isMaintenanceOverdue(selectedMaintenanceRecord) ? "danger" : "warning"}
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Kayıt türü"
                    value={getMaintenanceTypeLabel(selectedMaintenanceRecord)}
                  />
                  <DetailRow
                    label="Durum"
                    value={
                      isMaintenanceOverdue(selectedMaintenanceRecord)
                        ? "Gecikmiş"
                        : getMaintenanceStatusLabel(selectedMaintenanceRecord)
                    }
                  />
                  <DetailRow
                    label="Kayıt başlığı"
                    value={getRecordTitle(selectedMaintenanceRecord)}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Varlık"
                icon={<IconDeviceDesktop size={17} aria-hidden={true} />}
                tone="accent"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Varlık"
                    value={getMaintenanceAssetName(selectedMaintenanceRecord)}
                  />
                  <DetailRow
                    label="Envanter kodu"
                    value={getMaintenanceAssetCode(selectedMaintenanceRecord) ?? "-"}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Tarihler"
                icon={<IconCalendarDue size={17} aria-hidden={true} />}
                tone={isMaintenanceOverdue(selectedMaintenanceRecord) ? "danger" : "accent"}
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="İşlem tarihi"
                    value={formatMaintenanceDate(
                      getMaintenanceRecordDate(selectedMaintenanceRecord)
                    )}
                  />
                  <DetailRow
                    label="Sonraki bakım"
                    value={formatMaintenanceDate(
                      selectedMaintenanceRecord.next_due_date
                    )}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Maliyet / Sorumlu"
                icon={<IconTool size={17} aria-hidden={true} />}
                tone="success"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Firma"
                    value={selectedMaintenanceRecord.vendor || "-"}
                  />
                  <DetailRow
                    label="İşlem yapan"
                    value={selectedMaintenanceRecord.performed_by || "-"}
                  />
                  <DetailRow
                    label="Maliyet"
                    value={formatMaintenanceCost(selectedMaintenanceRecord.cost)}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Notlar"
                icon={<IconNotes size={17} aria-hidden={true} />}
                tone="accent"
              >
                <div className="grid gap-md">
                  <DetailRow
                    label="Açıklama"
                    value={getRecordDescription(selectedMaintenanceRecord)}
                  />
                  <DetailRow
                    label="Notlar"
                    value={selectedMaintenanceRecord.notes || "-"}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Sistem bilgisi"
                icon={<IconHistory size={17} aria-hidden={true} />}
                tone="success"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Oluşturulma tarihi"
                    value={formatMaintenanceDate(selectedMaintenanceRecord.created_at)}
                  />
                  <DetailRow
                    label="Güncellenme tarihi"
                    value={formatMaintenanceDate(selectedMaintenanceRecord.updated_at)}
                  />
                </div>
              </DetailSection>
            </div>
          ) : null}        </SlideOverPanel>

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
