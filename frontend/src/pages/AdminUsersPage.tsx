import {
  IconFilter,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconUserCheck,
  IconUserCircle,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  AdminUserEmployeeCard,
  AdminUserInvitationCard,
  AdminUserNextStepCard,
  AdminUserSummaryCard,
} from "../components/admin/AdminUserDetailCards";
import { SafeUserActionsPanel } from "../components/admin/SafeUserActionsPanel";
import {
  UserAuditTraceCard,
  type UserActionResult,
} from "../components/admin/UserAuditTraceCard";
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
import { useAdminUserDetail, useAdminUsersTable } from "../hooks/useAdminUsers";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { cn } from "../lib/cn";
import type { AdminUserListItem } from "../types/adminUsers";

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
    technician: "Teknisyen",
    viewer: "İzleyici",
    requester: "Talep sahibi",
    approver: "Onaycı",
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
  const [actionResult, setActionResult] = useState<UserActionResult | null>(null);
  const { data, isLoading, isError, refetch, isFetching } =
    useAdminUsersTable(state);
  const {
    data: detail,
    isLoading: isDetailLoading,
    refetch: refetchDetail,
  } = useAdminUserDetail(selectedUser?.id);

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

  async function refreshUsers() {
    await Promise.all([refetch(), refetchDetail()]);
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
                <option value="technician">Teknisyen</option>
                <option value="viewer">İzleyici</option>
                <option value="requester">Talep sahibi</option>
                <option value="approver">Onaycı</option>
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
              onViewDetails={(user) => {
                setSelectedUser(user);
                setActionResult(null);
              }}
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
              setActionResult(null);
            }}
          >
            <div data-testid="admin-users-detail-drawer">
              {isDetailLoading || !detail ? (
                <Skeleton className="h-64" />
              ) : (
                <div className="space-y-md">
                  <AdminUserSummaryCard user={detail} />
                  <AdminUserEmployeeCard user={detail} />
                  <AdminUserInvitationCard user={detail} />
                  <SafeUserActionsPanel
                    user={detail}
                    currentUser={currentUser}
                    onRefresh={refreshUsers}
                    onActionResult={setActionResult}
                  />
                  <UserAuditTraceCard
                    user={detail}
                    result={actionResult}
                    onRefresh={refreshUsers}
                  />
                  <AdminUserNextStepCard user={detail} />
                </div>
              )}
            </div>
          </SlideOverPanel>
        </div>
      </PageTransition>
    </AppShell>
  );
}
