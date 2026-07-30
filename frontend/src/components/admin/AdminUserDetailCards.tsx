import { IconBriefcase, IconId, IconMail, IconUserCheck } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "../../lib/cn";
import type { AdminUserDetail } from "../../types/adminUsers";

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

export function AdminUserSummaryCard({ user }: { user: AdminUserDetail }) {
  return (
    <section className="rounded-panel border border-border bg-surface-2 p-md">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-xs text-caption font-semibold text-text-secondary">
            <IconId size={16} aria-hidden={true} />
            Kullanıcı özeti
          </div>
          <h3 className="mt-xs truncate text-heading-3 text-text-primary">
            {user.username}
          </h3>
          <p className="truncate text-body text-text-secondary">
            {user.display_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <StatusPill tone="neutral">{roleLabel(user.role)}</StatusPill>
          <StatusPill tone={user.is_active ? "success" : "warning"}>
            {user.is_active ? "Aktif" : "Pasif"}
          </StatusPill>
          <StatusPill tone={toneForActivation(user.activation.state)}>
            {activationLabel(user.activation.state)}
          </StatusPill>
        </div>
      </div>
      <div className="mt-md grid gap-sm sm:grid-cols-2">
        <DetailRow label="Maskeli e-posta" value={user.masked_email} />
        <DetailRow label="Son giriş" value={formatDateTime(user.last_login)} />
        <DetailRow label="Kayıt tarihi" value={formatDateTime(user.date_joined)} />
        <DetailRow
          label="Kimlik bilgisi"
          value={user.has_usable_credential ? "Kullanıma hazır" : "Aktivasyon gerekli"}
        />
      </div>
    </section>
  );
}

export function AdminUserEmployeeCard({ user }: { user: AdminUserDetail }) {
  return (
    <section className="rounded-panel border border-border bg-surface-2 p-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div className="flex items-center gap-xs">
          <IconBriefcase size={16} aria-hidden={true} className="text-accent" />
          <h3 className="text-body font-semibold text-text-primary">
            Personel bağlantısı
          </h3>
        </div>
        <Link
          to={
            user.employee
              ? `/personnel?search=${encodeURIComponent(user.employee.full_name)}`
              : `/personnel?search=${encodeURIComponent(user.username)}`
          }
          data-testid="admin-users-go-personnel"
          className="inline-flex h-9 items-center rounded-xl border border-border bg-surface-1 px-sm text-caption font-semibold text-text-primary transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
        >
          Personel sayfasına git
        </Link>
      </div>
      {user.employee ? (
        <div className="mt-sm grid gap-sm sm:grid-cols-2">
          <DetailRow label="Personel" value={user.employee.full_name} />
          <DetailRow label="Kod" value={user.employee.employee_code} />
          <DetailRow label="Departman" value={user.employee.department_name} />
          <DetailRow label="Görev" value={user.employee.job_title_name} />
        </div>
      ) : (
        <p className="mt-sm text-body text-text-secondary">
          Bu kullanıcı personel kaydıyla bağlı değil.
        </p>
      )}
    </section>
  );
}

export function AdminUserInvitationCard({ user }: { user: AdminUserDetail }) {
  return (
    <section className="rounded-panel border border-border bg-surface-2 p-md">
      <div className="flex items-center gap-xs">
        <IconMail size={16} aria-hidden={true} className="text-accent" />
        <h3 className="text-body font-semibold text-text-primary">
          Aktivasyon ve davet
        </h3>
      </div>
      <div className="mt-sm grid gap-sm sm:grid-cols-2">
        <DetailRow label="State" value={activationLabel(user.activation.state)} />
        <DetailRow
          label="Son davet"
          value={user.activation.latest_invitation_status ?? "-"}
        />
        <DetailRow
          label="Davet bitiş"
          value={formatDateTime(user.activation.latest_invitation_expires_at)}
        />
        <DetailRow
          label="Bekleyen / süresi dolan"
          value={`${user.activation.pending_invitation_count} / ${user.activation.expired_invitation_count}`}
        />
        <DetailRow
          label="Son davet tarihi"
          value={formatDateTime(user.activation.latest_invitation_created_at)}
        />
        <DetailRow
          label="Son 30 gün"
          value={`${user.activation.accepted_invitations_30d} kabul / ${user.activation.revoked_invitations_30d} iptal`}
        />
      </div>
    </section>
  );
}

export function AdminUserNextStepCard({ user }: { user: AdminUserDetail }) {
  return (
    <section className="rounded-panel border border-accent/20 bg-accent-bg/60 p-md">
      <div className="flex items-center gap-xs">
        <IconUserCheck size={16} aria-hidden={true} className="text-accent" />
        <h3 className="text-body font-semibold text-text-primary">
          Önerilen sonraki adım
        </h3>
      </div>
      <p className="mt-xs text-body text-text-secondary">
        {user.recommended_next_step}
      </p>
      <p className="mt-sm text-caption text-text-secondary">
        Kritik kullanıcı işlemleri gerekçe, açık onay metni ve audit kaydıyla
        yürütülür.
      </p>
    </section>
  );
}
