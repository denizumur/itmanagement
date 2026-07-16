import type { PaginatedApiResponse } from "./api";

export interface AssignmentEmployee {
  id?: number;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  department_name?: string | null;
  job_title_name?: string | null;
  department?: string | { id?: number; name?: string | null } | null;
  job_title?: string | { id?: number; name?: string | null } | null;
}

export interface AssignmentAsset {
  id?: number;
  name?: string | null;
  inventory_code?: string | null;
  serial_number?: string | null;
  brand?: string | null;
  model?: string | null;
  status?: string | null;
}

export interface Assignment {
  id: number;

  asset?: number | AssignmentAsset | null;
  asset_id?: number | null;
  asset_detail?: AssignmentAsset | null;
  asset_name?: string | null;
  asset_inventory_code?: string | null;
  asset_serial_number?: string | null;
  asset_status?: string | null;

  employee?: number | string | AssignmentEmployee | null;
  employee_id?: number | null;
  employee_name?: string | null;
  employee_full_name?: string | null;
  assigned_employee_name?: string | null;
  assigned_to_name?: string | null;
  employee_department?: string | null;
  employee_job_title?: string | null;
  employee_department_name?: string | null;
  employee_job_title_name?: string | null;

  assigned_at?: string | null;
  returned_at?: string | null;
  return_date?: string | null;
  is_active?: boolean | null;

  assigned_by?: number | null;
  assigned_by_username?: string | null;
  returned_by?: number | null;
  returned_by_username?: string | null;

  notes?: string | null;
  return_notes?: string | null;

  created_at?: string | null;
  updated_at?: string | null;

  [key: string]: unknown;
}

export interface AssignmentCreatePayload {
  asset: number;
  employee: number;
  assigned_at?: string | null;
  notes?: string | null;
}

export interface AssignmentReturnPayload {
  returned_at?: string | null;
  return_date?: string | null;
  return_notes?: string | null;
  notes?: string | null;
}

export interface AssignmentSummary {
  total: number;
  active: number;
  returned: number;
  assigned_last_30_days: number;
  returned_last_30_days: number;
}

export interface AssignmentFilters {
  search?: string;
  active?: string;
  asset?: string | number;
  employee?: string | number;
}

export type PaginatedAssignmentResponse<T> = PaginatedApiResponse<T>;