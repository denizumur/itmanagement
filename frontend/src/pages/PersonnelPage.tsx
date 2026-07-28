import {
  IconBriefcase,
  IconDeviceLaptop,
  IconDownload,
  IconHistory,
  IconId,
  IconMail,
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconTicket,
  IconUserCircle,
  IconUserCheck,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { TablePagination } from "../components/common/TablePagination";
import { AppShell } from "../components/layout/AppShell";
import { AuditHistoryLink } from "../components/audit/AuditHistoryLink";
import {
  useEmployeeDetail,
  useEmployeeExport,
  useEmployeeTable,
} from "../hooks/useEmployeeTable";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { cn } from "../lib/cn";
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
    return value ? "Evet" : "Hayır";
  }

  return value;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  const display =
    value === undefined || value === null || value === "" ? "-" : value;

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-0/90 p-md shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-panel focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <p className="text-caption text-text-secondary">{label}</p>
      <div className="mt-xs break-words text-body font-medium text-text-primary">
        {typeof display === "boolean" ? displayValue(display) : display}
      </div>
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
  tone?: "accent" | "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}) {
  const toneClasses = {
    accent: "border-accent/20 bg-accent-bg text-accent",
    success: "border-success/20 bg-success-bg text-success",
    warning: "border-warning/25 bg-warning-bg text-warning",
    danger: "border-danger/25 bg-danger-bg text-danger",
    neutral: "border-border-subtle bg-surface-2 text-text-secondary",
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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toLocaleUpperCase("tr-TR"))
    .join("");
}

function PersonAvatar({
  name,
  active = true,
}: {
  name: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border text-caption font-semibold shadow-sm",
        active
          ? "border-accent/25 bg-accent-bg text-accent"
          : "border-danger/25 bg-danger-bg text-danger"
      )}
    >
      {getInitials(name)}
      <span className="absolute -right-1 -top-1 rounded-full border border-surface-1 bg-surface-1 text-text-secondary">
        <IconUserCircle size={15} aria-hidden={true} />
      </span>
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

function getRoleTone(role?: string | null): "success" | "warning" | "accent" | "neutral" {
  if (role === "admin" || role === "technician") {
    return "warning";
  }

  if (role === "approver") {
    return "accent";
  }

  if (role === "requester") {
    return "success";
  }

  return "neutral";
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
    <article className="rounded-2xl border border-border-subtle bg-surface-0/90 p-md shadow-sm transition hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-panel motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-col gap-xs sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-text-primary">
            {assignment.asset_name}
          </p>
          <p className="mt-xs text-caption text-text-secondary">
            {assignment.asset_display_identifier ||
              assignment.asset_inventory_code ||
              assignment.asset_serial_number ||
              "Varlık kodu yok"}
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
    <article className="rounded-2xl border border-border-subtle bg-surface-0/90 p-md shadow-sm transition hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-panel motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-text-primary">{ticket.title}</p>
          <p className="mt-xs text-caption text-text-secondary">
            #{ticket.id} · {ticket.category_label || ticket.category || "Kategori yok"} ·{" "}
            {formatDateTime(ticket.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-xs">
          <StatusPill tone={getTicketStatusTone(ticket.status)}>
            {ticket.status_label || ticket.status || "Durum yok"}
          </StatusPill>
          <StatusPill tone={getTicketPriorityTone(ticket.priority)}>
            {ticket.priority_label || ticket.priority || "Öncelik yok"}
          </StatusPill>
        </div>
      </div>

      <div className="mt-sm grid gap-sm sm:grid-cols-2">
        <DetailRow label="Onay Durumu" value={ticket.approval_status_label} />
        <DetailRow label="Bağlı Varlık" value={ticket.asset_name} />
        <DetailRow label="Atanan" value={ticket.assigned_to_username} />
        <DetailRow label="Güncellenme" value={formatDateTime(ticket.updated_at)} />
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-sm">
      <aside className="flex h-full w-full max-w-3xl flex-col border-l border-border-strong bg-surface-1/95 shadow-popover backdrop-blur-sm">
        <header className="flex items-start justify-between gap-md border-b border-border-subtle bg-surface-1/90 p-lg">
          <div>
            <div className="flex flex-wrap items-center gap-xs">
              <span className="rounded-full border border-border bg-surface-2 px-sm py-1 text-caption text-text-secondary">
                Personel Detayı
              </span>

              {employee ? (
                <StatusPill tone={employee.is_active ? "success" : "danger"}>
                  {employee.is_active ? "Aktif" : "Pasif"}
                </StatusPill>
              ) : null}
            </div>

            <h2 className="mt-sm text-h2">
              {employee?.full_name || "Personel detayı"}
            </h2>

            <p className="mt-xs text-body text-text-secondary">
              {employee?.employee_code || "Personel kodu yok"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-app border border-border-subtle bg-surface-0/80 text-text-secondary shadow-sm transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none"
            aria-label="Detay panelini kapat"
            title="Detay panelini kapat"
          >
            <IconX size={18} aria-hidden={true} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-lg">
          {isLoading ? (
            <div className="rounded-panel border border-border bg-surface-1 p-lg text-body text-text-secondary">
              Personel detayı yükleniyor...
            </div>
          ) : null}

          {isError ? (
            <div className="rounded-panel border border-danger/30 bg-danger/10 p-lg text-body text-danger">
              Personel detayı yüklenemedi.
            </div>
          ) : null}

          {detail && employee && summary ? (
            <div className="flex flex-col gap-lg">
              <section className="overflow-hidden rounded-panel border border-success/20 bg-surface-0 shadow-panel">
                <div className="h-1 bg-success" />
                <div className="flex flex-wrap items-center justify-between gap-md p-md">
                  <div className="flex min-w-0 items-center gap-md">
                    <PersonAvatar
                      name={employee.full_name || "Personel"}
                      active={employee.is_active}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-sm">
                        <h3 className="truncate text-lg font-semibold text-text-primary">
                          {employee.full_name || "Personel detayı"}
                        </h3>
                        <StatusPill tone={employee.is_active ? "success" : "danger"}>
                          {employee.is_active ? "Aktif" : "Pasif"}
                        </StatusPill>
                        <StatusPill tone={getRoleTone(user?.role)}>
                          {user?.role_label || user?.role || "User yok"}
                        </StatusPill>
                      </div>
                      <div className="mt-xs flex flex-wrap gap-xs">
                        <span className="rounded-full border border-border-subtle bg-surface-1 px-sm py-[2px] text-caption font-medium text-text-secondary">
                          {employee.employee_code || "Personel kodu yok"}
                        </span>
                        <span className="rounded-full border border-success/20 bg-success-bg px-sm py-[2px] text-caption font-medium text-success">
                          {employee.department?.name || "Departman yok"}
                        </span>
                        <span className="rounded-full border border-border-subtle bg-surface-1 px-sm py-[2px] text-caption text-text-secondary">
                          {employee.email || user?.email || "E-posta yok"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <AuditHistoryLink
                    entityType="employees.Employee"
                    entityId={employee.id}
                  />
                </div>
              </section>

              <section className="grid gap-sm sm:grid-cols-2 xl:grid-cols-4">
                <MiniMetricCard
                  label="Aktif zimmet"
                  value={summary.active_assignment_count}
                  icon={<IconDeviceLaptop size={15} aria-hidden={true} />}
                  tone="accent"
                />
                <MiniMetricCard
                  label="Toplam zimmet"
                  value={summary.total_assignment_count}
                  icon={<IconBriefcase size={15} aria-hidden={true} />}
                  tone="warning"
                />
                <MiniMetricCard
                  label="Açık ticket"
                  value={
                    summary.open_ticket_count + summary.in_progress_ticket_count
                  }
                  icon={<IconTicket size={15} aria-hidden={true} />}
                  tone="danger"
                />
                <MiniMetricCard
                  label="Toplam ticket"
                  value={summary.total_ticket_count}
                  icon={<IconTicket size={15} aria-hidden={true} />}
                  tone="success"
                />
              </section>

              <DetailSection
                title="Kimlik"
                icon={<IconId size={17} aria-hidden={true} />}
                tone="accent"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Ad Soyad" value={employee.full_name} />
                  <DetailRow label="Personel kodu" value={employee.employee_code} />
                  <DetailRow
                    label="Veri kaynağı"
                    value={employee.sync_source_label || employee.sync_source}
                  />
                  <DetailRow label="External HR ID" value={employee.external_hr_id} />
                </div>
              </DetailSection>

              <DetailSection
                title="İletişim"
                icon={<IconMail size={17} aria-hidden={true} />}
                tone="success"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="E-posta" value={employee.email} />
                  <DetailRow label="Telefon" value={employee.phone} />
                  <DetailRow label="User e-posta" value={user?.email} />
                  <DetailRow label="Sistem kullanıcısı" value={user?.username} />
                </div>
              </DetailSection>

              <DetailSection
                title="Organizasyon"
                icon={<IconMapPin size={17} aria-hidden={true} />}
                tone="warning"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Departman" value={employee.department?.name} />
                  <DetailRow label="Unvan" value={employee.job_title?.name} />
                  <DetailRow label="Yönetici" value={employee.manager?.full_name} />
                  <DetailRow label="Yönetici e-posta" value={employee.manager?.email} />
                </div>
              </DetailSection>

              <DetailSection
                title="Kullanıcı / Rol"
                icon={<IconShieldCheck size={17} aria-hidden={true} />}
                tone={user ? getRoleTone(user.role) : "accent"}
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Rol" value={user?.role_label || user?.role} />
                  <DetailRow label="User aktif mi" value={user ? user.is_active : null} />
                  <DetailRow label="Son giriş" value={formatDateTime(user?.last_login)} />
                  <DetailRow label="Kayıt tarihi" value={formatDateTime(user?.date_joined)} />
                </div>
              </DetailSection>

              <DetailSection
                title="Yönetici / Onay Akışı"
                icon={<IconUserCheck size={17} aria-hidden={true} />}
                tone="accent"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Yönetici" value={employee.manager?.full_name} />
                  <DetailRow label="Yönetici e-posta" value={employee.manager?.email} />
                  <DetailRow
                    label="Bekleyen onay ticket"
                    value={summary.pending_approval_ticket_count}
                  />
                  <DetailRow
                    label="Açık operasyon"
                    value={summary.open_ticket_count + summary.in_progress_ticket_count}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Sistem bilgisi"
                icon={<IconHistory size={17} aria-hidden={true} />}
                tone="success"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Oluşturulma" value={formatDateTime(employee.created_at)} />
                  <DetailRow label="Güncellenme" value={formatDateTime(employee.updated_at)} />
                </div>
                {employee.notes ? (
                  <div className="mt-md rounded-2xl border border-border-subtle bg-surface-0/90 p-md text-body leading-7 text-text-secondary shadow-sm">
                    {employee.notes}
                  </div>
                ) : null}
              </DetailSection>

              <section className="rounded-panel border border-border-subtle bg-surface-1/80 p-md shadow-panel">
                <div className="flex items-center justify-between gap-md">
                  <div>
                    <h3 className="text-h3">Aktif Zimmetler</h3>
                    <p className="mt-xs text-caption text-text-secondary">
                      Personelin iade edilmemiş zimmet kayıtları.
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
                    <div className="rounded-2xl border border-border-subtle bg-surface-0/80 p-md text-body text-text-secondary shadow-sm">
                      Aktif zimmet kaydı bulunamadı.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-panel border border-border-subtle bg-surface-1/80 p-md shadow-panel">
                <div className="flex items-center justify-between gap-md">
                  <div>
                    <h3 className="text-h3">Ticket Geçmişi</h3>
                    <p className="mt-xs text-caption text-text-secondary">
                      Son 10 ticket kaydı ve operasyonel durum özeti.
                    </p>
                  </div>
                </div>

                <div className="mt-md grid gap-sm sm:grid-cols-4">
                  <MiniMetricCard
                    label="Açık"
                    value={summary.open_ticket_count}
                    icon={<IconTicket size={15} aria-hidden={true} />}
                  />
                  <MiniMetricCard
                    label="İşlemde"
                    value={summary.in_progress_ticket_count}
                    icon={<IconTicket size={15} aria-hidden={true} />}
                  />
                  <MiniMetricCard
                    label="Çözüldü"
                    value={summary.resolved_ticket_count}
                    icon={<IconTicket size={15} aria-hidden={true} />}
                  />
                  <MiniMetricCard
                    label="Kapandı"
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
                    <div className="rounded-2xl border border-border-subtle bg-surface-0/80 p-md text-body text-text-secondary shadow-sm">
                      Ticket kaydı bulunamadı.
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
    key: "person",
    label: "Personel",
    sortable: true,
    sortKey: "full_name",
    render: (employee) => {
      const name = getEmployeeDisplayName(employee) || `Personel #${employee.id}`;
      const email = employee.user_email || employee.email || "E-posta yok";

      return (
        <div className="flex min-w-[260px] items-center gap-sm">
          <PersonAvatar name={name} active={employee.is_active !== false} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">{name}</p>
            <div className="mt-xs flex max-w-full flex-wrap gap-xs">
              <span className="inline-flex max-w-full rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-[11px] font-medium text-text-secondary shadow-sm">
                <span className="truncate">{employee.employee_code || "Kod yok"}</span>
              </span>
              <span className="inline-flex max-w-full rounded-full border border-accent/20 bg-accent-bg px-sm py-[2px] text-[11px] font-medium text-accent shadow-sm">
                <IconMail size={12} aria-hidden={true} />
                <span className="truncate">{email}</span>
              </span>
            </div>
          </div>
        </div>
      );
    },
  },
  {
    key: "organization",
    label: "Organizasyon",
    sortable: true,
    sortKey: "department__name",
    render: (employee) => (
      <div className="min-w-[190px] rounded-2xl border border-border-subtle bg-surface-0/80 px-sm py-xs shadow-sm">
        <p className="text-body font-medium text-text-primary">
          {employee.department_name || "Departman yok"}
        </p>
        <p className="text-caption text-text-secondary">
          {employee.job_title_name || "Unvan yok"}
        </p>
      </div>
    ),
  },
  {
    key: "user_role",
    label: "Kullanıcı / Rol",
    sortable: true,
    sortKey: "user__username",
    render: (employee) => (
      <div className="flex min-w-[180px] flex-col gap-xs">
        <StatusPill tone={employee.user ? "success" : "neutral"}>
          {employee.user ? "User bağlı" : "User yok"}
        </StatusPill>
        <StatusPill tone={getRoleTone(employee.user_role)}>
          {getRoleLabel(employee)}
        </StatusPill>
      </div>
    ),
  },
  {
    key: "manager",
    label: "Yönetici",
    render: (employee) => (
      <div className="min-w-[170px] text-text-secondary">
        <p className="font-medium text-text-primary">
          {employee.manager_name || "Yönetici yok"}
        </p>
        <p className="truncate text-caption">
          {employee.manager_email || employee.phone || "İletişim yok"}
        </p>
      </div>
    ),
  },
  {
    key: "is_active",
    label: "Durum",
    render: (employee) => (
      <div className="flex flex-col gap-xs">
        <StatusPill tone={employee.is_active ? "success" : "danger"}>
          {employee.is_active ? "Aktif" : "Pasif"}
        </StatusPill>
        <span className="text-caption text-text-secondary">
          {employee.sync_source_label || employee.sync_source || "Manuel"}
        </span>
      </div>
    ),
  },
];
export function PersonnelPage() {
  const { user } = useAuth();
  const userCanExport = canManage(user?.role);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null
  );
  const [, setToast] = useState<ToastState | null>(null);

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

  const selectedRoleLabel =
    selectedRole === "admin"
      ? "Admin"
      : selectedRole === "technician"
        ? "Technician"
        : selectedRole === "viewer"
          ? "Viewer"
          : selectedRole === "approver"
            ? "Approver"
            : selectedRole === "requester"
              ? "Requester"
              : "";

  const selectedStatusLabel =
    selectedStatus === "true"
      ? "Aktif"
      : selectedStatus === "false"
        ? "Pasif"
        : "";

  const hasActiveFilters = Boolean(state.search || selectedRole || selectedStatus);

  const visibleLinkedUserCount = useMemo(() => {
    return employees.filter((employee) => Boolean(employee.user)).length;
  }, [employees]);

  const visibleActiveCount = useMemo(() => {
    return employees.filter((employee) => employee.is_active).length;
  }, [employees]);

  const visiblePrivilegedRoleCount = useMemo(() => {
    return employees.filter((employee) =>
      ["admin", "technician", "approver"].includes(String(employee.user_role ?? ""))
    ).length;
  }, [employees]);

  async function handleExport() {
    setToast(null);

    try {
      await employeeExportMutation.mutateAsync(state);

      setToast({
        type: "success",
        message: "Personel export dosyası indirildi.",
      });
    } catch {
      setToast({
        type: "error",
        message:
          "Personel export alınamadı. Yetkini veya filtreleri kontrol et.",
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
        <section className="overflow-hidden rounded-panel border border-border-strong/60 bg-surface-1/75 shadow-panel backdrop-blur-sm">
          <div className="relative grid gap-md border-b border-border-subtle/80 p-md lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,var(--surface-1),transparent),radial-gradient(circle_at_0%_0%,var(--bg-success),transparent_32%),radial-gradient(circle_at_88%_0%,var(--bg-accent),transparent_28%)] opacity-80" />

            <div className="relative min-w-0">
              <div className="flex flex-wrap items-center gap-sm">
                <span className="inline-flex items-center gap-xs rounded-full border border-success/25 bg-success-bg/70 px-sm py-xs text-caption font-semibold text-success shadow-sm">
                  <IconSparkles size={14} aria-hidden={true} />
                  People & Access Operations Console
                </span>
                <span className="inline-flex items-center gap-xs rounded-full border border-border bg-surface-0/80 px-sm py-xs text-caption text-text-secondary shadow-sm">
                  Personel Operasyon Merkezi
                </span>
              </div>

              <p className="mt-sm max-w-3xl text-body leading-7 text-text-secondary">
                Çalışan kimliği, departman ve erişim rollerini tek ekrandan
                takip et; kullanıcı bağlantısı, yönetici ve operasyon sinyallerini
                hızlı tara.
              </p>
            </div>

            <div className="relative grid grid-cols-2 gap-xs sm:grid-cols-4 lg:min-w-[520px]">
              <MiniMetricCard
                label="Toplam"
                value={totalUserCount}
                icon={<IconUsers size={14} aria-hidden={true} />}
                tone="accent"
              />
              <MiniMetricCard
                label="Aktif"
                value={visibleActiveCount}
                icon={<IconUserCheck size={14} aria-hidden={true} />}
                tone="success"
              />
              <MiniMetricCard
                label="User bağlı"
                value={visibleLinkedUserCount}
                icon={<IconUserCircle size={14} aria-hidden={true} />}
                tone="warning"
              />
              <MiniMetricCard
                label="Yetkili"
                value={visiblePrivilegedRoleCount}
                icon={<IconShieldCheck size={14} aria-hidden={true} />}
                tone="danger"
              />
            </div>
          </div>

          <div className="grid gap-sm p-md xl:grid-cols-[1fr_190px_190px_auto_auto]">
            <label className="flex min-h-10 items-center gap-sm rounded-xl border border-success/25 bg-surface-0/85 px-md py-xs shadow-sm transition focus-within:border-success focus-within:ring-2 focus-within:ring-success/20 motion-reduce:transition-none">
              <IconSearch
                size={18}
                className="text-success"
                aria-hidden={true}
              />
              <input
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ad, e-posta, kullanıcı, departman..."
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </label>

            <select
              value={selectedRole}
              onChange={(event) =>
                setFilter("user_role", event.target.value || null)
              }
              className="min-h-10 rounded-xl border border-border bg-surface-0/85 px-sm py-xs text-body text-text-primary shadow-sm outline-none transition focus:border-success focus:ring-2 focus:ring-success/20 motion-reduce:transition-none"
              aria-label="Rol filtresi"
            >
              <option value="">Tüm roller</option>
              <option value="admin">Admin</option>
              <option value="technician">Technician</option>
              <option value="viewer">Viewer</option>
              <option value="approver">Approver</option>
              <option value="requester">Requester</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(event) =>
                setFilter("is_active", event.target.value || null)
              }
              className="min-h-10 rounded-xl border border-border bg-surface-0/85 px-sm py-xs text-body text-text-primary shadow-sm outline-none transition focus:border-success focus:ring-2 focus:ring-success/20 motion-reduce:transition-none"
              aria-label="Durum filtresi"
            >
              <option value="">Varsayılan aktifler</option>
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-surface-0/85 px-md py-xs text-body font-medium text-text-primary shadow-sm transition hover:border-success hover:bg-success-bg hover:text-success focus:outline-none focus:ring-2 focus:ring-success/25 motion-reduce:transition-none"
            >
              Temizle
            </button>

            <div className="flex flex-wrap gap-xs">
              {userCanExport ? (
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={employeeExportMutation.isPending}
                  className="inline-flex min-h-10 items-center justify-center gap-xs rounded-xl border border-accent/30 bg-accent-bg px-md py-xs text-body font-medium text-accent shadow-sm transition hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                >
                  <IconDownload size={16} aria-hidden={true} />
                  {employeeExportMutation.isPending ? "Hazırlanıyor" : "CSV"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={refetchAll}
                className="inline-flex min-h-10 items-center justify-center gap-xs rounded-xl border border-border bg-surface-0/85 px-md py-xs text-body font-medium text-text-primary shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
              >
                <IconRefresh size={16} aria-hidden={true} />
                Yenile
              </button>
            </div>
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

              {selectedRole ? (
                <FilterChip
                  label="Rol"
                  value={selectedRoleLabel}
                  onRemove={() => setFilter("user_role", null)}
                />
              ) : null}

              {selectedStatus ? (
                <FilterChip
                  label="Durum"
                  value={selectedStatusLabel}
                  onRemove={() => setFilter("is_active", null)}
                />
              ) : null}
            </div>
          ) : null}
        </section>
        {employeesQuery.isError ? (
          <div className="rounded-panel border border-danger/30 bg-danger/10 p-md text-body text-danger">
            Personel tablosu yüklenemedi.
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={employees}
          getRowKey={(employee) => employee.id}
          ordering={state.ordering}
          onSortChange={setSort}
          isLoading={employeesQuery.isLoading}
          emptyMessage="Personel kaydı bulunamadı."
          onViewDetails={(employee) => setSelectedEmployeeId(employee.id)}
          viewDetailsLabel="Personel detayını gör"
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
