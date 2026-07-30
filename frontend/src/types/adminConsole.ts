export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export interface AdminConsoleOverview {
  generated_at: string;
  system: {
    status: HealthStatus;
    environment: string;
    debug: boolean;
    database: {
      status: "ok" | "error";
    };
    cache: {
      status: "ok" | "error" | "not_configured";
    };
    security: {
      refresh_cookie_secure: boolean;
      origin_required: boolean;
      warnings: string[];
    };
  };
  backup: {
    status: HealthStatus;
    latest_manifest: {
      run_id: string | null;
      started_at: string | null;
      finished_at: string | null;
      status: "success" | "failed" | "partial" | string | null;
      environment: string | null;
      postgres_backup_file: string | null;
      postgres_backup_size_bytes: number | null;
      media_backup_file: string | null;
      media_backup_size_bytes: number | null;
      retention_applied: boolean;
      deleted_files_count: number;
      warnings_count: number;
      errors_count: number;
      age_hours: number | null;
    } | null;
    manifest_count: number;
    warnings: string[];
  };
  accounts: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    users_without_usable_credential: number;
    pending_invitations: number;
    expired_invitations: number;
    accepted_invitations_30d: number;
    revoked_invitations_30d: number;
  };
  employees: {
    total_employees: number;
    active_employees: number;
    employees_with_user: number;
    employees_without_user: number;
    inactive_linked_users: number;
    latest_import: {
      id: number;
      status: string;
      created_at: string;
      committed_at: string | null;
      created_count: number;
      error_count: number;
      warning_count: number;
    } | null;
  };
  operations: {
    open_critical_items: string[];
    audit_logs_24h: number;
    critical_audit_logs_24h: number;
    open_tickets: number;
    urgent_tickets: number;
    overdue_reminders: number;
  };
  links: {
    audit: string;
    personnel: string;
    reminders: string;
    tickets: string;
    backup_docs: string;
    scheduled_jobs_docs: string;
    production_readiness_docs: string;
  };
}
