import {
  IconFilter,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconUserCancel,
  IconUserCheck,
  IconUserCircle,
  IconUserPlus,
  IconUserX,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { createUserInvitation, revokeUserInvitation } from "../api/accounts";
import { useAuth } from "../auth/AuthContext";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { ErrorState } from "../components/common/ErrorState";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { Skeleton } from "../components/common/Skeleton";
import { TablePagination } from "../components/common/TablePagination";
import { AppShell } from "../components/layout/AppShell";
import { GlowButton } from "../components/ui/GlowButton";
import { PageHeader } from "../components/ui/PageHeader";
import { PageTransition } from "../components/ui/PageTransition";
import { SlideOverPanel } from "../components/ui/SlideOverPanel";
import {
  useChangeAdminUserRole,
  useAdminUserDetail,
  useAdminUsersTable,
  useDeactivateAdminUser,
  useReactivateAdminUser,
} from "../hooks/useAdminUsers";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { cn } from "../lib/cn";
import type { AdminUserDetail, AdminUserListItem } from "../types/adminUsers";
import type { UserRole } from "../types/auth";

type AdminUserActionKind =
  | "deactivate"
  | "reactivate"
  | "change-role"
  | "create-invitation"
  | "revoke-invitation";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function roleLabel(role?: string | null) {
  const labels: Record<string, string> = {
    admin: "Admin",
    technician: "Technician",
    viewer: "Viewer",
    requester: "Requester",
    approver: "Approver",
  };

  return role ? labels[role] ?? role : "Rol yok";
}

function activationLabel(state?: string | null) {
  const labels: Record<string, string> = {
    active: "Aktif",
    inactive: "Pasif",
    needs_activation: "Aktivasyon bekliyor",
    pending_invitation: "Davet bekliyor",
    expired_invitation: "Davet süresi doldu",
    no_employee: "Personel bağlı değil",
  };

  return state ? labels[state] ?? state : "-";
}

function toneForActivation(state?: string | null) {
  if (state === "active") {
    return "success";
  }
  if (state === "expired_invitation" || state === "needs_activation") {
    return "warning";
  }
  if (state === "no_employee") {
    return "danger";
  }
  return "accent";
}

function StatusPill({
  children,
  tone = "accent",
}: {
  children: string;
  tone?: "accent" | "success" | "warning" | "danger" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-sm py-xs text-[11px] font-semibold",
        tone === "accent" && "border-accent/20 bg-accent-bg text-accent",
        tone === "success" && "border-success/25 bg-success-bg text-success",
        tone === "warning" && "border-warning/25 bg-warning-bg text-warning",
        tone === "danger" && "border-danger/25 bg-danger-bg text-danger",
        tone === "neutral" && "border-border bg-surface-2 text-text-secondary"
      )}
    >
      {children}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-0/80 p-sm">
      <p className="text-caption text-text-secondary">{label}</p>
      <div className="mt-xs break-words text-body font-semibold text-text-primary">
        {value ?? "-"}
      </div>
    </div>
  );
}

const ACTION_LABELS: Record<AdminUserActionKind, string> = {
  deactivate: "Pasifleştir",
  reactivate: "Yeniden aktifleştir",
  "change-role": "Rol değiştir",
  "create-invitation": "Davet oluştur",
  "revoke-invitation": "Daveti iptal et",
};

const USER_ROLES: UserRole[] = [
  "admin",
  "technician",
  "viewer",
  "approver",
  "requester",
];

function expectedConfirmation(action: AdminUserActionKind, username: string) {
  if (action === "deactivate") {
    return `DEACTIVATE ${username}`;
  }
  if (action === "reactivate") {
    return `REACTIVATE ${username}`;
  }
  if (action === "change-role") {
    return `CHANGE ROLE ${username}`;
  }
  if (action === "create-invitation") {
    return `CREATE INVITATION ${username}`;
  }
  return `REVOKE INVITATION ${username}`;
}

function actionHelpText(action: AdminUserActionKind, user: AdminUserDetail) {
  if (action === "deactivate") {
    return `${user.username} hesabı pasif yapılır; rol, personel bağlantısı ve bekleyen davetler korunur.`;
  }
  if (action === "reactivate") {
    return `${user.username} hesabı yeniden aktif yapılır. Kullanılabilir kimlik bilgisi yoksa backend işlemi reddeder.`;
  }
  if (action === "change-role") {
    return `${user.username} için sadece rol güncellenir; aktiflik, personel bağlantısı ve kimlik bilgisi değişmez.`;
  }
  if (action === "create-invitation") {
    return `${user.username} için yeni aktivasyon daveti oluşturulur. Link sadece bu işlemden sonra geçici olarak gösterilir.`;
  }
  return `${user.username} için son bekleyen davet iptal edilir. Kullanıcı hesabı veya rolü değişmez.`;
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const {
    state,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setFilter,
    resetFilters,
  } = useTableQueryState({ pageSize: 25, ordering: "username" });
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [actionKind, setActionKind] = useState<AdminUserActionKind | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionConfirmation, setActionConfirmation] = useState("");
  const [actionRole, setActionRole] = useState<UserRole>("viewer");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  const [isInvitationSubmitting, setIsInvitationSubmitting] = useState(false);
  const { data, isLoading, isError, refetch, isFetching } =
    useAdminUsersTable(state);
  const {
    data: detail,
    isLoading: isDetailLoading,
    refetch: refetchDetail,
  } = useAdminUserDetail(selectedUser?.id);
  const deactivateMutation = useDeactivateAdminUser();
  const reactivateMutation = useReactivateAdminUser();
  const changeRoleMutation = useChangeAdminUserRole();
  const isActionSubmitting =
    deactivateMutation.isPending ||
    reactivateMutation.isPending ||
    changeRoleMutation.isPending ||
    isInvitationSubmitting;

  const rows = data?.results ?? [];
  const metrics = useMemo(() => {
    return {
      total: data?.count ?? 0,
      active: rows.filter((user) => user.is_active).length,
      activationNeeded: rows.filter((user) => user.activation.needs_invitation)
        .length,
      withoutEmployee: rows.filter((user) => !user.employee).length,
      pendingInvitations: rows.reduce(
        (sum, user) => sum + user.activation.pending_invitation_count,
        0
      ),
      expiredInvitations: rows.reduce(
        (sum, user) => sum + user.activation.expired_invitation_count,
        0
      ),
    };
  }, [data?.count, rows]);

  function openAction(action: AdminUserActionKind, user: AdminUserDetail) {
    setActionKind(action);
    setActionReason("");
    setActionConfirmation("");
    setActionRole((user.role as UserRole | null) ?? "viewer");
    setActionError("");
    setActionSuccess("");
    setActivationUrl("");
  }

  function closeAction() {
    setActionKind(null);
    setActionReason("");
    setActionConfirmation("");
    setActionError("");
  }

  async function refreshUsers() {
    await Promise.all([refetch(), refetchDetail()]);
  }

  function getActionError(error: unknown) {
    const maybeError = error as { response?: { data?: { detail?: string } } };
    return maybeError.response?.data?.detail ?? "İşlem tamamlanamadı.";
  }

  async function submitAction() {
    if (!detail || !actionKind) {
      return;
    }

    setActionError("");
    setActionSuccess("");
    setActivationUrl("");

    try {
      if (actionKind === "deactivate") {
        await deactivateMutation.mutateAsync({
          userId: detail.id,
          payload: {
            reason: actionReason,
            confirmation: actionConfirmation,
          },
        });
      } else if (actionKind === "reactivate") {
        await reactivateMutation.mutateAsync({
          userId: detail.id,
          payload: {
            reason: actionReason,
            confirmation: actionConfirmation,
          },
        });
      } else if (actionKind === "change-role") {
        await changeRoleMutation.mutateAsync({
          userId: detail.id,
          payload: {
            role: actionRole,
            reason: actionReason,
            confirmation: actionConfirmation,
          },
        });
      } else if (actionKind === "create-invitation") {
        setIsInvitationSubmitting(true);
        const response = await createUserInvitation(detail.id);
        setActivationUrl(response.activation_url);
      } else if (
        actionKind === "revoke-invitation" &&
        detail.activation.latest_invitation_id
      ) {
        setIsInvitationSubmitting(true);
        await revokeUserInvitation(detail.activation.latest_invitation_id);
      }

      await refreshUsers();
      setActionSuccess("İşlem başarıyla tamamlandı.");
      if (actionKind !== "create-invitation") {
        closeAction();
      }
    } catch (error) {
      setActionError(getActionError(error));
    } finally {
      setIsInvitationSubmitting(false);
    }
  }

  const columns: DataTableColumn<AdminUserListItem>[] = [
    {
      key: "user",
      label: "Kullanıcı",
      sortable: true,
      sortKey: "username",
      render: (user) => (
        <div className="flex min-w-[220px] items-center gap-sm">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent-bg text-caption font-semibold text-accent">
            {user.username.slice(0, 2).toLocaleUpperCase("tr-TR")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-body font-semibold text-text-primary">
              {user.username}
            </p>
            <p className="truncate text-caption text-text-secondary">
              {user.display_name}
              {user.masked_email ? ` · ${user.masked_email}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Rol",
      sortable: true,
      sortKey: "role",
      render: (user) => <StatusPill tone="neutral">{roleLabel(user.role)}</StatusPill>,
    },
    {
      key: "status",
      label: "Durum",
      sortable: true,
      sortKey: "is_active",
      render: (user) => (
        <div className="flex flex-col gap-xs">
          <StatusPill tone={user.is_active ? "success" : "warning"}>
            {user.is_active ? "Aktif" : "Pasif"}
          </StatusPill>
          <span className="text-caption text-text-secondary">
            {user.has_usable_credential ? "Kimlik bilgisi hazır" : "Aktivasyon bekliyor"}
          </span>
        </div>
      ),
    },
    {
      key: "activation",
      label: "Aktivasyon",
      render: (user) => (
        <div className="flex flex-col gap-xs">
          <StatusPill tone={toneForActivation(user.activation.state)}>
            {activationLabel(user.activation.state)}
          </StatusPill>
          <span className="text-caption text-text-secondary">
            Bekleyen {user.activation.pending_invitation_count} · Süresi dolan{" "}
            {user.activation.expired_invitation_count}
          </span>
        </div>
      ),
    },
    {
      key: "employee",
      label: "Personel bağlantısı",
      sortable: true,
      sortKey: "employee_name",
      render: (user) =>
        user.employee ? (
          <div className="min-w-[220px]">
            <p className="truncate text-body font-semibold text-text-primary">
              {user.employee.full_name}
            </p>
            <p className="truncate text-caption text-text-secondary">
              {[user.employee.department_name, user.employee.job_title_name]
                .filter(Boolean)
                .join(" · ") || "Organizasyon bilgisi yok"}
            </p>
          </div>
        ) : (
          <StatusPill tone="danger">Bağlı değil</StatusPill>
        ),
    },
    {
      key: "last_login",
      label: "Son giriş",
      sortable: true,
      sortKey: "last_login",
      render: (user) => formatDateTime(user.last_login),
    },
  ];

  if (isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-36" />
        <Skeleton className="mt-lg h-96" />
      </AppShell>
    );
  }

  if (isError || !data) {
    return (
      <AppShell>
        <ErrorState message="Kullanıcı yönetimi verisi alınamadı." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <div data-testid="admin-users-page">
          <PageHeader
            title="Kullanıcı & Personel Yönetimi"
            description="Kullanıcı hesaplarını, personel bağlantılarını ve aktivasyon durumlarını güvenli şekilde izleyin."
            actions={
              <GlowButton
                variant="ghost"
                onClick={() => refetch()}
                disabled={isFetching}
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                {isFetching ? "Yenileniyor" : "Yenile"}
              </GlowButton>
            }
          />

          <section className="mt-lg grid gap-sm md:grid-cols-3 xl:grid-cols-6">
            <MiniMetricCard label="Toplam kullanıcı" value={metrics.total} icon={<IconUsers size={16} aria-hidden={true} />} />
            <MiniMetricCard label="Aktif" value={metrics.active} tone="success" icon={<IconUserCheck size={16} aria-hidden={true} />} />
            <MiniMetricCard label="Aktivasyon bekleyen" value={metrics.activationNeeded} tone="warning" icon={<IconShieldCheck size={16} aria-hidden={true} />} />
            <MiniMetricCard label="Personelsiz" value={metrics.withoutEmployee} tone="danger" icon={<IconUserCircle size={16} aria-hidden={true} />} />
            <MiniMetricCard label="Bekleyen davet" value={metrics.pendingInvitations} tone="accent" />
            <MiniMetricCard label="Süresi dolan" value={metrics.expiredInvitations} tone={metrics.expiredInvitations ? "warning" : "success"} />
          </section>

          <section className="mt-lg rounded-panel border border-border bg-surface-1/85 p-md shadow-panel">
            <div className="mb-md flex items-center gap-sm text-caption font-semibold uppercase text-text-muted">
              <IconFilter size={15} aria-hidden={true} />
              Filtreler
            </div>
            <div className="grid gap-sm lg:grid-cols-[1.4fr_repeat(5,1fr)_auto]">
              <label className="relative">
                <IconSearch
                  size={16}
                  className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-text-muted"
                  aria-hidden={true}
                />
                <input
                  data-testid="admin-users-search"
                  value={state.search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Kullanıcı veya personel ara"
                  className="h-10 w-full rounded-xl border border-border bg-surface-2 pl-9 pr-sm text-body text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
                />
              </label>
              <select
                data-testid="admin-users-role-filter"
                value={(state.filters.role as string) ?? ""}
                onChange={(event) => setFilter("role", event.target.value)}
                className="h-10 rounded-xl border border-border bg-surface-2 px-sm text-body text-text-primary outline-none"
              >
                <option value="">Tüm roller</option>
                <option value="admin">Admin</option>
                <option value="technician">Technician</option>
                <option value="viewer">Viewer</option>
                <option value="requester">Requester</option>
                <option value="approver">Approver</option>
              </select>
              <select
                value={(state.filters.is_active as string) ?? ""}
                onChange={(event) => setFilter("is_active", event.target.value)}
                className="h-10 rounded-xl border border-border bg-surface-2 px-sm text-body text-text-primary outline-none"
              >
                <option value="">Tüm durumlar</option>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </select>
              <select
                data-testid="admin-users-activation-filter"
                value={(state.filters.activation_state as string) ?? ""}
                onChange={(event) =>
                  setFilter("activation_state", event.target.value)
                }
                className="h-10 rounded-xl border border-border bg-surface-2 px-sm text-body text-text-primary outline-none"
              >
                <option value="">Tüm aktivasyon</option>
                <option value="active">Aktif</option>
                <option value="needs_activation">Aktivasyon bekleyen</option>
                <option value="pending_invitation">Bekleyen davet</option>
                <option value="expired_invitation">Süresi dolan davet</option>
                <option value="no_employee">Personel yok</option>
              </select>
              <select
                value={(state.filters.has_employee as string) ?? ""}
                onChange={(event) => setFilter("has_employee", event.target.value)}
                className="h-10 rounded-xl border border-border bg-surface-2 px-sm text-body text-text-primary outline-none"
              >
                <option value="">Tüm bağlantılar</option>
                <option value="true">Personel bağlı</option>
                <option value="false">Personel yok</option>
              </select>
              <select
                value={(state.filters.invitation_status as string) ?? ""}
                onChange={(event) =>
                  setFilter("invitation_status", event.target.value)
                }
                className="h-10 rounded-xl border border-border bg-surface-2 px-sm text-body text-text-primary outline-none"
              >
                <option value="">Tüm davetler</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="revoked">Revoked</option>
                <option value="expired">Expired</option>
                <option value="none">Davet yok</option>
              </select>
              <button
                type="button"
                data-testid="admin-users-reset-filters"
                onClick={resetFilters}
                className="inline-flex h-10 items-center justify-center gap-xs rounded-xl border border-border bg-surface-2 px-sm text-body font-semibold text-text-secondary transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
              >
                <IconX size={16} aria-hidden={true} />
                Sıfırla
              </button>
            </div>
          </section>

          <section className="mt-lg" data-testid="admin-users-table">
            <DataTable
              columns={columns}
              data={rows}
              getRowKey={(user) => user.id}
              ordering={state.ordering}
              onSortChange={setSort}
              onViewDetails={setSelectedUser}
              viewDetailsLabel="Kullanıcı detayını gör"
              emptyMessage="Bu filtrelerle kullanıcı bulunamadı."
              getRowClassName={() => "[&_*]:data-[row-marker]:block"}
            />
          </section>
          <div className="sr-only">
            {rows.map((user) => (
              <span key={user.id} data-testid="admin-users-row">
                {user.username}
              </span>
            ))}
          </div>

          <div className="mt-md">
            <TablePagination
              page={state.page}
              pageSize={state.pageSize}
              totalCount={data.count}
              hasNext={Boolean(data.next)}
              hasPrevious={Boolean(data.previous)}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>

          <SlideOverPanel
            open={Boolean(selectedUser)}
            title={selectedUser?.username ?? "Kullanıcı detayı"}
            description="Kullanıcı, personel, aktivasyon ve güvenli aksiyon dossier."
            onClose={() => {
              setSelectedUser(null);
              closeAction();
            }}
          >
            <div data-testid="admin-users-detail-drawer">
              {isDetailLoading || !detail ? (
                <Skeleton className="h-64" />
              ) : (
                <div className="space-y-md">
                  <section className="grid gap-sm sm:grid-cols-2">
                    <DetailRow label="Kullanıcı" value={detail.username} />
                    <DetailRow label="Görünen ad" value={detail.display_name} />
                    <DetailRow label="Rol" value={roleLabel(detail.role)} />
                    <DetailRow label="Durum" value={detail.is_active ? "Aktif" : "Pasif"} />
                    <DetailRow label="Son giriş" value={formatDateTime(detail.last_login)} />
                    <DetailRow label="Audit 30g" value={detail.audit.audit_logs_30d} />
                  </section>

                  <section className="rounded-panel border border-border bg-surface-2 p-md">
                    <h3 className="text-body font-semibold text-text-primary">
                      Personel bağlantısı
                    </h3>
                    {detail.employee ? (
                      <div className="mt-sm grid gap-sm sm:grid-cols-2">
                        <DetailRow label="Personel" value={detail.employee.full_name} />
                        <DetailRow label="Kod" value={detail.employee.employee_code} />
                        <DetailRow label="Departman" value={detail.employee.department_name} />
                        <DetailRow label="Görev" value={detail.employee.job_title_name} />
                      </div>
                    ) : (
                      <p className="mt-sm text-body text-text-secondary">
                        Bu kullanıcı personel kaydıyla bağlı değil.
                      </p>
                    )}
                  </section>

                  <section className="rounded-panel border border-border bg-surface-2 p-md">
                    <h3 className="text-body font-semibold text-text-primary">
                      Aktivasyon ve davet
                    </h3>
                    <div className="mt-sm grid gap-sm sm:grid-cols-2">
                      <DetailRow
                        label="State"
                        value={activationLabel(detail.activation.state)}
                      />
                      <DetailRow
                        label="Son davet"
                        value={detail.activation.latest_invitation_status ?? "-"}
                      />
                      <DetailRow
                        label="Davet bitiş"
                        value={formatDateTime(
                          detail.activation.latest_invitation_expires_at
                        )}
                      />
                      <DetailRow
                        label="Bekleyen / süresi dolan"
                        value={`${detail.activation.pending_invitation_count} / ${detail.activation.expired_invitation_count}`}
                      />
                    </div>
                  </section>

                  <section
                    className="rounded-panel border border-warning/25 bg-warning-bg/25 p-md"
                    data-testid="admin-user-actions-panel"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-sm">
                      <div>
                        <h3 className="text-body font-semibold text-text-primary">
                          Güvenli Aksiyonlar
                        </h3>
                        <p className="mt-xs text-caption text-text-secondary">
                          Bu işlemler gerekçe, açık onay metni ve audit kaydı ile
                          yürütülür. Silme, toplu işlem veya kimlik bilgisi sıfırlama
                          yapılmaz.
                        </p>
                      </div>
                      {currentUser?.id === detail.id ? (
                        <StatusPill tone="warning">Kendi hesabınız</StatusPill>
                      ) : null}
                    </div>

                    <div className="mt-md grid gap-sm sm:grid-cols-2">
                      <button
                        type="button"
                        data-testid="admin-user-deactivate"
                        disabled={!detail.is_active || currentUser?.id === detail.id}
                        onClick={() => openAction("deactivate", detail)}
                        className="inline-flex h-10 items-center justify-center gap-xs rounded-xl border border-border bg-surface-1 px-sm text-body font-semibold text-text-primary transition hover:border-danger hover:text-danger focus:outline-none focus:ring-2 focus:ring-danger/25 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                      >
                        <IconUserX size={16} aria-hidden={true} />
                        Pasifleştir
                      </button>
                      <button
                        type="button"
                        data-testid="admin-user-reactivate"
                        disabled={detail.is_active}
                        onClick={() => openAction("reactivate", detail)}
                        className="inline-flex h-10 items-center justify-center gap-xs rounded-xl border border-border bg-surface-1 px-sm text-body font-semibold text-text-primary transition hover:border-success hover:text-success focus:outline-none focus:ring-2 focus:ring-success/25 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                      >
                        <IconUserCheck size={16} aria-hidden={true} />
                        Yeniden aktifleştir
                      </button>
                      <button
                        type="button"
                        data-testid="admin-user-change-role"
                        disabled={currentUser?.id === detail.id}
                        onClick={() => openAction("change-role", detail)}
                        className="inline-flex h-10 items-center justify-center gap-xs rounded-xl border border-border bg-surface-1 px-sm text-body font-semibold text-text-primary transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                      >
                        <IconShieldCheck size={16} aria-hidden={true} />
                        Rol değiştir
                      </button>
                      <button
                        type="button"
                        data-testid="admin-user-create-invitation"
                        onClick={() => openAction("create-invitation", detail)}
                        className="inline-flex h-10 items-center justify-center gap-xs rounded-xl border border-border bg-surface-1 px-sm text-body font-semibold text-text-primary transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
                      >
                        <IconUserPlus size={16} aria-hidden={true} />
                        Davet oluştur
                      </button>
                      <button
                        type="button"
                        data-testid="admin-user-revoke-invitation"
                        disabled={
                          detail.activation.latest_invitation_status !== "pending" ||
                          !detail.activation.latest_invitation_id
                        }
                        onClick={() => openAction("revoke-invitation", detail)}
                        className="inline-flex h-10 items-center justify-center gap-xs rounded-xl border border-border bg-surface-1 px-sm text-body font-semibold text-text-primary transition hover:border-danger hover:text-danger focus:outline-none focus:ring-2 focus:ring-danger/25 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                      >
                        <IconUserCancel size={16} aria-hidden={true} />
                        Daveti iptal et
                      </button>
                    </div>

                    {actionKind ? (
                      <div className="mt-md rounded-xl border border-border bg-surface-1 p-md">
                        <div className="flex flex-wrap items-center justify-between gap-sm">
                          <h4 className="text-body font-semibold text-text-primary">
                            {ACTION_LABELS[actionKind]}
                          </h4>
                          <StatusPill tone="neutral">
                            {expectedConfirmation(actionKind, detail.username)}
                          </StatusPill>
                        </div>
                        <p className="mt-xs text-caption text-text-secondary">
                          {actionHelpText(actionKind, detail)}
                        </p>

                        {actionKind === "change-role" ? (
                          <label className="mt-sm block">
                            <span className="text-caption font-semibold text-text-secondary">
                              Yeni rol
                            </span>
                            <select
                              value={actionRole}
                              onChange={(event) =>
                                setActionRole(event.target.value as UserRole)
                              }
                              className="mt-xs h-10 w-full rounded-xl border border-border bg-surface-2 px-sm text-body text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
                            >
                              {USER_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {roleLabel(role)}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        {actionKind === "create-invitation" ||
                        actionKind === "revoke-invitation" ? null : (
                          <label className="mt-sm block">
                            <span className="text-caption font-semibold text-text-secondary">
                              Gerekçe
                            </span>
                            <textarea
                              data-testid="admin-user-action-reason"
                              value={actionReason}
                              onChange={(event) =>
                                setActionReason(event.target.value)
                              }
                              maxLength={500}
                              className="mt-xs min-h-20 w-full rounded-xl border border-border bg-surface-2 p-sm text-body text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
                            />
                          </label>
                        )}

                        <label className="mt-sm block">
                          <span className="text-caption font-semibold text-text-secondary">
                            Onay metni
                          </span>
                          <input
                            data-testid="admin-user-action-confirmation"
                            value={actionConfirmation}
                            onChange={(event) =>
                              setActionConfirmation(event.target.value)
                            }
                            placeholder={expectedConfirmation(
                              actionKind,
                              detail.username
                            )}
                            className="mt-xs h-10 w-full rounded-xl border border-border bg-surface-2 px-sm text-body text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
                          />
                        </label>

                        {actionError ? (
                          <p
                            className="mt-sm text-caption font-semibold text-danger"
                            data-testid="admin-user-action-error"
                          >
                            {actionError}
                          </p>
                        ) : null}
                        {actionSuccess ? (
                          <p
                            className="mt-sm text-caption font-semibold text-success"
                            data-testid="admin-user-action-success"
                          >
                            {actionSuccess}
                          </p>
                        ) : null}
                        {activationUrl ? (
                          <div
                            className="mt-sm rounded-xl border border-accent/25 bg-accent-bg p-sm text-caption text-text-primary"
                            data-testid="admin-user-activation-url"
                          >
                            {activationUrl}
                          </div>
                        ) : null}

                        <div className="mt-md flex flex-wrap gap-sm">
                          <button
                            type="button"
                            data-testid="admin-user-action-submit"
                            disabled={
                              isActionSubmitting ||
                              actionConfirmation !==
                                expectedConfirmation(actionKind, detail.username) ||
                              (!["create-invitation", "revoke-invitation"].includes(
                                actionKind
                              ) &&
                                actionReason.trim().length < 5)
                            }
                            onClick={submitAction}
                            className="inline-flex h-10 items-center rounded-xl border border-accent bg-accent px-md text-body font-semibold text-white transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                          >
                            {isActionSubmitting ? "İşleniyor" : "Onayla"}
                          </button>
                          <button
                            type="button"
                            data-testid="admin-user-action-cancel"
                            onClick={closeAction}
                            className="inline-flex h-10 items-center rounded-xl border border-border bg-surface-1 px-md text-body font-semibold text-text-primary transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </section>

                  <section className="rounded-panel border border-accent/20 bg-accent-bg/60 p-md">
                    <h3 className="text-body font-semibold text-text-primary">
                      Önerilen sonraki adım
                    </h3>
                    <p className="mt-xs text-body text-text-secondary">
                      {detail.recommended_next_step}
                    </p>
                    <p className="mt-sm text-caption text-text-secondary">
                      Kritik kullanıcı işlemleri bu panelde gerekçe, açık onay
                      metni ve audit kaydıyla yürütülür.
                    </p>
                  </section>

                  <div className="flex flex-wrap gap-sm">
                    <Link
                      to={
                        detail.employee
                          ? `/personnel?search=${encodeURIComponent(
                              detail.employee.full_name
                            )}`
                          : `/personnel?search=${encodeURIComponent(
                              detail.username
                            )}`
                      }
                      data-testid="admin-users-go-personnel"
                      className="inline-flex h-10 items-center rounded-xl border border-border bg-surface-1 px-md text-body font-semibold text-text-primary transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
                    >
                      Personel sayfasında ara
                    </Link>
                    <Link
                      to="/audit"
                      className="inline-flex h-10 items-center rounded-xl border border-border bg-surface-1 px-md text-body font-semibold text-text-primary transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
                    >
                      Audit sayfasına git
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </SlideOverPanel>
        </div>
      </PageTransition>
    </AppShell>
  );
}
