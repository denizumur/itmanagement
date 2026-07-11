export type AssetStatus =
  | "active"
  | "assigned"
  | "in_stock"
  | "in_repair"
  | "faulty"
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
  brand?: string | null;
  model?: string | null;

  category?: AssetCategory | string | number | null;
  category_id?: number | null;
  category_name?: string | null;
  category_display?: string | null;
  category_detail?: AssetCategory | null;

  status: AssetStatus;
  status_display?: string | null;

  purchase_date?: string | null;
  warranty_end_date?: string | null;
  next_maintenance_due_date?: string | null;
  location?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
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

  [key: string]: unknown;
}

export interface AssetFilters {
  search?: string;
  status?: string;
  category?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
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