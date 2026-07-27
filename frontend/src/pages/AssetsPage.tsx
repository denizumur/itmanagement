import {
  IconActivityHeartbeat,
  IconCalendarDue,
  IconDeviceDesktop,
  IconEdit,
  IconHistory,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconTag,
  IconUserCheck,
  IconX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AuditHistoryLink } from "../components/audit/AuditHistoryLink";
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
import { cn } from "../lib/cn";
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
    <div className="rounded-2xl border border-border-subtle bg-surface-0/90 p-md shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-panel focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-xs text-body text-text-primary">{displayValue}</p>
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
    accent: "bg-accent-bg text-accent border-accent/20",
    success: "bg-success-bg text-success border-success/20",
    warning: "bg-warning-bg text-warning border-warning/25",
    danger: "bg-danger-bg text-danger border-danger/25",
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

function TimelineChip({
  label,
  value,
  isRisky,
}: {
  label: string;
  value?: string | null;
  isRisky?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-xs rounded-xl border px-sm py-xs text-caption shadow-sm transition hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        isRisky
          ? "border-danger/30 bg-danger/10 text-danger"
          : "border-success/20 bg-success-bg/60 text-success"
      )}
    >
      <IconCalendarDue size={14} aria-hidden={true} />
      <span className="font-medium">{label}</span>
      <span>{formatDate(value)}</span>
    </span>
  );
}

function TimelineCell({ asset }: { asset: Asset }) {
  return (
    <div className="flex min-w-[190px] flex-col gap-xs">
      <TimelineChip
        label="Garanti"
        value={asset.warranty_end_date}
        isRisky={asset.is_warranty_expired}
      />
      <TimelineChip
        label="Bakım"
        value={asset.next_maintenance_due_date}
        isRisky={asset.is_maintenance_overdue}
      />
    </div>
  );
}

function AssetAvatar({ asset }: { asset: Asset }) {
  const initial = asset.name?.slice(0, 1).toLocaleUpperCase("tr-TR") || "V";

  return (
    <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent-bg text-body font-semibold text-accent shadow-sm">
      <IconDeviceDesktop
        size={16}
        className="absolute -right-1 -top-1 rounded-full border border-surface-1 bg-surface-1 text-text-secondary"
        aria-hidden={true}
      />
      {initial}
    </span>
  );
}

function CategoryCell({
  asset,
  categories,
}: {
  asset: Asset;
  categories: AssetCategory[];
}) {
  const categoryName = getAssetCategoryName(asset, categories);
  const initial = categoryName === "-" ? "?" : categoryName.slice(0, 1);

  return (
    <div className="flex items-center gap-sm">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent-bg text-caption font-semibold text-accent shadow-sm ring-1 ring-accent/10">
        {initial}
      </span>
      <span className="font-medium text-text-primary">{categoryName}</span>
    </div>
  );
}

function BrandModelCell({ asset }: { asset: Asset }) {
  const value = [asset.brand, asset.model].filter(Boolean).join(" / ");

  return <span className="text-text-secondary">{value || "-"}</span>;
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
      <span>{label}: {value}</span>
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

function buildAssetColumns({
  categories,
  activeAssignmentMap,
}: {
  categories: AssetCategory[];
  activeAssignmentMap: ReturnType<typeof buildActiveAssignmentMap>;
}): DataTableColumn<Asset>[] {
  return [
    {
      key: "name",
      label: "Varlık",
      sortable: true,
      sortKey: "name",
      render: (asset) => (
        <div className="flex min-w-[230px] items-center gap-sm">
          <AssetAvatar asset={asset} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">
              {asset.name}
            </p>
            <span className="mt-xs inline-flex max-w-full rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-[11px] font-medium text-text-secondary shadow-sm">
              <span className="truncate">{getAssetPrimaryCode(asset)}</span>
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "category_name",
      label: "Kategori",
      sortable: true,
      sortKey: "category__name",
      render: (asset) => <CategoryCell asset={asset} categories={categories} />,
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
          <div className="min-w-[170px] rounded-2xl border border-border-subtle bg-surface-0/80 px-sm py-xs shadow-sm">
            <p className="text-body font-medium text-text-primary">
              {employeeName}
            </p>
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
      key: "timeline",
      label: "Zaman Çizelgesi",
      sortable: true,
      sortKey: "warranty_end_date",
      render: (asset) => <TimelineCell asset={asset} />,
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
      }),
    [categories, activeAssignmentMap]
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

  const selectedStatusLabel =
    statusOptions.find((option) => option.value === selectedStatus)?.label ?? "";

  const selectedCategoryLabel =
    categories.find((category) => String(category.id) === selectedCategory)
      ?.name ?? "";

  const hasActiveFilters = Boolean(
    state.search || selectedStatus || selectedCategory
  );

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

        <section className="mt-lg overflow-hidden rounded-panel border border-border-strong/60 bg-surface-1/75 shadow-panel backdrop-blur-sm">
          <div className="relative grid gap-md border-b border-border-subtle/80 p-md lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,var(--surface-1),transparent),radial-gradient(circle_at_0%_0%,var(--bg-accent),transparent_34%),radial-gradient(circle_at_88%_0%,var(--bg-success),transparent_28%)] opacity-80" />

            <div className="relative min-w-0">
              <div className="flex flex-wrap items-center gap-sm">
                <span className="inline-flex items-center gap-xs rounded-full border border-accent/25 bg-accent-bg/70 px-sm py-xs text-caption font-semibold text-accent shadow-sm">
                  <IconSparkles size={14} aria-hidden={true} />
                  Modern IT Ops Console
                </span>
                <span className="inline-flex items-center gap-xs rounded-full border border-border bg-surface-0/80 px-sm py-xs text-caption text-text-secondary shadow-sm">
                  Asset Control Center
                </span>
              </div>

              <p className="mt-sm max-w-3xl text-body leading-7 text-text-secondary">
                Cihaz sağlığı, zimmet ve bakım risklerini tek merkezden izle;
                tabloyu ana çalışma yüzeyi, metrikleri hızlı telemetry sinyali
                olarak kullan.
              </p>
            </div>

            <div className="relative grid grid-cols-2 gap-xs sm:grid-cols-4 lg:min-w-[520px]">
              <MiniMetricCard
                label="Varlık"
                value={totalAssets}
                icon={<IconDeviceDesktop size={14} aria-hidden={true} />}
                tone="accent"
              />
              <MiniMetricCard
                label="Aktif"
                value={activeAssets}
                icon={<IconShieldCheck size={14} aria-hidden={true} />}
                tone="success"
              />
              <MiniMetricCard
                label="Zimmet"
                value={assignedAssets}
                icon={<IconUserCheck size={14} aria-hidden={true} />}
                tone="warning"
              />
              <MiniMetricCard
                label="Risk"
                value={inRepairAssets + faultyAssets}
                icon={<IconActivityHeartbeat size={14} aria-hidden={true} />}
                tone="danger"
              />
            </div>
          </div>

          <div className="grid gap-sm p-md lg:grid-cols-[1fr_190px_190px_auto]">
            <label className="flex min-h-10 items-center gap-sm rounded-xl border border-accent/25 bg-surface-0/85 px-md py-xs shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none">
              <IconSearch
                size={18}
                className="text-accent"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="Varlık adı, envanter kodu, seri no ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="min-h-10 rounded-xl border border-border bg-surface-0/85 px-sm py-xs text-body text-text-primary shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
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
              className="min-h-10 rounded-xl border border-border bg-surface-0/85 px-sm py-xs text-body text-text-primary shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
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
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-surface-0/85 px-md py-xs text-body font-medium text-text-primary shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
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

              {selectedStatus ? (
                <FilterChip
                  label="Durum"
                  value={selectedStatusLabel}
                  onRemove={() => setFilter("status", null)}
                />
              ) : null}

              {selectedCategory ? (
                <FilterChip
                  label="Kategori"
                  value={selectedCategoryLabel}
                  onRemove={() => setFilter("category", null)}
                />
              ) : null}
            </div>
          ) : null}
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
            onViewDetails={setSelectedAsset}
            viewDetailsLabel="Varlık detayını gör"
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
              <section className="overflow-hidden rounded-panel border border-accent/20 bg-surface-0 shadow-panel">
                <div className="h-1 bg-accent" />
                <div className="flex flex-wrap items-center justify-between gap-md">
                  <div className="flex min-w-0 items-center gap-md p-md">
                    <AssetAvatar asset={selectedAsset} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-sm">
                        <h3 className="truncate text-lg font-semibold text-text-primary">
                          {selectedAsset.name}
                        </h3>
                        <StatusBadge
                          variant={getOperationalStatusVariant(
                            selectedAsset.status
                          )}
                        >
                          {getOperationalStatusLabel(selectedAsset.status)}
                        </StatusBadge>
                      </div>
                      <div className="mt-xs flex flex-wrap gap-xs">
                        <span className="rounded-full border border-border-subtle bg-surface-1 px-sm py-[2px] text-caption font-medium text-text-secondary">
                          {getAssetPrimaryCode(selectedAsset)}
                        </span>
                        <span className="rounded-full border border-accent/20 bg-accent-bg px-sm py-[2px] text-caption font-medium text-accent">
                          {getAssetCategoryName(selectedAsset, categories)}
                        </span>
                        <span className="rounded-full border border-border-subtle bg-surface-1 px-sm py-[2px] text-caption text-text-secondary">
                          Güncellendi: {formatDateTime(selectedAsset.updated_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-sm p-md">
                    {userCanManage && (
                      <GlowButton
                        variant="ghost"
                        icon={<IconEdit size={16} aria-hidden={true} />}
                        onClick={() => openEditForm(selectedAsset)}
                      >
                        Düzenle
                      </GlowButton>
                    )}

                    <AuditHistoryLink
                      entityType="inventory.Asset"
                      entityId={selectedAsset.id}
                    />
                  </div>
                </div>
              </section>

              <DetailSection
                title="Kimlik"
                icon={<IconTag size={17} aria-hidden={true} />}
                tone="accent"
              >
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
                  <DetailRow label="Marka" value={selectedAsset.brand} />
                  <DetailRow label="Model" value={selectedAsset.model} />
                  <DetailRow
                    label="Satın alma tarihi"
                    value={formatDate(selectedAsset.purchase_date)}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Zimmet & Konum"
                icon={<IconMapPin size={17} aria-hidden={true} />}
                tone="warning"
              >
                <div className="grid gap-md sm:grid-cols-2">
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
                  <DetailRow label="Konum" value={selectedAsset.location} />
                  <DetailRow
                    label="Durum"
                    value={getOperationalStatusLabel(selectedAsset.status)}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Garanti & Bakım"
                icon={<IconCalendarDue size={17} aria-hidden={true} />}
                tone={
                  selectedAsset.is_warranty_expired ||
                  selectedAsset.is_maintenance_overdue
                    ? "danger"
                    : "success"
                }
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Garanti bitiş tarihi"
                    value={formatDate(selectedAsset.warranty_end_date)}
                  />
                  <DetailRow
                    label="Garanti riski"
                    value={
                      selectedAsset.is_warranty_expired
                        ? "Garanti süresi dolmuş"
                        : "Risk görünmüyor"
                    }
                  />
                  <DetailRow
                    label="Sonraki bakım tarihi"
                    value={formatDate(selectedAsset.next_maintenance_due_date)}
                  />
                  <DetailRow
                    label="Bakım riski"
                    value={
                      selectedAsset.is_maintenance_overdue
                        ? "Bakım gecikmiş"
                        : "Risk görünmüyor"
                    }
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Notlar"
                icon={<IconEdit size={17} aria-hidden={true} />}
                tone="accent"
              >
                <div className="rounded-2xl border border-border-subtle bg-surface-0/90 p-md text-body leading-7 text-text-secondary shadow-sm">
                  {selectedAsset.notes || "-"}
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
                    value={formatDateTime(selectedAsset.created_at)}
                  />
                  <DetailRow
                    label="Güncellenme tarihi"
                    value={formatDateTime(selectedAsset.updated_at)}
                  />
                </div>
              </DetailSection>
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
