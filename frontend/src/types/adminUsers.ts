export type AdminUserActivationState =
  | "active"
  | "inactive"
  | "needs_activation"
  | "pending_invitation"
  | "expired_invitation"
  | "no_employee";

export interface AdminUserEmployeeSummary {
  id: number;
  full_name: string;
  employee_code: string | null;
  department_name: string | null;
  job_title_name: string | null;
  is_active: boolean;
}

export interface AdminUserListItem {
  id: number;
  username: string;
  display_name: string;
  masked_email: string | null;
  role: string | null;
  is_active: boolean;
  has_usable_credential: boolean;
  last_login: string | null;
  date_joined: string | null;
  employee: AdminUserEmployeeSummary | null;
  activation: {
    state: AdminUserActivationState | string;
    needs_invitation: boolean;
    latest_invitation_status: string | null;
    latest_invitation_expires_at: string | null;
    latest_invitation_created_at: string | null;
    pending_invitation_count: number;
    expired_invitation_count: number;
    accepted_invitations_30d: number;
    revoked_invitations_30d: number;
  };
}

export interface AdminUserDetail extends AdminUserListItem {
  audit: {
    audit_logs_30d: number;
  };
  recommended_next_step: string;
}

export interface PaginatedAdminUsersResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AdminUserListItem[];
}
