export type MaintenanceRecordType =
  | "maintenance"
  | "repair"
  | "disposal"
  | "MAINTENANCE"
  | "REPAIR"
  | "DISPOSAL"
  | string;

export type MaintenanceRecordStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "overdue"
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "OVERDUE"
  | string;

export interface MaintenanceAsset {
  id?: number;
  name?: string | null;
  inventory_code?: string | null;
  serial_number?: string | null;
  brand?: string | null;
  model?: string | null;
  status?: string | null;
}

export interface MaintenanceRecord {
  id: number;

  asset?: number | MaintenanceAsset | null;
  asset_id?: number | null;
  asset_detail?: MaintenanceAsset | null;
  asset_name?: string | null;
  asset_inventory_code?: string | null;
  asset_serial_number?: string | null;
  asset_category_name?: string | null;

  type?: MaintenanceRecordType | null;
  record_type?: MaintenanceRecordType | null;
  maintenance_type?: MaintenanceRecordType | null;
  type_label?: string | null;
  type_display?: string | null;
  record_type_display?: string | null;

  status?: MaintenanceRecordStatus | null;
  status_display?: string | null;

  title?: string | null;
  description?: string | null;
  notes?: string | null;

  performed_at?: string | null;
  scheduled_date?: string | null;
  due_date?: string | null;
  maintenance_date?: string | null;
  repair_date?: string | null;
  disposal_date?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  next_due_date?: string | null;
  next_maintenance_due_date?: string | null;
  frequency_days?: number | string | null;

  cost?: number | string | null;
  vendor?: string | null;
  performed_by?: string | null;

  asset_status_before?: string | null;
  asset_status_after?: string | null;

  is_overdue?: boolean | null;

  created_by?: number | null;
  created_by_username?: string | null;
  updated_by?: number | null;
  updated_by_username?: string | null;

  [key: string]: unknown;
}

export interface MaintenanceSummary {
  total?: number;
  total_records?: number;
  maintenance_count?: number;
  repair_count?: number;
  disposal_count?: number;
  planned_count?: number;
  in_progress_count?: number;
  completed_count?: number;
  overdue_count?: number;
  upcoming_count?: number;
  total_cost?: number | string | null;

  [key: string]: unknown;
}

export interface MaintenanceFilters {
  search?: string;
  type?: string;
  record_type?: string;
  status?: string;
  asset?: string | number;
}

export interface MaintenanceCreatePayload {
  asset: number;

  type?: "maintenance" | "repair" | "disposal";
  record_type?: "maintenance" | "repair" | "disposal";

  title?: string | null;
  description?: string | null;
  notes?: string | null;

  performed_at?: string | null;
  scheduled_date?: string | null;
  due_date?: string | null;
  maintenance_date?: string | null;
  repair_date?: string | null;
  disposal_date?: string | null;
  completed_at?: string | null;

  next_due_date?: string | null;
  next_maintenance_due_date?: string | null;
  frequency_days?: number | string | null;

  cost?: number | string | null;
  vendor?: string | null;
  performed_by?: string | null;

  asset_status_after?: string | null;
}

export interface PaginatedMaintenanceResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}