import {
  IconDeviceDesktop,
  IconEdit,
  IconEye,
  IconPlus,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  AssetForm,
  type AssetFormSubmitPayload,
} from "../components/assets/AssetForm";
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
import { useActiveAssignments } from "../hooks/useAssignments";
import { useEmployees } from "../hooks/useEmployees";
import {
  useAssetCategories,
  useAssetSummary,
  useAssetTable,
  useCreateAsset,
  useCreateAssetWithAssignment,
  useUpdateAsset,
} from "../hooks/useInventory";
import { useTableQueryState } from "../hooks/useTableQueryState";
import {
  buildActiveAssignmentMap,
  getAssignmentDepartmentName,
  getAssignmentEmployeeName,
} from "../lib/assignments";
import {
  countAssetsByStatus,
  getAssetCategoryName,
  getAssetPrimaryCode,
  getAssetStatusLabel,
  getAssetStatusVariant,
  getSummaryStatusCount,
} from "../lib/inventory";
import { canManage } from "../lib/rbac";
import type { Asset, AssetCategory } from "../types/inventory";

type AssetFormMode = "create" | "edit";

type ToastState = {
  type: "success" | "error";
  message: string;
};

const statusOptions = [
  { value: "", label: "Tüm durumlar" },
  { value: "active", label: "Aktif" },
  { value: "assigned", label: "Zimmetli kayıtlar" },
  { value: "in_stock", label: "Depoda" },
  { value: "in_repair", label: "Bakımda" },
  { value: "faulty", label: "Arızalı" },
  { value: "retired", label: "Emekli" },
  { value: "disposed", label: "İmha edildi" },
  { value: "lost", label: "Kayıp" },
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

function formatDateTime(value?: string | null) {
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getOperationalStatusLabel(status: string) {
  if (status === "assigned") {
    return "Aktif";
  }

  return getAssetStatusLabel(status);
}

function getOperationalStatusVariant(
  status: string
): "accent" | "success" | "warning" | "danger" | "neutral" {
  if (status === "assigned") {
    return "success";
  }

  return getAssetStatusVariant(status);
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

function DateCell({ value }: { value?: string | null }) {
  return (
    <span className="inline-flex min-w-[108px] items-center justify-center rounded-app border border-border bg-surface-1 px-sm py-xs text-caption text-text-secondary shadow-panel">
      {formatDate(value)}
    </span>
  );
}

function BrandModelCell({ asset }: { asset: Asset }) {
  const value = [asset.brand, asset.model].filter(Boolean).join(" / ");

  return <span className="text-text-secondary">{value || "-"}</span>;
}

function buildAssetColumns({
  categories,
  activeAssignmentMap,
  userCanManage,
  onSelectAsset,
  onEditAsset,
}: {
  categories: AssetCategory[];
  activeAssignmentMap: ReturnType<typeof buildActiveAssignmentMap>;
  userCanManage: boolean;
  onSelectAsset: (asset: Asset) => void;
  onEditAsset: (asset: Asset) => void;
}): DataTableColumn<Asset>[] {
  return [
    {
      key: "name",
      label: "Varlık",
      sortable: true,
      sortKey: "name",
      render: (asset) => (
        <div>
          <p className="text-text-primary">{asset.name}</p>
          <p className="text-caption text-text-secondary">
            {getAssetPrimaryCode(asset)}
          </p>
        </div>
      ),
    },
    {
      key: "category_name",
      label: "Kategori",
      sortable: true,
      sortKey: "category__name",
      render: (asset) => getAssetCategoryName(asset, categories),
    },
    {
      key: "brand",
      label: "Marka / Model",
      sortable: true,
      sortKey: "brand",
      render: (asset) => <BrandModelCell asset={asset} />,
    },
    {
      key: "status",
      label: "Durum",
      sortable: true,
      sortKey: "status",
      render: (asset) => (
        <StatusBadge variant={getOperationalStatusVariant(asset.status)}>
          {getOperationalStatusLabel(asset.status)}
        </StatusBadge>
      ),
    },
    {
      key: "assigned_employee",
      label: "Zimmetli Kişi",
      render: (asset) => {
        const activeAssignment = activeAssignmentMap.get(asset.id);
        const employeeName = activeAssignment
          ? getAssignmentEmployeeName(activeAssignment)
          : "Boşta";
        const departmentName = activeAssignment
          ? getAssignmentDepartmentName(activeAssignment)
          : null;

        return (
          <div>
            <p className="text-body text-text-primary">{employeeName}</p>
            {departmentName ? (
              <p className="text-caption text-text-secondary">
                {departmentName}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "location",
      label: "Konum",
      sortable: true,
      sortKey: "location",
      render: (asset) => asset.location || "-",
    },
    {
      key: "warranty_end_date",
      label: "Garanti",
      sortable: true,
      sortKey: "warranty_end_date",
      render: (asset) => <DateCell value={asset.warranty_end_date} />,
    },
    {
      key: "next_maintenance_due_date",
      label: "Sonraki Bakım",
      sortable: true,
      sortKey: "next_maintenance_due_date",
      render: (asset) => <DateCell value={asset.next_maintenance_due_date} />,
    },
    {
      key: "actions",
      label: "İşlem",
      className: "text-right",
      render: (asset) => (
        <div className="flex justify-end gap-sm">
          <GlowButton
            variant="ghost"
            onClick={() => onSelectAsset(asset)}
            icon={<IconEye size={16} aria-hidden={true} />}
          >
            Detay
          </GlowButton>

          {userCanManage ? (
            <GlowButton
              variant="ghost"
              onClick={() => onEditAsset(asset)}
              icon={<IconEdit size={16} aria-hidden={true} />}
            >
              Düzenle
            </GlowButton>
          ) : null}
        </div>
      ),
    },
  ];
}

export function AssetsPage() {
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
    ordering: "name",
  });

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetFormMode, setAssetFormMode] = useState<AssetFormMode | null>(
    null
  );
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const assetsQuery = useAssetTable(state);
  const summaryQuery = useAssetSummary();
  const categoriesQuery = useAssetCategories();
  const activeAssignmentsQuery = useActiveAssignments();
  const employeesQuery = useEmployees();
  const createAssetMutation = useCreateAsset();
  const createAssetWithAssignmentMutation = useCreateAssetWithAssignment();
  const updateAssetMutation = useUpdateAsset();

  const assetTableData = assetsQuery.data;
  const assets = assetTableData?.results ?? [];
  const summary = summaryQuery.data;
  const categories = categoriesQuery.data ?? [];
  const activeAssignments = activeAssignmentsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];

  const selectedStatus =
    typeof state.filters.status === "string" ? state.filters.status : "";

  const selectedCategory =
    typeof state.filters.category === "string" ? state.filters.category : "";

  const activeAssignmentMap = useMemo(
    () => buildActiveAssignmentMap(activeAssignments),
    [activeAssignments]
  );

  function refetchAll() {
    assetsQuery.refetch();
    summaryQuery.refetch();
    categoriesQuery.refetch();
    activeAssignmentsQuery.refetch();
    employeesQuery.refetch();
  }

  function openCreateForm() {
    setSelectedAsset(null);
    setEditingAsset(null);
    setAssetFormMode("create");
  }

  function openEditForm(asset: Asset) {
    setSelectedAsset(null);
    setEditingAsset(asset);
    setAssetFormMode("edit");
  }

  function closeAssetForm() {
    if (isAssetFormSubmitting) {
      return;
    }

    setAssetFormMode(null);
    setEditingAsset(null);
  }

  const assetColumns = useMemo(
    () =>
      buildAssetColumns({
        categories,
        activeAssignmentMap,
        userCanManage,
        onSelectAsset: setSelectedAsset,
        onEditAsset: openEditForm,
      }),
    [categories, activeAssignmentMap, userCanManage]
  );

  const isAssetFormSubmitting =
    createAssetMutation.isPending ||
    createAssetWithAssignmentMutation.isPending ||
    updateAssetMutation.isPending;

  const totalAssets = assetTableData?.count ?? assets.length;

  const activeAssets =
    getSummaryStatusCount(summary, "active") +
      getSummaryStatusCount(summary, "assigned") ||
    countAssetsByStatus(assets, ["active", "aktif", "assigned", "zimmetli"]);

  const assignedAssets =
    activeAssignments.length ||
    getSummaryStatusCount(summary, "assigned") ||
    countAssetsByStatus(assets, ["assigned", "zimmetli"]);

  const inRepairAssets =
    getSummaryStatusCount(summary, "in_repair") ||
    countAssetsByStatus(assets, ["in_repair", "repair", "bakımda", "bakimda"]);

  const faultyAssets =
    getSummaryStatusCount(summary, "faulty") ||
    countAssetsByStatus(assets, ["faulty", "arızalı", "arizali"]);

  const isInitialLoading =
    assetsQuery.isLoading ||
    summaryQuery.isLoading ||
    categoriesQuery.isLoading ||
    activeAssignmentsQuery.isLoading;

  const hasError =
    assetsQuery.isError ||
    summaryQuery.isError ||
    categoriesQuery.isError ||
    activeAssignmentsQuery.isError;

  const selectedAssetAssignment = selectedAsset
    ? activeAssignmentMap.get(selectedAsset.id)
    : null;

  async function handleAssetFormSubmit(payload: AssetFormSubmitPayload) {
    if (!assetFormMode) {
      return;
    }

    try {
      if (assetFormMode === "create") {
        if (payload.assignment) {
          await createAssetWithAssignmentMutation.mutateAsync({
            asset: payload.asset,
            assignment: {
              employee: payload.assignment.employee,
              assigned_at: payload.assignment.assigned_at,
              notes: payload.assignment.notes,
            },
          });

          setToast({
            type: "success",
            message: "Varlık oluşturuldu ve personele zimmetlendi.",
          });
        } else {
          await createAssetMutation.mutateAsync(payload.asset);

          setToast({
            type: "success",
            message: "Varlık başarıyla oluşturuldu.",
          });
        }
      } else if (editingAsset) {
        await updateAssetMutation.mutateAsync({
          id: editingAsset.id,
          payload: payload.asset,
        });

        setToast({
          type: "success",
          message: "Varlık başarıyla güncellendi.",
        });
      }

      setAssetFormMode(null);
      setEditingAsset(null);
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
        <div className="flex flex-wrap gap-sm">
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-24 rounded-full" />
          <Skeleton className="h-14 w-28 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
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
        <ErrorState message="Envanter veya aktif zimmet verisi alınamadı. API endpointlerini ve yetki durumunu kontrol et." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          eyebrow="Envanter Yönetimi"
          title="Envanter"
          description="Şirket içindeki cihazları, zimmet durumlarını, garanti ve bakım risklerini tek ekrandan takip et."
          actions={
            <>
              <GlowButton
                variant="ghost"
                onClick={refetchAll}
                disabled={
                  assetsQuery.isFetching ||
                  activeAssignmentsQuery.isFetching ||
                  isAssetFormSubmitting
                }
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                {assetsQuery.isFetching || activeAssignmentsQuery.isFetching
                  ? "Yenileniyor"
                  : "Veriyi yenile"}
              </GlowButton>

              {userCanManage && (
                <GlowButton
                  icon={<IconPlus size={16} aria-hidden={true} />}
                  onClick={openCreateForm}
                  disabled={isAssetFormSubmitting}
                >
                  Yeni Varlık
                </GlowButton>
              )}
            </>
          }
        />

        <section className="mt-lg flex flex-wrap gap-sm">
          <MiniMetricCard
            label="Varlık sayısı"
            value={totalAssets}
            icon={<IconDeviceDesktop size={15} aria-hidden={true} />}
            tone="accent"
          />

          <MiniMetricCard
            label="Aktif"
            value={activeAssets}
            icon={<IconDeviceDesktop size={15} aria-hidden={true} />}
            tone="success"
          />

          <MiniMetricCard
            label="Zimmetli"
            value={assignedAssets}
            icon={<IconDeviceDesktop size={15} aria-hidden={true} />}
            tone="warning"
          />

          <MiniMetricCard
            label="Bakım / Arıza"
            value={inRepairAssets + faultyAssets}
            icon={<IconDeviceDesktop size={15} aria-hidden={true} />}
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
                placeholder="Varlık adı, envanter kodu, seri no ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
              value={selectedStatus}
              onChange={(event) => setFilter("status", event.target.value || null)}
              aria-label="Durum filtresi"
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
              value={selectedCategory}
              onChange={(event) =>
                setFilter("category", event.target.value || null)
              }
              aria-label="Kategori filtresi"
            >
              <option value="">Tüm kategoriler</option>

              {categories.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
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

        <section className="mt-lg flex flex-col gap-md">
          <DataTable
            columns={assetColumns}
            data={assets}
            getRowKey={(asset) => asset.id}
            ordering={state.ordering}
            onSortChange={setSort}
            isLoading={assetsQuery.isLoading}
            emptyMessage="Filtrelere uygun varlık bulunamadı."
          />

          <TablePagination
            page={state.page}
            pageSize={state.pageSize}
            totalCount={assetTableData?.count ?? 0}
            hasNext={Boolean(assetTableData?.next)}
            hasPrevious={Boolean(assetTableData?.previous)}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </section>

        <SlideOverPanel
          open={Boolean(selectedAsset)}
          title={selectedAsset?.name ?? "Varlık detayı"}
          description={
            selectedAsset ? getAssetPrimaryCode(selectedAsset) : undefined
          }
          onClose={() => setSelectedAsset(null)}
        >
          {selectedAsset && (
            <div className="space-y-md">
              <div className="flex items-center justify-between gap-md rounded-panel border border-border bg-surface-1 p-md shadow-panel">
                <div>
                  <p className="text-caption text-text-secondary">Durum</p>

                  <StatusBadge
                    variant={getOperationalStatusVariant(selectedAsset.status)}
                  >
                    {getOperationalStatusLabel(selectedAsset.status)}
                  </StatusBadge>
                </div>

                {userCanManage && (
                  <GlowButton
                    variant="ghost"
                    icon={<IconEdit size={16} aria-hidden={true} />}
                    onClick={() => openEditForm(selectedAsset)}
                  >
                    Düzenle
                  </GlowButton>
                )}
              </div>

              <div className="grid gap-md sm:grid-cols-2">
                <DetailRow
                  label="Envanter kodu"
                  value={selectedAsset.inventory_code}
                />

                <DetailRow
                  label="Seri numarası"
                  value={selectedAsset.serial_number}
                />

                <DetailRow
                  label="Kategori"
                  value={getAssetCategoryName(selectedAsset, categories)}
                />

                <DetailRow
                  label="Durum"
                  value={getOperationalStatusLabel(selectedAsset.status)}
                />

                <DetailRow
                  label="Aktif zimmet"
                  value={
                    selectedAssetAssignment
                      ? getAssignmentEmployeeName(selectedAssetAssignment)
                      : "Boşta"
                  }
                />

                <DetailRow
                  label="Zimmet departmanı"
                  value={
                    selectedAssetAssignment
                      ? getAssignmentDepartmentName(selectedAssetAssignment)
                      : null
                  }
                />

                <DetailRow label="Marka" value={selectedAsset.brand} />
                <DetailRow label="Model" value={selectedAsset.model} />
                <DetailRow label="Konum" value={selectedAsset.location} />

                <DetailRow
                  label="Satın alma tarihi"
                  value={formatDate(selectedAsset.purchase_date)}
                />

                <DetailRow
                  label="Garanti bitiş tarihi"
                  value={formatDate(selectedAsset.warranty_end_date)}
                />

                <DetailRow
                  label="Sonraki bakım tarihi"
                  value={formatDate(selectedAsset.next_maintenance_due_date)}
                />

                <DetailRow
                  label="Oluşturulma tarihi"
                  value={formatDateTime(selectedAsset.created_at)}
                />

                <DetailRow
                  label="Güncellenme tarihi"
                  value={formatDateTime(selectedAsset.updated_at)}
                />
              </div>

              <DetailRow label="Notlar" value={selectedAsset.notes} />
            </div>
          )}
        </SlideOverPanel>

        <SlideOverPanel
          open={Boolean(assetFormMode)}
          title={assetFormMode === "create" ? "Yeni Varlık" : "Varlık Düzenle"}
          description={
            assetFormMode === "create"
              ? "Yeni bir cihaz veya ekipmanı envantere ekle."
              : editingAsset
                ? `${editingAsset.name} kaydını güncelle.`
                : "Varlık kaydını güncelle."
          }
          onClose={closeAssetForm}
        >
          {assetFormMode && (
            <AssetForm
              mode={assetFormMode}
              asset={assetFormMode === "edit" ? editingAsset : null}
              categories={categories}
              employees={employees}
              isSubmitting={isAssetFormSubmitting}
              onCancel={closeAssetForm}
              onSubmit={handleAssetFormSubmit}
            />
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