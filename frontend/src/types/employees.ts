import type { PaginatedApiResponse } from "./api";
import type { UserRole } from "./auth";

export interface Employee {
  id: number;
  user?: number | null;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;

  username?: string | null;
  user_email?: string | null;
  user_role?: UserRole | string | null;
  user_role_label?: string | null;
  user_is_active?: boolean | null;

  employee_code?: string | null;
  email?: string | null;
  phone?: string | null;

  department?: number | string | { id?: number; name?: string | null } | null;
  department_name?: string | null;

  job_title?: number | string | { id?: number; name?: string | null } | null;
  job_title_name?: string | null;

  manager?: number | null;
  manager_name?: string | null;
  manager_email?: string | null;

  external_hr_id?: string | null;
  sync_source?: string | null;
  sync_source_label?: string | null;
  is_active?: boolean;

  created_at?: string | null;
  updated_at?: string | null;

  [key: string]: unknown;
}

export type PaginatedEmployeeResponse<T> = PaginatedApiResponse<T>;

export interface EmployeeDetailNamedObject {
  id: number | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
}

export interface EmployeeDetailEmployee {
  id: number;
  full_name: string;
  name?: string | null;
  employee_code?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active: boolean;
  department?: EmployeeDetailNamedObject | null;
  job_title?: EmployeeDetailNamedObject | null;
  manager?: EmployeeDetailNamedObject | null;
  sync_source?: string | null;
  sync_source_label?: string | null;
  external_hr_id?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface EmployeeDetailUser {
  id: number;
  username: string;
  email?: string | null;
  role?: UserRole | string | null;
  role_label?: string | null;
  is_active: boolean;
  is_superuser?: boolean;
  last_login?: string | null;
  date_joined?: string | null;
}

export interface EmployeeDetailSummary {
  active_assignment_count: number;
  total_assignment_count: number;
  open_ticket_count: number;
  in_progress_ticket_count: number;
  resolved_ticket_count: number;
  closed_ticket_count: number;
  pending_approval_ticket_count: number;
  total_ticket_count: number;
}

export interface EmployeeActiveAssignment {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_inventory_code?: string | null;
  asset_serial_number?: string | null;
  asset_category?: string | null;
  asset_status?: string | null;
  asset_status_label?: string | null;
  asset_display_identifier?: string | null;
  assigned_at?: string | null;
  assigned_by_username?: string | null;
  notes?: string | null;
}

export interface EmployeeRecentTicket {
  id: number;
  title: string;
  category?: string | null;
  category_label?: string | null;
  priority?: string | null;
  priority_label?: string | null;
  status?: string | null;
  status_label?: string | null;
  approval_status?: string | null;
  approval_status_label?: string | null;
  asset_id?: number | null;
  asset_name?: string | null;
  assigned_to_username?: string | null;
  created_by_username?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface EmployeeDetailResponse {
  employee: EmployeeDetailEmployee;
  user: EmployeeDetailUser | null;
  summary: EmployeeDetailSummary;
  active_assignments: EmployeeActiveAssignment[];
  recent_tickets: EmployeeRecentTicket[];
}