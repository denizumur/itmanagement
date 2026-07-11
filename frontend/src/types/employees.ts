export interface Employee {
  id: number;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
  department_name?: string | null;
  job_title_name?: string | null;
  department?: string | { id?: number; name?: string | null } | null;
  job_title?: string | { id?: number; name?: string | null } | null;

  [key: string]: unknown;
}

export interface PaginatedEmployeeResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}