import {
  IconBriefcase,
  IconDeviceLaptop,
  IconDownload,
  IconRefresh,
  IconSearch,
  IconTicket,
  IconUserCircle,
  IconUserCheck,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { AuditHistoryLink } from "../components/audit/AuditHistoryLink";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { TablePagination } from "../components/common/TablePagination";
import { AppShell } from "../components/layout/AppShell";
import {
  useEmployeeDetail,
  useEmployeeExport,
  useEmployeeTable,
} from "../hooks/useEmployeeTable";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { canManage } from "../lib/rbac";
import type {
  Employee,
  EmployeeActiveAssignment,
  EmployeeDetailResponse,
  EmployeeRecentTicket,
} from "../types/employees";

type ToastState = {
  type: "success" | "error";
  message: string;
};

function getEmployeeDisplayName(employee: Employee) {
  return employee.full_name || employee.name || "";
}

function getFirstName(employee: Employee) {
  if (employee.first_name) {
    return employee.first_name;
  }

  const displayName = getEmployeeDisplayName(employee).trim();

  if (!displayName) {
    return "-";
  }

  const parts = displayName.split(/\s+/);

  return parts[0] || "-";
}

function getLastName(employee: Employee) {
  if (employee.last_name) {
    return employee.last_name;
  }

  const displayName = getEmployeeDisplayName(employee).trim();

  if (!displayName) {
    return "-";
  }

  const parts = displayName.split(/\s+/);

  if (parts.length <= 1) {
    return "-";
  }

  return parts.slice(1).join(" ");
}

function getRoleLabel(employee: Employee) {
  if (employee.user_role_label) {
    return employee.user_role_label;
  }

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    technician: "Technician",
    viewer: "Viewer",
    approver: "Approver",
    requester: "Requester",
  };

  if (employee.user_role && typeof employee.user_role === "string") {
    return roleLabels[employee.user_role] ?? employee.user_role;
  }

  return employee.user ? "Rol yok" : "User yok";
}

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

function displayValue(value?: string | number | boolean | null) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Evet" : "Hay─▒r";
  }

  return value;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | boolean | null;
}) {
  return (
    <div className="rounded-app border border-border bg-surface-2 p-md">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-xs break-words text-body text-text-primary">
        {displayValue(value)}
      </p>
    </div>
  );
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "success" | "danger" | "warning" | "accent" | "neutral";
}) {
  const toneClassName = {
    success: "border-success/30 bg-success/10 text-success",
    danger: "border-danger/30 bg-danger/10 text-danger",
    warning: "border-warning/30 bg-warning/10 text-warning",
    accent: "border-accent/30 bg-accent/10 text-accent",
    neutral: "border-border bg-surface-2 text-text-secondary",
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-sm py-1 text-caption ${toneClassName}`}
    >
      {children}
    </span>
  );
}

function getTicketStatusTone(status?: string | null) {
  if (status === "resolved") {
    return "success";
  }

  if (status === "closed") {
    return "neutral";
  }

  if (status === "in_progress") {
    return "warning";
  }

  return "accent";
}

function getTicketPriorityTone(priority?: string | null) {
  if (priority === "urgent") {
    return "danger";
  }

  if (priority === "high") {
    return "warning";
  }

  return "neutral";
}

function EmployeeAssignmentCard({
  assignment,
}: {
  assignment: EmployeeActiveAssignment;
}) {
  return (
    <article className="rounded-app border border-border bg-surface-2 p-md">
      <div className="flex flex-col gap-xs sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-text-primary">
            {assignment.asset_name}
          </p>
          <p className="mt-xs text-caption text-text-secondary">
            {assignment.asset_display_identifier ||
              assignment.asset_inventory_code ||
              assignment.asset_serial_number ||
              "Varl─▒k kodu yok"}
          </p>
        </div>

        <StatusPill tone="accent">
          {assignment.asset_status_label || assignment.asset_status || "Durum yok"}
        </StatusPill>
      </div>

      <div className="mt-sm grid gap-sm sm:grid-cols-2">
        <DetailRow label="Kategori" value={assignment.asset_category} />
        <DetailRow label="Zimmet Tarihi" value={formatDate(assignment.assigned_at)} />
        <DetailRow label="Zimmetleyen" value={assignment.assigned_by_username} />
        <DetailRow label="Not" value={assignment.notes} />
      </div>
    </article>
  );
}

function EmployeeTicketCard({ ticket }: { ticket: EmployeeRecentTicket }) {
  return (
    <article className="rounded-app border border-border bg-surface-2 p-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-text-primary">{ticket.title}</p>
          <p className="mt-xs text-caption text-text-secondary">
            #{ticket.id} ┬À {ticket.category_label || ticket.category || "Kategori yok"} ┬À{" "}
            {formatDateTime(ticket.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-xs">
          <StatusPill tone={getTicketStatusTone(ticket.status)}>
            {ticket.status_label || ticket.status || "Durum yok"}
          </StatusPill>
          <StatusPill tone={getTicketPriorityTone(ticket.priority)}>
            {ticket.priority_label || ticket.priority || "├ûncelik yok"}
          </StatusPill>
        </div>
      </div>

      <div className="mt-sm grid gap-sm sm:grid-cols-2">
        <DetailRow label="Onay Durumu" value={ticket.approval_status_label} />
        <DetailRow label="Ba─şl─▒ Varl─▒k" value={ticket.asset_name} />
        <DetailRow label="Atanan" value={ticket.assigned_to_username} />
        <DetailRow label="G├╝ncellenme" value={formatDateTime(ticket.updated_at)} />
      </div>
    </article>
  );
}

function EmployeeDetailPanel({
  detail,
  isLoading,
  isError,
  onClose,
}: {
  detail?: EmployeeDetailResponse;
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
}) {
  const employee = detail?.employee;
  const user = detail?.user;
  const summary = detail?.summary;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <aside className="flex h-full w-full max-w-3xl flex-col border-l border-border bg-surface-0 shadow-panel">
        <header className="flex items-start justify-between gap-md border-b border-border bg-surface-1 p-lg">
          <div>
            <div className="flex flex-wrap items-center gap-xs">
              <span className="rounded-full border border-border bg-surface-2 px-sm py-1 text-caption text-text-secondary">
                Personel Detay─▒
              </span>

              {employee ? (
                <StatusPill tone={employee.is_active ? "success" : "danger"}>
                  {employee.is_active ? "Aktif" : "Pasif"}
                </StatusPill>
              ) : null}
            </div>

            <h2 className="mt-sm text-h2">
              {employee?.full_name || "Personel detay─▒"}
            </h2>

            <p className="mt-xs text-body text-text-secondary">
              {employee?.employee_code || "Personel kodu yok"}
            </p>

            {employee ? (
              <div className="mt-sm">
                <AuditHistoryLink
                  entityType="employees.Employee"
                  entityId={employee.id}
                />
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-app border border-border text-text-secondary transition hover:border-accent hover:text-accent"
            aria-label="Detay panelini kapat"
          >
            <IconX size={18} aria-hidden={true} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-lg">
          {isLoading ? (
            <div className="rounded-panel border border-border bg-surface-1 p-lg text-body text-text-secondary">
              Personel detay─▒ y├╝kleniyor...
            </div>
          ) : null}

          {isError ? (
            <div className="rounded-panel border border-danger/30 bg-danger/10 p-lg text-body text-danger">
              Personel detay─▒ y├╝klenemedi.
            </div>
          ) : null}

          {detail && employee && summary ? (
            <div className="flex flex-col gap-lg">
              <section className="grid gap-sm sm:grid-cols-2 xl:grid-cols-4">
                <MiniMetricCard
                  label="Aktif zimmet"
                  value={summary.active_assignment_count}
                  icon={<IconDeviceLaptop size={15} aria-hidden={true} />}
                />
                <MiniMetricCard
                  label="Toplam zimmet"
                  value={summary.total_assignment_count}
                  icon={<IconBriefcase size={15} aria-hidden={true} />}
                />
                <MiniMetricCard
                  label="A├ğ─▒k ticket"
                  value={
                    summary.open_ticket_count + summary.in_progress_ticket_count
                  }
                  icon={<IconTicket size={15} aria-hidden={true} />}
                />
                <MiniMetricCard
                  label="Toplam ticket"
                  value={summary.total_ticket_count}
                  icon={<IconTicket size={15} aria-hidden={true} />}
                />
              </section>

              <section className="rounded-panel border border-border bg-surface-1 p-md">
                <h3 className="text-h3">Kullan─▒c─▒ & Rol</h3>

                <div className="mt-md grid gap-sm sm:grid-cols-2">
                  <DetailRow label="Sistem Kullan─▒c─▒s─▒" value={user?.username} />
                  <DetailRow label="User E-posta" value={user?.email} />
                  <DetailRow label="Rol" value={user?.role_label || user?.role} />
                  <DetailRow
                    label="User Aktif Mi"
                    value={user ? user.is_active : null}
                  />
                  <DetailRow
                    label="Son Giri┼ş"
                    value={formatDateTime(user?.last_login)}
                  />
                  <DetailRow
                    label="Kay─▒t Tarihi"
                    value={formatDateTime(user?.date_joined)}
                  />
                </div>
              </section>

              <section className="rounded-panel border border-border bg-surface-1 p-md">
                <h3 className="text-h3">Organizasyon Bilgileri</h3>

                <div className="mt-md grid gap-sm sm:grid-cols-2">
                  <DetailRow label="Ad Soyad" value={employee.full_name} />
                  <DetailRow label="Personel Kodu" value={employee.employee_code} />
                  <DetailRow label="E-posta" value={employee.email} />
                  <DetailRow label="Telefon" value={employee.phone} />
                  <DetailRow label="Departman" value={employee.department?.name} />
                  <DetailRow label="Unvan" value={employee.job_title?.name} />
                  <DetailRow
                    label="Y├Ânetici"
                    value={employee.manager?.full_name}
                  />
                  <DetailRow
                    label="Y├Ânetici E-posta"
                    value={employee.manager?.email}
                  />
                  <DetailRow
                    label="Veri Kayna─ş─▒"
                    value={employee.sync_source_label || employee.sync_source}
                  />
                  <DetailRow
                    label="External HR ID"
                    value={employee.external_hr_id}
                  />
                  <DetailRow
                    label="Olu┼şturulma"
                    value={formatDateTime(employee.created_at)}
                  />
                  <DetailRow
                    label="G├╝ncellenme"
                    value={formatDateTime(employee.updated_at)}
                  />
                </div>

                {employee.notes ? (
                  <div className="mt-sm rounded-app border border-border bg-surface-2 p-md">
                    <p className="text-caption text-text-secondary">Notlar</p>
                    <p className="mt-xs whitespace-pre-wrap text-body text-text-primary">
                      {employee.notes}
                    </p>
                  </div>
                ) : null}
              </section>

              <section className="rounded-panel border border-border bg-surface-1 p-md">
                <div className="flex items-center justify-between gap-md">
                  <div>
                    <h3 className="text-h3">Aktif Zimmetler</h3>
                    <p className="mt-xs text-caption text-text-secondary">
                      Personelin iade edilmemi┼ş zimmet kay─▒tlar─▒.
                    </p>
                  </div>
                </div>

                <div className="mt-md flex flex-col gap-sm">
                  {detail.active_assignments.length > 0 ? (
                    detail.active_assignments.map((assignment) => (
                      <EmployeeAssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                      />
                    ))
                  ) : (
                    <div className="rounded-app border border-border bg-surface-2 p-md text-body text-text-secondary">
                      Aktif zimmet kayd─▒ bulunamad─▒.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-panel border border-border bg-surface-1 p-md">
                <div className="flex items-center justify-between gap-md">
                  <div>
                    <h3 className="text-h3">Ticket Ge├ğmi┼şi</h3>
                    <p className="mt-xs text-caption text-text-secondary">
                      Son 10 ticket kayd─▒ ve operasyonel durum ├Âzeti.
                    </p>
                  </div>
                </div>

                <div className="mt-md grid gap-sm sm:grid-cols-4">
                  <MiniMetricCard
                    label="A├ğ─▒k"
                    value={summary.open_ticket_count}
                    icon={<IconTicket size={15} aria-hidden={true} />}
                  />
                  <MiniMetricCard
                    label="─░┼şlemde"
                    value={summary.in_progress_ticket_count}
                    icon={<IconTicket size={15} aria-hidden={true} />}
                  />
                  <MiniMetricCard
                    label="├ç├Âz├╝ld├╝"
                    value={summary.resolved_ticket_count}
                    icon={<IconTicket size={15} aria-hidden={true} />}
                  />
                  <MiniMetricCard
                    label="Kapand─▒"
                    value={summary.closed_ticket_count}
                    icon={<IconTicket size={15} aria-hidden={true} />}
                  />
                </div>

                <div className="mt-md flex flex-col gap-sm">
                  {detail.recent_tickets.length > 0 ? (
                    detail.recent_tickets.map((ticket) => (
                      <EmployeeTicketCard key={ticket.id} ticket={ticket} />
                    ))
                  ) : (
                    <div className="rounded-app border border-border bg-surface-2 p-md text-body text-text-secondary">
                      Ticket kayd─▒ bulunamad─▒.
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

const columns: DataTableColumn<Employee>[] = [
  {
    key: "first_name",
    label: "Ad─▒",
    sortable: true,
    sortKey: "full_name",
    render: (employee) => getFirstName(employee),
  },
  {
    key: "last_name",
    label: "Soyad─▒",
    sortable: true,
    sortKey: "full_name",
    render: (employee) => getLastName(employee),
  },
  {
    key: "email",
    label: "E-posta adresi",
    sortable: true,
    sortKey: "email",
    render: (employee) => employee.user_email || employee.email || "-",
  },
  {
    key: "department_name",
    label: "Departman",
    sortable: true,
    sortKey: "department__name",
    render: (employee) => employee.department_name || "-",
  },
  {
    key: "job_title_name",
    label: "Unvan",
    sortable: true,
    sortKey: "job_title__name",
    render: (employee) => employee.job_title_name || "-",
  },
  {
    key: "user_role",
    label: "Rol",
    sortable: true,
    sortKey: "user__username",
    render: (employee) => getRoleLabel(employee),
  },
  {
    key: "is_active",
    label: "Durum",
    render: (employee) => (
      <StatusPill tone={employee.is_active ? "success" : "danger"}>
        {employee.is_active ? "Aktif" : "Pasif"}
      </StatusPill>
    ),
  },
];

export function PersonnelPage() {
  const { user } = useAuth();
  const userCanExport = canManage(user?.role);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null
  );
  const [toast, setToast] = useState<ToastState | null>(null);

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
    ordering: "full_name",
  });

  const employeesQuery = useEmployeeTable(state);
  const employeeDetailQuery = useEmployeeDetail(selectedEmployeeId);
  const employeeExportMutation = useEmployeeExport();

  const data = employeesQuery.data;
  const employees = data?.results ?? [];
  const totalUserCount = data?.count ?? 0;

  const selectedRole =
    typeof state.filters.user_role === "string" ? state.filters.user_role : "";

  const selectedStatus =
    typeof state.filters.is_active === "string" ? state.filters.is_active : "";

  const visibleLinkedUserCount = useMemo(() => {
    return employees.filter((employee) => Boolean(employee.user)).length;
  }, [employees]);

  const visibleActiveCount = useMemo(() => {
    return employees.filter((employee) => employee.is_active).length;
  }, [employees]);

  async function handleExport() {
    setToast(null);

    try {
      await employeeExportMutation.mutateAsync(state);

      setToast({
        type: "success",
        message: "Personel export dosyas─▒ indirildi.",
      });
    } catch {
      setToast({
        type: "error",
        message:
          "Personel export al─▒namad─▒. Yetkini veya filtreleri kontrol et.",
      });
    }
  }

  function refetchAll() {
    employeesQuery.refetch();

    if (selectedEmployeeId) {
      employeeDetailQuery.refetch();
    }
  }

  return (
    <AppShell>
      <section className="flex flex-col gap-lg">
        <header className="flex flex-col gap-md rounded-panel border border-border bg-surface-1 p-lg shadow-panel md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-h1">Personel</h1>
            <p className="mt-sm max-w-3xl text-body text-text-secondary">
              ┼Şirket personel kay─▒tlar─▒n─▒ g├Âr├╝nt├╝le, ara, filtrele, detaylar─▒n─▒
              incele ve yetkiliysen filtrelenmi┼ş CSV export al.
            </p>
          </div>

          <div className="flex flex-wrap gap-sm">
            {userCanExport ? (
              <button
                type="button"
                onClick={handleExport}
                disabled={employeeExportMutation.isPending}
                className="inline-flex items-center justify-center gap-xs rounded-app border border-accent bg-accent/10 px-md py-sm text-body text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <IconDownload size={18} aria-hidden={true} />
                {employeeExportMutation.isPending
                  ? "Export haz─▒rlan─▒yor..."
                  : "CSV Export"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={refetchAll}
              className="inline-flex items-center justify-center gap-xs rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
            >
              <IconRefresh size={18} aria-hidden={true} />
              Yenile
            </button>
          </div>
        </header>

        {toast ? (
          <div
            className={
              toast.type === "success"
                ? "rounded-panel border border-success/30 bg-success/10 p-md text-body text-success"
                : "rounded-panel border border-danger/30 bg-danger/10 p-md text-body text-danger"
            }
          >
            {toast.message}
          </div>
        ) : null}

        <section className="flex flex-wrap gap-sm">
          <MiniMetricCard
            label="Toplam kay─▒t"
            value={totalUserCount}
            icon={<IconUsers size={15} aria-hidden={true} />}
          />
          <MiniMetricCard
            label="Bu sayfada aktif"
            value={visibleActiveCount}
            icon={<IconUserCheck size={15} aria-hidden={true} />}
          />
          <MiniMetricCard
            label="Linked user"
            value={visibleLinkedUserCount}
            icon={<IconUserCircle size={15} aria-hidden={true} />}
          />
        </section>

        <section className="grid gap-md rounded-panel border border-border bg-surface-1 p-md shadow-panel md:grid-cols-[1.5fr_220px_220px_auto] md:items-end">
          <label className="flex flex-col gap-xs">
            <span className="text-caption text-text-secondary">Arama</span>
            <div className="flex items-center gap-xs rounded-app border border-border bg-surface-2 px-sm">
              <IconSearch size={18} className="text-text-secondary" />
              <input
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ad, e-posta, kullan─▒c─▒, departman..."
                className="w-full bg-transparent py-sm text-body text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>
          </label>

          <label className="flex flex-col gap-xs">
            <span className="text-caption text-text-secondary">Rol</span>
            <select
              value={selectedRole}
              onChange={(event) =>
                setFilter("user_role", event.target.value || null)
              }
              className="rounded-app border border-border bg-surface-2 px-sm py-sm text-body text-text-primary outline-none focus:border-accent"
            >
              <option value="">T├╝m roller</option>
              <option value="admin">Admin</option>
              <option value="technician">Technician</option>
              <option value="viewer">Viewer</option>
              <option value="approver">Approver</option>
              <option value="requester">Requester</option>
            </select>
          </label>

          <label className="flex flex-col gap-xs">
            <span className="text-caption text-text-secondary">Durum</span>
            <select
              value={selectedStatus}
              onChange={(event) =>
                setFilter("is_active", event.target.value || null)
              }
              className="rounded-app border border-border bg-surface-2 px-sm py-sm text-body text-text-primary outline-none focus:border-accent"
            >
              <option value="">Varsay─▒lan aktifler</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </label>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-xs rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
          >
            Temizle
          </button>
        </section>

        {employeesQuery.isError ? (
          <div className="rounded-panel border border-danger/30 bg-danger/10 p-md text-body text-danger">
            Personel tablosu y├╝klenemedi.
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={employees}
          getRowKey={(employee) => employee.id}
          ordering={state.ordering}
          onSortChange={setSort}
          isLoading={employeesQuery.isLoading}
          emptyMessage="Personel kayd─▒ bulunamad─▒."
          onRowClick={(employee) => setSelectedEmployeeId(employee.id)}
          getRowClassName={(employee) =>
            selectedEmployeeId === employee.id ? "bg-surface-2" : ""
          }
        />

        <TablePagination
          page={state.page}
          pageSize={state.pageSize}
          totalCount={data?.count ?? 0}
          hasNext={Boolean(data?.next)}
          hasPrevious={Boolean(data?.previous)}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>

      {selectedEmployeeId ? (
        <EmployeeDetailPanel
          detail={employeeDetailQuery.data}
          isLoading={employeeDetailQuery.isLoading}
          isError={employeeDetailQuery.isError}
          onClose={() => setSelectedEmployeeId(null)}
        />
      ) : null}
    </AppShell>
  );
}