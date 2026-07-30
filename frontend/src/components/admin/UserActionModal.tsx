import type { UserRole } from "../../types/auth";

const USER_ROLES: UserRole[] = [
  "admin",
  "technician",
  "viewer",
  "approver",
  "requester",
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  technician: "Technician",
  viewer: "Viewer",
  approver: "Approver",
  requester: "Requester",
};

export function UserActionModal({
  title,
  description,
  expectedConfirmation,
  reason,
  confirmation,
  error,
  isSubmitting,
  reasonRequired = true,
  currentRole,
  selectedRole,
  onReasonChange,
  onConfirmationChange,
  onSelectedRoleChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  expectedConfirmation: string;
  reason: string;
  confirmation: string;
  error?: string;
  isSubmitting?: boolean;
  reasonRequired?: boolean;
  currentRole?: string | null;
  selectedRole?: UserRole | "";
  onReasonChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  onSelectedRoleChange?: (value: UserRole | "") => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const isRoleChange = selectedRole !== undefined && onSelectedRoleChange;
  const isSameRole = Boolean(
    isRoleChange && selectedRole && currentRole && selectedRole === currentRole
  );
  const submitDisabled =
    Boolean(isSubmitting) ||
    confirmation !== expectedConfirmation ||
    (reasonRequired && reason.trim().length < 5) ||
    (isRoleChange && (!selectedRole || isSameRole));

  return (
    <div
      className="mt-md rounded-xl border border-border bg-surface-1 p-md"
      data-testid="admin-user-action-modal"
    >
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h4 className="text-body font-semibold text-text-primary">{title}</h4>
        <span className="rounded-full border border-border bg-surface-2 px-sm py-xs text-[11px] font-semibold text-text-secondary">
          {expectedConfirmation}
        </span>
      </div>
      <p className="mt-xs text-caption text-text-secondary">{description}</p>

      {isRoleChange ? (
        <label className="mt-sm block">
          <span className="text-caption font-semibold text-text-secondary">
            Yeni rol
          </span>
          <select
            value={selectedRole}
            onChange={(event) =>
              onSelectedRoleChange(event.target.value as UserRole | "")
            }
            className="mt-xs h-10 w-full rounded-xl border border-border bg-surface-2 px-sm text-body text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
          >
            <option value="">Rol seçin</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role} disabled={role === currentRole}>
                {ROLE_LABELS[role]}
                {role === currentRole ? " (mevcut)" : ""}
              </option>
            ))}
          </select>
          <p className="mt-xs text-caption text-text-secondary">
            Bu işlem kullanıcının yetki seviyesini değiştirir. İşlem audit log'a
            yazılır.
          </p>
        </label>
      ) : null}

      {reasonRequired ? (
        <label className="mt-sm block">
          <span className="text-caption font-semibold text-text-secondary">
            Gerekçe
          </span>
          <textarea
            data-testid="admin-user-action-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            maxLength={500}
            className="mt-xs min-h-20 w-full rounded-xl border border-border bg-surface-2 p-sm text-body text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
          />
        </label>
      ) : null}

      <label className="mt-sm block">
        <span className="text-caption font-semibold text-text-secondary">
          Onay metni
        </span>
        <input
          data-testid="admin-user-action-confirmation"
          value={confirmation}
          onChange={(event) => onConfirmationChange(event.target.value)}
          placeholder={expectedConfirmation}
          className="mt-xs h-10 w-full rounded-xl border border-border bg-surface-2 px-sm text-body text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
        />
      </label>

      {error ? (
        <p
          className="mt-sm text-caption font-semibold text-danger"
          data-testid="admin-user-action-error"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-md flex flex-wrap gap-sm">
        <button
          type="button"
          data-testid="admin-user-action-submit"
          disabled={submitDisabled}
          onClick={onSubmit}
          className="inline-flex h-10 items-center rounded-xl border border-accent bg-accent px-md text-body font-semibold text-white transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          {isSubmitting ? "İşleniyor" : "Onayla"}
        </button>
        <button
          type="button"
          data-testid="admin-user-action-cancel"
          onClick={onCancel}
          className="inline-flex h-10 items-center rounded-xl border border-border bg-surface-1 px-md text-body font-semibold text-text-primary transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
