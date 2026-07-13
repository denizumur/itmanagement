export type LicenseType = "license" | "subscription";

export type LicenseBillingCycle = "one_time" | "monthly" | "yearly" | "other";

export interface LicenseSubscription {
  id: number;
  name: string;
  tracking_code?: string | null;
  type: LicenseType;
  type_label?: string | null;
  vendor?: string | null;
  license_key_masked?: string | null;
  seat_count: number;
  assigned_asset?: number | null;
  assigned_asset_name?: string | null;
  assigned_asset_inventory_code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  renewal_cost?: string | number | null;
  billing_cycle: LicenseBillingCycle;
  billing_cycle_label?: string | null;
  auto_renew: boolean;
  is_active: boolean;
  is_expired: boolean;
  days_until_end?: number | null;
  is_expiring_soon_30_days: boolean;
  notes?: string | null;
  created_by?: number | null;
  created_by_username?: string | null;
  updated_by?: number | null;
  updated_by_username?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

export interface LicenseSubscriptionSummary {
  total: number;
  active: number;
  expired: number;
  upcoming_30_days: number;
  auto_renew: number;
  total_seats: number;
  upcoming_30_days_renewal_cost: string | number;
  by_type: Array<{
    type: LicenseType;
    count: number;
  }>;
  by_vendor: Array<{
    vendor: string;
    count: number;
  }>;
}

export type LicenseSubscriptionFilters = {
  search?: string;
  type?: string;
  vendor?: string;
  assigned_asset?: string | number;
  is_active?: string;
  expired?: string;
  upcoming?: string;
  deleted?: string;
  include_deleted?: string;
};

export interface LicenseSubscriptionPayload {
  name: string;
  tracking_code?: string | null;
  type: LicenseType;
  vendor?: string | null;
  license_key_masked?: string | null;
  seat_count: number;
  assigned_asset?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  renewal_cost?: string | number | null;
  billing_cycle: LicenseBillingCycle;
  auto_renew: boolean;
  is_active: boolean;
  notes?: string | null;
}