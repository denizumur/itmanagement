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
import { MaintenanceForm } from "../components/maintenance/MaintenanceForm";
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
import { useAssets } from "../hooks/useInventory";
import {
  useCreateMaintenanceRecord,
  useMaintenanceRecords,
  useMaintenanceSummary,
  useOverdueMaintenanceRecords,
  useUpcomingMaintenanceRecords,
} from "../hooks/useMaintenance";
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
  getMaintenanceSummaryTotal,
  getMaintenanceTypeLabel,
  getMaintenanceTypeVariant,
  isMaintenanceOverdue,
} from "../lib/maintenance";
import { canManage } from "../lib/rbac";
import type {
  MaintenanceCreatePayload,
  MaintenanceRecord,
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

export function MaintenancePage() {
  const { user } = useAuth();
  const userCanManage = canManage(user?.role);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);

  const recordsQuery = useMaintenanceRecords();
  const summaryQuery = useMaintenanceSummary();
  const upcomingQuery = useUpcomingMaintenanceRecords();
  const overdueQuery = useOverdueMaintenanceRecords();
  const assetsQuery = useAssets({});
  const createRecordMutation = useCreateMaintenanceRecord();

  const records = recordsQuery.data ?? [];
  const summary = summaryQuery.data;
  const upcomingRecords = upcomingQuery.data ?? [];
  const overdueRecords = overdueQuery.data ?? [];
  const assets = assetsQuery.data ?? [];

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("tr-TR");

    return records.filter((record) => {
      const recordType = getMaintenanceRecordType(record);

      if (typeFilter && recordType !== typeFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const values = [
        getMaintenanceAssetName(record),
        getMaintenanceAssetCode(record),
        getMaintenanceTypeLabel(record),
        getMaintenanceStatusLabel(record),
        getRecordTitle(record),
        getRecordDescription(record),
        record.vendor,
        record.performed_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return values.includes(normalizedSearch);
    });
  }, [records, search, typeFilter]);

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
    recordsQuery.isLoading ||
    summaryQuery.isLoading ||
    upcomingQuery.isLoading ||
    overdueQuery.isLoading ||
    assetsQuery.isLoading;

  const hasError =
    recordsQuery.isError ||
    summaryQuery.isError ||
    upcomingQuery.isError ||
    overdueQuery.isError ||
    assetsQuery.isError;

  function refetchAll() {
    recordsQuery.refetch();
    summaryQuery.refetch();
    upcomingQuery.refetch();
    overdueQuery.refetch();
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
        <div className="grid gap-md md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
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
                  upcomingQuery.isFetching ||
                  overdueQuery.isFetching ||
                  assetsQuery.isFetching ||
                  isSubmitting
                }
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                {recordsQuery.isFetching ||
                summaryQuery.isFetching ||
                upcomingQuery.isFetching ||
                overdueQuery.isFetching ||
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

        <section className="grid gap-md md:grid-cols-2 xl:grid-cols-4">
          <DataCard className="metric-card-accent p-lg">
            <IconClipboardList size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {getMaintenanceSummaryTotal(summary) || records.length}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Toplam kayıt
            </p>
          </DataCard>

          <DataCard className="metric-card-warning p-lg">
            <IconCalendarDue size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {getMaintenanceSummaryCount(summary, "upcoming_count") ||
                upcomingRecords.length}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Yaklaşan bakım
            </p>
          </DataCard>

          <DataCard className="metric-card-danger p-lg">
            <IconAlertTriangle size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {getMaintenanceSummaryCount(summary, "overdue_count") ||
                overdueRecords.length}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Gecikmiş bakım
            </p>
          </DataCard>

          <DataCard className="metric-card-success p-lg">
            <IconTool size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {getMaintenanceSummaryCount(summary, "repair_count") ||
                repairCount}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Onarım kaydı
            </p>
          </DataCard>
        </section>

        <section className="mt-lg grid gap-md lg:grid-cols-[1fr_320px]">
          <DataCard className="p-lg">
            <div className="grid gap-md lg:grid-cols-[1fr_220px]">
              <label className="flex items-center gap-sm rounded-app border border-border bg-surface-1 px-md py-sm shadow-panel">
                <IconSearch
                  size={18}
                  className="text-text-secondary"
                  aria-hidden={true}
                />

                <input
                  className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                  placeholder="Varlık, açıklama, firma, işlem yapan veya durum ara..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <select
                className="rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                {typeFilterOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </DataCard>

          <DataCard className="p-lg">
            <div className="flex items-center gap-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-app bg-danger-bg text-danger">
                <IconTrash size={20} aria-hidden={true} />
              </div>

              <div>
                <p className="text-h3 text-text-primary">{disposalCount}</p>
                <p className="text-caption text-text-secondary">
                  İmha geçmişi kaydı
                </p>
              </div>
            </div>
          </DataCard>
        </section>

        {!userCanManage && (
          <DataCard className="mt-lg border-warning bg-warning-bg p-md">
            <p className="text-body text-warning">
              Viewer rolündesin. Bakım / onarım / imha kayıtlarını
              görüntüleyebilirsin; yeni kayıt oluşturma ve güncelleme işlemleri
              admin veya technician rolü gerektirir.
            </p>
          </DataCard>
        )}

        <section className="mt-lg">
          <DataTable
            title="Bakım / Onarım / İmha kayıtları"
            description={`${filteredRecords.length} kayıt görüntüleniyor.`}
          >
            {!filteredRecords.length ? (
              <div className="rounded-app border border-border bg-surface-1 p-lg text-center text-text-secondary">
                Kayıt bulunamadı.
              </div>
            ) : (
              <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-body">
                <thead>
                  <tr className="text-caption text-text-secondary">
                    <th className="border-b border-border px-md py-sm font-normal">
                      Varlık
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Kayıt
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Tür
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Durum
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Tarih
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Firma / İşlem yapan
                    </th>
                    <th className="border-b border-border px-md py-sm text-right font-normal">
                      Maliyet
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map((record) => {
                    const overdue = isMaintenanceOverdue(record);

                    return (
                      <tr
                        key={record.id}
                        className="transition hover:bg-surface-1"
                      >
                        <td className="border-b border-border px-md py-md">
                          <p className="text-text-primary">
                            {getMaintenanceAssetName(record)}
                          </p>
                          <p className="text-caption text-text-secondary">
                            {getMaintenanceAssetCode(record) ?? "-"}
                          </p>
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <p className="text-text-primary">
                            {getRecordTitle(record)}
                          </p>
                          <p className="line-clamp-2 max-w-[320px] text-caption text-text-secondary">
                            {getRecordDescription(record)}
                          </p>
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <StatusBadge
                            variant={getMaintenanceTypeVariant(record)}
                          >
                            {getMaintenanceTypeLabel(record)}
                          </StatusBadge>
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <div className="flex flex-col items-start gap-xs">
                            <StatusBadge
                              variant={
                                overdue
                                  ? "danger"
                                  : getMaintenanceStatusVariant(record)
                              }
                            >
                              {overdue
                                ? "Gecikmiş"
                                : getMaintenanceStatusLabel(record)}
                            </StatusBadge>
                          </div>
                        </td>

                        <td className="border-b border-border px-md py-md text-text-secondary">
                          {formatMaintenanceDate(
                            getMaintenanceRecordDate(record)
                          )}
                        </td>

                        <td className="border-b border-border px-md py-md text-text-secondary">
                          <p>{record.vendor || record.performed_by || "-"}</p>
                          {record.vendor && record.performed_by && (
                            <p className="text-caption">
                              {record.performed_by}
                            </p>
                          )}
                        </td>

                        <td className="border-b border-border px-md py-md text-right text-text-secondary">
                          {formatMaintenanceCost(record.cost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </DataTable>
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