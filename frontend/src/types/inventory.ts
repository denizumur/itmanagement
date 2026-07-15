import type { PaginatedApiResponse } from "./api";

export type AssetStatus =
  | "active"
  | "assigned"
  | "in_stock"
  | "in_repair"
  | "faulty"
  | "retired"
  | "disposed"
  | "lost"
  | string;

export interface AssetCategory {
  id: number;
  name: string;
  description?: string | null;
}

export interface Asset {
  id: number;
  name: string;
  inventory_code?: string | null;
  serial_number?: string | null;
  display_identifier?: string | null;

  brand?: string | null;
  model?: string | null;

  category?: AssetCategory | string | number | null;
  category_id?: number | null;
  category_name?: string | null;
  category_display?: string | null;
  category_detail?: AssetCategory | null;

  status: AssetStatus;
  status_display?: string | null;
  status_label?: string | null;

  location?: string | null;
  ip_address?: string | null;
  mac_address?: string | null;

  purchase_date?: string | null;
  purchase_price?: string | null;
  warranty_end_date?: string | null;
  is_warranty_expired?: boolean;

  maintenance_enabled?: boolean;
  maintenance_frequency_days?: number | null;
  next_maintenance_due_date?: string | null;
  is_maintenance_overdue?: boolean;

  vendor_name?: string | null;
  notes?: string | null;
  custom_fields?: Record<string, unknown>;

  created_by?: number | null;
  created_by_username?: string | null;
  updated_by?: number | null;
  updated_by_username?: string | null;

  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

export interface AssetSummary {
  total_assets?: number;
  total?: number;
  count?: number;

  active_assets?: number;
  assigned_assets?: number;
  in_stock_assets?: number;
  in_repair_assets?: number;
  faulty_assets?: number;
  disposed_assets?: number;
  lost_assets?: number;

  active?: number;
  assigned?: number;
  in_stock?: number;
  in_repair?: number;
  faulty?: number;
  disposed?: number;
  lost?: number;

  status_counts?: Array<{
    status?: string;
    key?: string;
    label?: string;
    count: number;
  }>;

  asset_status_counts?: Array<{
    status?: string;
    key?: string;
    label?: string;
    count: number;
  }>;

  by_status?: Record<string, number>;

  maintenance_overdue?: number;
  maintenance_upcoming_30_days?: number;
  warranty_expired?: number;
  warranty_upcoming_30_days?: number;

  [key: string]: unknown;
}

export interface AssetFilters {
  search?: string;
  status?: string;
  category?: string;
}

export type PaginatedResponse<T> = PaginatedApiResponse<T>;

export interface AssetFormPayload {
  name: string;
  inventory_code?: string | null;
  serial_number?: string | null;
  brand?: string | null;
  model?: string | null;
  category?: number | null;
  status?: string;
  purchase_date?: string | null;
  warranty_end_date?: string | null;
  next_maintenance_due_date?: string | null;
  location?: string | null;
  notes?: string | null;
}