import {
  IconAlertTriangle,
  IconCalendarDue,
  IconClipboardList,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTool,
  IconTrash,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
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

function buildMaintenanceColumns(): DataTableColumn<MaintenanceRecord>[] {
  return [
    {
      key: "asset",
      label: "Varlık",
      sortable: true,
      sortKey: "asset__name",
      render: (record) => (
        <div>
          <p className="text-text-primary">{getMaintenanceAssetName(record)}</p>
          <p className="text-caption text-text-secondary">
            {getMaintenanceAssetCode(record) ?? "-"}
          </p>
        </div>
      ),
    },
    {
      key: "record",
      label: "Kayıt",
      render: (record) => (
        <div>
          <p className="text-text-primary">{getRecordTitle(record)}</p>
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
        <StatusBadge variant={getMaintenanceTypeVariant(record)}>
          {getMaintenanceTypeLabel(record)}
        </StatusBadge>
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
      key: "performed_at",
      label: "İşlem Tarihi",
      sortable: true,
      sortKey: "performed_at",
      render: (record) =>
        formatMaintenanceDate(getMaintenanceRecordDate(record)),
    },
    {
      key: "next_due_date",
      label: "Sonraki Bakım",
      sortable: true,
      sortKey: "next_due_date",
      render: (record) => formatMaintenanceDate(record.next_due_date),
    },
    {
      key: "performed_by",
      label: "Firma / İşlem Yapan",
      sortable: true,
      sortKey: "performed_by",
      render: (record) => (
        <div className="text-text-secondary">
          <p>{record.vendor || record.performed_by || "-"}</p>
          {record.vendor && record.performed_by ? (
            <p className="text-caption">{record.performed_by}</p>
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
      render: (record) => formatMaintenanceCost(record.cost),
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

        <section className="mt-lg flex flex-wrap gap-sm">
          <MiniMetricCard
            label="Gösterilen kayıt"
            value={recordTableData?.count ?? records.length}
            icon={<IconClipboardList size={15} aria-hidden={true} />}
            tone="accent"
          />

          <MiniMetricCard
            label="30 gün içinde"
            value={summary?.upcoming_30_days ?? 0}
            icon={<IconCalendarDue size={15} aria-hidden={true} />}
            tone="warning"
          />

          <MiniMetricCard
            label="Gecikmiş bakım"
            value={summary?.overdue_next_due ?? 0}
            icon={<IconAlertTriangle size={15} aria-hidden={true} />}
            tone="danger"
          />

          <MiniMetricCard
            label="Onarım kaydı"
            value={getSummaryTypeCount(summary, "repair", repairCount)}
            icon={<IconTool size={15} aria-hidden={true} />}
            tone="success"
          />

          <MiniMetricCard
            label="İmha kaydı"
            value={getSummaryTypeCount(summary, "disposal", disposalCount)}
            icon={<IconTrash size={15} aria-hidden={true} />}
            tone="danger"
          />
        </section>

        <section className="mt-lg rounded-panel border border-border bg-surface-1 p-md shadow-panel">
          <div className="grid gap-md lg:grid-cols-[1fr_220px_220px_auto]">
            <label className="flex items-center gap-sm rounded-app border border-border bg-surface-2 px-md py-sm shadow-panel">
              <IconSearch
                size={18}
                className="text-text-secondary"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                placeholder="Varlık, açıklama, firma veya işlem yapan ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
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
              className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
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
              className="inline-flex items-center justify-center rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
            >
              Temizle
            </button>
          </div>
        </section>

        {!userCanManage && (
          <section className="mt-lg rounded-panel border border-warning bg-warning-bg p-md">
            <p className="text-body text-warning">
              Viewer rolündesin. Bakım / onarım / imha kayıtlarını
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