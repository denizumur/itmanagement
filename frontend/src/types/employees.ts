import type { PaginatedApiResponse } from "./api";

export interface Employee {
  id: number;
  user?: number | null;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  user_email?: string | null;
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

  [key: string]: unknown;
}

export type PaginatedEmployeeResponse<T> = PaginatedApiResponse<T>;