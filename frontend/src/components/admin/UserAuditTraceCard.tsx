import { IconHistory, IconRefresh } from "@tabler/icons-react";
import { Link } from "react-router";
import type { AdminUserDetail } from "../../types/adminUsers";

export type UserActionResultType =
  | "invitation_created"
  | "invitation_revoked"
  | "deactivated"
  | "reactivated"
  | "role_changed";

export interface UserActionResult {
  type: UserActionResultType;
  title: string;
  description: string;
  timestamp: string;
  activationUrl?: string;
}

export function getUserAuditLink(user: Pick<AdminUserDetail, "id">) {
  return `/audit?entity_type=accounts.User&entity_id=${encodeURIComponent(
    String(user.id)
  )}`;
}

export function UserAuditTraceCard({
  user,
  result,
  onRefresh,
}: {
  user: AdminUserDetail;
  result?: UserActionResult | null;
  onRefresh?: () => void;
}) {
  const auditLink = getUserAuditLink(user);

  return (
    <section
      className="rounded-panel border border-accent/20 bg-accent-bg/50 p-md"
      data-testid="admin-user-audit-trace"
    >
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div>
          <div className="flex items-center gap-xs">
            <IconHistory size={16} aria-hidden={true} className="text-accent" />
            <h3 className="text-body font-semibold text-text-primary">
              Audit izleri
            </h3>
          </div>
          <p className="mt-xs text-caption text-text-secondary">
            Son 30 günde bu kullanıcıyla ilişkili {user.audit.audit_logs_30d} audit
            kaydı var.
          </p>
        </div>
        <Link
          to={auditLink}
          data-testid="admin-user-audit-link"
          className="inline-flex h-9 items-center rounded-xl border border-border bg-surface-1 px-sm text-caption font-semibold text-text-primary transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
        >
          Audit'te görüntüle
        </Link>
      </div>

      {result ? (
        <div
          className="mt-sm rounded-xl border border-success/25 bg-success-bg/70 p-sm"
          data-testid="admin-user-action-result"
        >
          <p className="text-body font-semibold text-success">{result.title}</p>
          <p className="mt-xs text-caption text-text-secondary">
            {result.description}
          </p>
          <div className="mt-sm flex flex-wrap items-center gap-sm text-caption text-text-secondary">
            <span>{new Date(result.timestamp).toLocaleString("tr-TR")}</span>
            <Link
              to={auditLink}
              className="font-semibold text-accent transition hover:text-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
            >
              Audit kayıtlarını görüntüle
            </Link>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-xs font-semibold text-text-primary transition hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
              >
                <IconRefresh size={14} aria-hidden={true} />
                Detayı yenile
              </button>
            ) : null}
          </div>
          {result.activationUrl ? (
            <div
              className="mt-sm rounded-xl border border-accent/25 bg-surface-1 p-sm"
              data-testid="admin-user-activation-url"
            >
              <p className="text-caption font-semibold text-text-primary">
                Geçici aktivasyon linki
              </p>
              <p className="mt-xs break-all text-caption text-text-secondary">
                {result.activationUrl}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
