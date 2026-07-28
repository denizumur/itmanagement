import {
  IconCalendarDue,
  IconClipboardList,
  IconDeviceDesktop,
  IconHistory,
  IconNotes,
  IconPlus,
  IconRefresh,
  IconRotateClockwise,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconX,
  IconUserCheck,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { AssignmentForm } from "../components/assignments/AssignmentForm";
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
  useActiveAssignments,
  useAssignmentSummary,
  useAssignmentsTable,
  useCreateAssignment,
  useReturnAssignment,
} from "../hooks/useAssignments";
import { useEmployees } from "../hooks/useEmployees";
import { useAssets } from "../hooks/useInventory";
import { useTableQueryState } from "../hooks/useTableQueryState";
import {
  buildActiveAssignmentMap,
  getAssignmentAssetCode,
  getAssignmentAssetName,
  getAssignmentDepartmentName,
  getAssignmentEmployeeName,
  getAssignmentJobTitleName,
} from "../lib/assignments";
import { cn } from "../lib/cn";
import { canManage } from "../lib/rbac";
import type {
  Assignment,
  AssignmentCreatePayload,
} from "../types/assignments";

type ToastState = {
  type: "success" | "error";
  message: string;
};

const activeFilterOptions = [
  { value: "", label: "Tüm zimmetler" },
  { value: "true", label: "Aktif zimmetler" },
  { value: "false", label: "İade edilmiş" },
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

function isAssignmentActive(assignment: Assignment) {
  if (typeof assignment.is_active === "boolean") {
    return assignment.is_active;
  }

  return !assignment.returned_at;
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
  tone?: "accent" | "warning";
}) {
  const initial = label.slice(0, 1).toLocaleUpperCase("tr-TR") || "?";
  const toneClasses =
    tone === "warning"
      ? "border-warning/25 bg-warning-bg text-warning"
      : "border-accent/25 bg-accent-bg text-accent";

  return (
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border text-body font-semibold shadow-sm",
        toneClasses
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
  tone?: "accent" | "success" | "warning";
}) {
  const toneClasses = {
    accent: "border-accent/25 bg-accent-bg/70 text-accent",
    success: "border-success/25 bg-success-bg/70 text-success",
    warning: "border-warning/25 bg-warning-bg/70 text-warning",
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
      <span className="text-text-primary">{formatDate(value)}</span>
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

function AssignmentStatusBadge({ assignment }: { assignment: Assignment }) {
  return isAssignmentActive(assignment) ? (
    <StatusBadge variant="accent">Aktif zimmet</StatusBadge>
  ) : (
    <StatusBadge variant="success">İade edilmiş</StatusBadge>
  );
}

function buildAssignmentColumns({
  userCanManage,
  isSubmitting,
  onReturnAssignment,
}: {
  userCanManage: boolean;
  isSubmitting: boolean;
  onReturnAssignment: (assignment: Assignment) => void;
}): DataTableColumn<Assignment>[] {
  return [
    {
      key: "asset",
      label: "Varlık",
      sortable: true,
      sortKey: "asset__name",
      render: (assignment) => {
        const assetName = getAssignmentAssetName(assignment);
        const assetCode = getAssignmentAssetCode(assignment) ?? "-";

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
      key: "employee",
      label: "Personel",
      sortable: true,
      sortKey: "employee__full_name",
      render: (assignment) => {
        const employeeName = getAssignmentEmployeeName(assignment);
        const departmentName = getAssignmentDepartmentName(assignment);
        const jobTitleName = getAssignmentJobTitleName(assignment);

        return (
          <div className="flex min-w-[220px] items-center gap-sm">
            <EntityAvatar
              label={employeeName}
              tone="warning"
              icon={<IconUserCheck size={15} aria-hidden={true} />}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-text-primary">
                {employeeName}
              </p>
              <p className="truncate text-caption text-text-secondary">
                {[departmentName, jobTitleName].filter(Boolean).join(" / ") ||
                  "-"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "department",
      label: "Birim",
      sortable: true,
      sortKey: "employee__department__name",
      render: (assignment) => {
        const departmentName = getAssignmentDepartmentName(assignment);
        const jobTitleName = getAssignmentJobTitleName(assignment);

        return (
          <div className="min-w-[170px] rounded-2xl border border-border-subtle bg-surface-0/80 px-sm py-xs shadow-sm">
            <p className="text-body font-medium text-text-primary">
              {departmentName ?? "-"}
            </p>
            {jobTitleName ? (
              <p className="text-caption text-text-secondary">{jobTitleName}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "timeline",
      label: "Tarihler",
      sortable: true,
      sortKey: "assigned_at",
      render: (assignment) => (
        <div className="flex min-w-[190px] flex-col gap-xs">
          <DateChip
            label="Zimmet"
            value={assignment.assigned_at}
            tone="warning"
          />
          <DateChip
            label="İade"
            value={assignment.returned_at}
            tone={isAssignmentActive(assignment) ? "accent" : "success"}
          />
        </div>
      ),
    },
    {
      key: "status",
      label: "Durum",
      render: (assignment) => (
        <div className="flex flex-col gap-xs">
          <AssignmentStatusBadge assignment={assignment} />
          {assignment.notes || assignment.return_notes ? (
            <span className="inline-flex items-center gap-xs rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-[11px] font-medium text-text-secondary shadow-sm">
              <IconNotes size={13} aria-hidden={true} />
              Not var
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      label: "İade",
      className: "text-right",
      render: (assignment) => (
        <div className="flex justify-end">
          {userCanManage && isAssignmentActive(assignment) ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onReturnAssignment(assignment)}
              className="inline-flex size-9 items-center justify-center rounded-xl border border-warning/30 bg-warning-bg text-warning shadow-sm transition hover:border-warning hover:bg-warning-bg focus:outline-none focus:ring-2 focus:ring-warning/25 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
              aria-label={`${getAssignmentAssetName(assignment)} zimmetini iade al`}
              title="İade al"
            >
              <IconRotateClockwise size={16} aria-hidden={true} />
            </button>
          ) : (
            <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-0 px-sm py-xs text-caption text-text-secondary shadow-sm">
              {isAssignmentActive(assignment)
                ? "Salt okunur"
                : "İade tamamlandı"}
            </span>
          )}
        </div>
      ),
    },
  ];
}

export function AssignmentsPage() {
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
    ordering: "-assigned_at",
  });

  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const assignmentsQuery = useAssignmentsTable(state);
  const summaryQuery = useAssignmentSummary();
  const activeAssignmentsQuery = useActiveAssignments();
  const assetsQuery = useAssets({});
  const employeesQuery = useEmployees();
  const createAssignmentMutation = useCreateAssignment();
  const returnAssignmentMutation = useReturnAssignment();

  const assignmentTableData = assignmentsQuery.data;
  const assignments = assignmentTableData?.results ?? [];
  const summary = summaryQuery.data;
  const activeAssignments = activeAssignmentsQuery.data ?? [];
  const assets = assetsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];

  const selectedActiveFilter =
    typeof state.filters.active === "string" ? state.filters.active : "";

  const activeAssignmentMap = useMemo(
    () => buildActiveAssignmentMap(activeAssignments),
    [activeAssignments]
  );

  const assignableAssets = useMemo(
    () =>
      assets.filter((asset) => {
        const status = String(asset.status ?? "").toLowerCase();

        if (activeAssignmentMap.has(asset.id)) {
          return false;
        }

        return status === "active" || status === "in_stock";
      }),
    [assets, activeAssignmentMap]
  );

  const isSubmitting =
    createAssignmentMutation.isPending || returnAssignmentMutation.isPending;

  const isInitialLoading =
    assignmentsQuery.isLoading ||
    summaryQuery.isLoading ||
    activeAssignmentsQuery.isLoading ||
    assetsQuery.isLoading ||
    employeesQuery.isLoading;

  const hasError =
    assignmentsQuery.isError ||
    summaryQuery.isError ||
    activeAssignmentsQuery.isError ||
    assetsQuery.isError ||
    employeesQuery.isError;

  function refetchAll() {
    assignmentsQuery.refetch();
    summaryQuery.refetch();
    activeAssignmentsQuery.refetch();
    assetsQuery.refetch();
    employeesQuery.refetch();
  }

  function closeCreatePanel() {
    if (isSubmitting) {
      return;
    }

    setIsCreatePanelOpen(false);
  }

  async function handleCreateAssignment(payload: AssignmentCreatePayload) {
    try {
      await createAssignmentMutation.mutateAsync(payload);

      setToast({
        type: "success",
        message: "Zimmet başarıyla oluşturuldu.",
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

  async function handleReturnAssignment(assignment: Assignment) {
    const confirmed = window.confirm(
      `${getAssignmentAssetName(assignment)} zimmetini iade almak istiyor musun?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const today = new Date().toISOString().slice(0, 10);

      await returnAssignmentMutation.mutateAsync({
        id: assignment.id,
        payload: {
          returned_at: today,
          return_date: today,
          return_notes: "Frontend üzerinden iade alındı.",
        },
      });

      setToast({
        type: "success",
        message: "Zimmet başarıyla iade alındı.",
      });

      if (selectedAssignment?.id === assignment.id) {
        setSelectedAssignment(null);
      }

      refetchAll();
    } catch (error) {
      setToast({
        type: "error",
        message: getMutationErrorMessage(error),
      });
    }
  }

  const assignmentColumns = useMemo(
    () =>
      buildAssignmentColumns({
        userCanManage,
        isSubmitting,
        onReturnAssignment: handleReturnAssignment,
      }),
    [userCanManage, isSubmitting, selectedAssignment]
  );

  const totalAssignments = assignmentTableData?.count ?? assignments.length;
  const activeAssignmentCount = summary?.active ?? activeAssignments.length;
  const returnedAssignmentCount = summary?.returned ?? 0;
  const last30Count = summary?.assigned_last_30_days ?? 0;
  const selectedActiveLabel =
    activeFilterOptions.find((option) => option.value === selectedActiveFilter)
      ?.label ?? "";
  const hasActiveFilters = Boolean(state.search || selectedActiveFilter);

  if (isInitialLoading) {
    return (
      <AppShell>
        <div className="flex flex-wrap gap-sm">
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-36 rounded-full" />
          <Skeleton className="h-14 w-40 rounded-full" />
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
        <ErrorState message="Zimmet verisi alınamadı. Assignment, varlık ve personel endpointlerini kontrol et." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          eyebrow="Zimmet Yönetimi"
          title="Zimmetler"
          description="Aktif ve iade edilmiş zimmetleri takip et, cihazı personele ata ve iade süreçlerini yönet."
          actions={
            <>
              <GlowButton
                variant="ghost"
                onClick={refetchAll}
                disabled={
                  assignmentsQuery.isFetching ||
                  summaryQuery.isFetching ||
                  activeAssignmentsQuery.isFetching ||
                  assetsQuery.isFetching ||
                  employeesQuery.isFetching ||
                  isSubmitting
                }
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                {assignmentsQuery.isFetching ||
                summaryQuery.isFetching ||
                activeAssignmentsQuery.isFetching ||
                assetsQuery.isFetching ||
                employeesQuery.isFetching
                  ? "Yenileniyor"
                  : "Veriyi yenile"}
              </GlowButton>

              {userCanManage && (
                <GlowButton
                  icon={<IconPlus size={16} aria-hidden={true} />}
                  onClick={() => setIsCreatePanelOpen(true)}
                  disabled={isSubmitting}
                >
                  Yeni Zimmet
                </GlowButton>
              )}
            </>
          }
        />

        <section className="mt-lg overflow-hidden rounded-panel border border-border-strong/60 bg-surface-1/75 shadow-panel backdrop-blur-sm">
          <div className="relative grid gap-md border-b border-border-subtle/80 p-md lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,var(--surface-1),transparent),radial-gradient(circle_at_0%_0%,var(--bg-warning),transparent_34%),radial-gradient(circle_at_88%_0%,var(--bg-accent),transparent_28%)] opacity-80" />

            <div className="relative min-w-0">
              <div className="flex flex-wrap items-center gap-sm">
                <span className="inline-flex items-center gap-xs rounded-full border border-warning/25 bg-warning-bg/70 px-sm py-xs text-caption font-semibold text-warning shadow-sm">
                  <IconSparkles size={14} aria-hidden={true} />
                  Ownership Operations Console
                </span>
                <span className="inline-flex items-center gap-xs rounded-full border border-border bg-surface-0/80 px-sm py-xs text-caption text-text-secondary shadow-sm">
                  Zimmet Operasyon Merkezi
                </span>
              </div>

              <p className="mt-sm max-w-3xl text-body leading-7 text-text-secondary">
                Aktif zimmetleri, iade süreçlerini ve cihaz sahipliğini tek
                ekrandan takip et; personel, varlık ve tarih sinyallerini hızlı
                tara.
              </p>
            </div>

            <div className="relative grid grid-cols-2 gap-xs sm:grid-cols-4 lg:min-w-[520px]">
              <MiniMetricCard
                label="Toplam"
                value={totalAssignments}
                icon={<IconClipboardList size={14} aria-hidden={true} />}
                tone="accent"
              />
              <MiniMetricCard
                label="Aktif"
                value={activeAssignmentCount}
                icon={<IconShieldCheck size={14} aria-hidden={true} />}
                tone="success"
              />
              <MiniMetricCard
                label="İade"
                value={returnedAssignmentCount}
                icon={<IconRotateClockwise size={14} aria-hidden={true} />}
                tone="warning"
              />
              <MiniMetricCard
                label="Son 30 gün"
                value={last30Count}
                icon={<IconCalendarDue size={14} aria-hidden={true} />}
                tone="danger"
              />
            </div>
          </div>

          <div className="grid gap-sm p-md lg:grid-cols-[1fr_210px_auto]">
            <label className="flex min-h-10 items-center gap-sm rounded-xl border border-warning/25 bg-surface-0/85 px-md py-xs shadow-sm transition focus-within:border-warning focus-within:ring-2 focus-within:ring-warning/20 motion-reduce:transition-none">
              <IconSearch
                size={18}
                className="text-warning"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="Varlık, envanter kodu, personel veya departman ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="min-h-10 rounded-xl border border-border bg-surface-0/85 px-sm py-xs text-body text-text-primary shadow-sm outline-none transition focus:border-warning focus:ring-2 focus:ring-warning/20 motion-reduce:transition-none"
              value={selectedActiveFilter}
              onChange={(event) => setFilter("active", event.target.value || null)}
              aria-label="Zimmet durumu filtresi"
            >
              {activeFilterOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-surface-0/85 px-md py-xs text-body font-medium text-text-primary shadow-sm transition hover:border-warning hover:bg-warning-bg hover:text-warning focus:outline-none focus:ring-2 focus:ring-warning/25 motion-reduce:transition-none"
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

              {selectedActiveFilter ? (
                <FilterChip
                  label="Durum"
                  value={selectedActiveLabel}
                  onRemove={() => setFilter("active", null)}
                />
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="mt-lg flex flex-col gap-md">
          <DataTable
            columns={assignmentColumns}
            data={assignments}
            getRowKey={(assignment) => assignment.id}
            ordering={state.ordering}
            onSortChange={setSort}
            isLoading={assignmentsQuery.isLoading}
            emptyMessage="Zimmet kaydı bulunamadı."
            onViewDetails={setSelectedAssignment}
            viewDetailsLabel="Zimmet detayını gör"
            getRowClassName={(assignment) =>
              selectedAssignment?.id === assignment.id ? "bg-surface-2" : ""
            }
          />

          <TablePagination
            page={state.page}
            pageSize={state.pageSize}
            totalCount={assignmentTableData?.count ?? 0}
            hasNext={Boolean(assignmentTableData?.next)}
            hasPrevious={Boolean(assignmentTableData?.previous)}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </section>

        <SlideOverPanel
          open={isCreatePanelOpen}
          title="Yeni Zimmet"
          description="Bir varlığı personele zimmetle. Zimmetlenmiş varlıklar tekrar seçilemez."
          onClose={closeCreatePanel}
        >
          <AssignmentForm
            assets={assignableAssets}
            employees={employees}
            isSubmitting={createAssignmentMutation.isPending}
            onCancel={closeCreatePanel}
            onSubmit={handleCreateAssignment}
          />
        </SlideOverPanel>

        <SlideOverPanel
          open={Boolean(selectedAssignment)}
          title={
            selectedAssignment
              ? getAssignmentAssetName(selectedAssignment)
              : "Zimmet detayı"
          }
          description={
            selectedAssignment
              ? getAssignmentEmployeeName(selectedAssignment)
              : undefined
          }
          onClose={() => setSelectedAssignment(null)}
        >
          {selectedAssignment ? (
            <div className="space-y-md">
              <section className="overflow-hidden rounded-panel border border-warning/20 bg-surface-0 shadow-panel">
                <div className="h-1 bg-warning" />
                <div className="flex flex-wrap items-center justify-between gap-md">
                  <div className="flex min-w-0 items-center gap-md p-md">
                    <EntityAvatar
                      label={getAssignmentAssetName(selectedAssignment)}
                      icon={<IconDeviceDesktop size={15} aria-hidden={true} />}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-sm">
                        <h3 className="truncate text-lg font-semibold text-text-primary">
                          {getAssignmentAssetName(selectedAssignment)}
                        </h3>
                        <AssignmentStatusBadge assignment={selectedAssignment} />
                      </div>
                      <div className="mt-xs flex flex-wrap gap-xs">
                        <span className="rounded-full border border-border-subtle bg-surface-1 px-sm py-[2px] text-caption font-medium text-text-secondary">
                          {getAssignmentAssetCode(selectedAssignment) ?? "-"}
                        </span>
                        <span className="rounded-full border border-warning/20 bg-warning-bg px-sm py-[2px] text-caption font-medium text-warning">
                          {getAssignmentEmployeeName(selectedAssignment)}
                        </span>
                        <span className="rounded-full border border-border-subtle bg-surface-1 px-sm py-[2px] text-caption text-text-secondary">
                          Zimmet: {formatDate(selectedAssignment.assigned_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-sm p-md">
                    {userCanManage && isAssignmentActive(selectedAssignment) ? (
                      <GlowButton
                        variant="ghost"
                        disabled={isSubmitting}
                        onClick={() => handleReturnAssignment(selectedAssignment)}
                        icon={
                          <IconRotateClockwise size={16} aria-hidden={true} />
                        }
                      >
                        İade al
                      </GlowButton>
                    ) : null}
                  </div>
                </div>
              </section>

              <DetailSection
                title="Zimmet Bilgisi"
                icon={<IconClipboardList size={17} aria-hidden={true} />}
                tone="warning"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Durum"
                    value={<AssignmentStatusBadge assignment={selectedAssignment} />}
                  />
                  <DetailRow
                    label="Zimmet kaydı"
                    value={`#${selectedAssignment.id}`}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Personel"
                icon={<IconUserCheck size={17} aria-hidden={true} />}
                tone="warning"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Personel"
                    value={getAssignmentEmployeeName(selectedAssignment)}
                  />
                  <DetailRow
                    label="Departman"
                    value={getAssignmentDepartmentName(selectedAssignment) ?? "-"}
                  />
                  <DetailRow
                    label="Görev"
                    value={getAssignmentJobTitleName(selectedAssignment) ?? "-"}
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
                    value={getAssignmentAssetName(selectedAssignment)}
                  />
                  <DetailRow
                    label="Envanter kodu"
                    value={getAssignmentAssetCode(selectedAssignment) ?? "-"}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Tarihler"
                icon={<IconCalendarDue size={17} aria-hidden={true} />}
                tone={isAssignmentActive(selectedAssignment) ? "accent" : "success"}
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Zimmet tarihi"
                    value={formatDate(selectedAssignment.assigned_at)}
                  />
                  <DetailRow
                    label="İade tarihi"
                    value={formatDate(selectedAssignment.returned_at)}
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
                    label="Zimmet notu"
                    value={selectedAssignment.notes ?? "-"}
                  />
                  <DetailRow
                    label="İade notu"
                    value={selectedAssignment.return_notes ?? "-"}
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
                    value={formatDateTime(selectedAssignment.created_at)}
                  />
                  <DetailRow
                    label="Güncellenme tarihi"
                    value={formatDateTime(selectedAssignment.updated_at)}
                  />
                </div>
              </DetailSection>
            </div>
          ) : null}
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
