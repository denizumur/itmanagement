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
  useActiveAssignments,
  useAssignments,
  useCreateAssignment,
  useReturnAssignment,
} from "../hooks/useAssignments";
import { useAssets } from "../hooks/useInventory";
import { useEmployees } from "../hooks/useEmployees";
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

export function AssignmentsPage() {
  const { user } = useAuth();
  const userCanManage = canManage(user?.role);

  const [search, setSearch] = useState("");
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const assignmentsQuery = useAssignments();
  const activeAssignmentsQuery = useActiveAssignments();
  const assetsQuery = useAssets({});
  const employeesQuery = useEmployees();
  const createAssignmentMutation = useCreateAssignment();
  const returnAssignmentMutation = useReturnAssignment();

  const assignments = assignmentsQuery.data ?? [];
  const activeAssignments = activeAssignmentsQuery.data ?? [];
  const assets = assetsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];

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

  const filteredActiveAssignments = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("tr-TR");

    if (!normalizedSearch) {
      return activeAssignments;
    }

    return activeAssignments.filter((assignment) => {
      const values = [
        getAssignmentAssetName(assignment),
        getAssignmentAssetCode(assignment),
        getAssignmentEmployeeName(assignment),
        getAssignmentDepartmentName(assignment),
        getAssignmentJobTitleName(assignment),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return values.includes(normalizedSearch);
    });
  }, [activeAssignments, search]);

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
    activeAssignmentsQuery.isLoading ||
    assetsQuery.isLoading ||
    employeesQuery.isLoading;

  const hasError =
    assignmentsQuery.isError ||
    activeAssignmentsQuery.isError ||
    assetsQuery.isError ||
    employeesQuery.isError;

  function refetchAll() {
    assignmentsQuery.refetch();
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
          description="Aktif zimmetleri takip et, cihazı personele ata ve iade süreçlerini yönet."
          actions={
            <>
              <GlowButton
                variant="ghost"
                onClick={refetchAll}
                disabled={
                  assignmentsQuery.isFetching ||
                  activeAssignmentsQuery.isFetching ||
                  isSubmitting
                }
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                {assignmentsQuery.isFetching || activeAssignmentsQuery.isFetching
                  ? "Yenileniyor"
                  : "Veriyi yenile"}
              </GlowButton>

              {userCanManage && (
                <GlowButton
                  icon={<IconPlus size={16} aria-hidden={true} />}
                  onClick={() => setIsCreatePanelOpen(true)}
                >
                  Yeni Zimmet
                </GlowButton>
              )}
            </>
          }
        />

        <section className="grid gap-md md:grid-cols-2 xl:grid-cols-4">
          <DataCard className="metric-card-accent p-lg">
            <IconClipboardList size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {activeAssignments.length}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Aktif zimmet
            </p>
          </DataCard>

          <DataCard className="metric-card-success p-lg">
            <IconUserCheck size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {uniqueEmployeeCount}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Zimmetli personel
            </p>
          </DataCard>

          <DataCard className="metric-card-warning p-lg">
            <IconDeviceDesktopFallback />
            <p className="mt-md text-[30px] font-medium leading-none">
              {assignableAssets.length}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Zimmetlenebilir varlık
            </p>
          </DataCard>

          <DataCard className="metric-card-danger p-lg">
            <IconRotateClockwise size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {assignments.length}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Toplam zimmet kaydı
            </p>
          </DataCard>
        </section>

        <DataCard className="mt-lg p-lg">
          <label className="flex items-center gap-sm rounded-app border border-border bg-surface-1 px-md py-sm shadow-panel">
            <IconSearch
              size={18}
              className="text-text-secondary"
              aria-hidden={true}
            />

            <input
              className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
              placeholder="Varlık, envanter kodu, personel veya departman ara..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </DataCard>

        <section className="mt-lg">
          <DataTable
            title="Aktif zimmet listesi"
            description={`${filteredActiveAssignments.length} aktif kayıt görüntüleniyor.`}
          >
            {!filteredActiveAssignments.length ? (
              <div className="rounded-app border border-border bg-surface-1 p-lg text-center text-text-secondary">
                Aktif zimmet kaydı bulunamadı.
              </div>
            ) : (
              <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left text-body">
                <thead>
                  <tr className="text-caption text-text-secondary">
                    <th className="border-b border-border px-md py-sm font-normal">
                      Varlık
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Personel
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Departman / Görev
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Zimmet Tarihi
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
                  {filteredActiveAssignments.map((assignment) => {
                    const departmentName =
                      getAssignmentDepartmentName(assignment);
                    const jobTitleName = getAssignmentJobTitleName(assignment);

                    return (
                      <tr
                        key={assignment.id}
                        className="transition hover:bg-surface-1"
                      >
                        <td className="border-b border-border px-md py-md">
                          <p className="text-text-primary">
                            {getAssignmentAssetName(assignment)}
                          </p>
                          <p className="text-caption text-text-secondary">
                            {getAssignmentAssetCode(assignment) ?? "-"}
                          </p>
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <p className="text-text-primary">
                            {getAssignmentEmployeeName(assignment)}
                          </p>
                        </td>

                        <td className="border-b border-border px-md py-md text-text-secondary">
                          <p>{departmentName ?? "-"}</p>
                          {jobTitleName && (
                            <p className="text-caption">{jobTitleName}</p>
                          )}
                        </td>

                        <td className="border-b border-border px-md py-md text-text-secondary">
                          {formatDate(assignment.assigned_at)}
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <StatusBadge variant="accent">Aktif zimmet</StatusBadge>
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <div className="flex justify-end gap-sm">
                            {userCanManage ? (
                              <GlowButton
                                variant="ghost"
                                disabled={isSubmitting}
                                onClick={() => handleReturnAssignment(assignment)}
                                icon={
                                  <IconRotateClockwise
                                    size={16}
                                    aria-hidden={true}
                                  />
                                }
                              >
                                İade al
                              </GlowButton>
                            ) : (
                              <span className="text-caption text-text-secondary">
                                Sadece görüntüleme
                              </span>
                            )}
                          </div>
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

function IconDeviceDesktopFallback() {
  return <IconClipboardList size={22} aria-hidden={true} />;
}