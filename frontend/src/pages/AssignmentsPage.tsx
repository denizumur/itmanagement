import {
  IconClipboardList,
  IconPlus,
  IconRefresh,
  IconRotateClockwise,
  IconSearch,
  IconUserCheck,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
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
      render: (assignment) => (
        <div>
          <p className="text-text-primary">
            {getAssignmentAssetName(assignment)}
          </p>
          <p className="text-caption text-text-secondary">
            {getAssignmentAssetCode(assignment) ?? "-"}
          </p>
        </div>
      ),
    },
    {
      key: "employee",
      label: "Personel",
      sortable: true,
      sortKey: "employee__full_name",
      render: (assignment) => (
        <p className="text-text-primary">
          {getAssignmentEmployeeName(assignment)}
        </p>
      ),
    },
    {
      key: "department",
      label: "Departman / Görev",
      sortable: true,
      sortKey: "employee__department__name",
      render: (assignment) => {
        const departmentName = getAssignmentDepartmentName(assignment);
        const jobTitleName = getAssignmentJobTitleName(assignment);

        return (
          <div className="text-text-secondary">
            <p>{departmentName ?? "-"}</p>
            {jobTitleName ? <p className="text-caption">{jobTitleName}</p> : null}
          </div>
        );
      },
    },
    {
      key: "assigned_at",
      label: "Zimmet Tarihi",
      sortable: true,
      sortKey: "assigned_at",
      render: (assignment) => formatDate(assignment.assigned_at),
    },
    {
      key: "returned_at",
      label: "İade Tarihi",
      sortable: true,
      sortKey: "returned_at",
      render: (assignment) => formatDate(assignment.returned_at),
    },
    {
      key: "status",
      label: "Durum",
      render: (assignment) =>
        isAssignmentActive(assignment) ? (
          <StatusBadge variant="accent">Aktif zimmet</StatusBadge>
        ) : (
          <StatusBadge variant="success">İade edilmiş</StatusBadge>
        ),
    },
    {
      key: "actions",
      label: "İşlem",
      className: "text-right",
      render: (assignment) => (
        <div className="flex justify-end gap-sm">
          {userCanManage && isAssignmentActive(assignment) ? (
            <GlowButton
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => onReturnAssignment(assignment)}
              icon={<IconRotateClockwise size={16} aria-hidden={true} />}
            >
              İade al
            </GlowButton>
          ) : (
            <span className="text-caption text-text-secondary">
              {isAssignmentActive(assignment)
                ? "Sadece görüntüleme"
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

  const uniqueEmployeeCount = useMemo(() => {
    const names = new Set(
      activeAssignments.map((assignment) => getAssignmentEmployeeName(assignment))
    );

    return names.size;
  }, [activeAssignments]);

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
    [userCanManage, isSubmitting]
  );

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

        <section className="mt-lg flex flex-wrap gap-sm">
          <MiniMetricCard
            label="Gösterilen kayıt"
            value={assignmentTableData?.count ?? assignments.length}
            icon={<IconClipboardList size={15} aria-hidden={true} />}
            tone="accent"
          />

          <MiniMetricCard
            label="Aktif zimmet"
            value={summary?.active ?? activeAssignments.length}
            icon={<IconClipboardList size={15} aria-hidden={true} />}
            tone="success"
          />

          <MiniMetricCard
            label="İade edilmiş"
            value={summary?.returned ?? 0}
            icon={<IconRotateClockwise size={15} aria-hidden={true} />}
            tone="warning"
          />

          <MiniMetricCard
            label="Zimmetli personel"
            value={uniqueEmployeeCount}
            icon={<IconUserCheck size={15} aria-hidden={true} />}
            tone="success"
          />

          <MiniMetricCard
            label="Zimmetlenebilir varlık"
            value={assignableAssets.length}
            icon={<IconClipboardList size={15} aria-hidden={true} />}
          />
        </section>

        <section className="mt-lg rounded-panel border border-border bg-surface-1 p-md shadow-panel">
          <div className="grid gap-md lg:grid-cols-[1fr_220px_auto]">
            <label className="flex items-center gap-sm rounded-app border border-border bg-surface-2 px-md py-sm shadow-panel">
              <IconSearch
                size={18}
                className="text-text-secondary"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                placeholder="Varlık, envanter kodu, personel veya departman ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
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
              className="inline-flex items-center justify-center rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
            >
              Temizle
            </button>
          </div>
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