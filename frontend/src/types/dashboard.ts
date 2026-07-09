export type RoleColor = "accent" | "danger" | "warning" | "success";

export interface MetricCardDto {
  key: string;
  label: string;
  value: number;
  role: RoleColor;
  icon: string;
  module_ready?: boolean;
}

export interface UpcomingLicenseDto {
  id: number;
  name: string;
  vendor: string;
  tracking_code: string | null;
  end_date: string;
  days_left: number;
  urgency: "danger" | "warning" | "success";
  renewal_cost: number | string | null;
  auto_renew: boolean;
}

export interface AttentionAssetDto {
  id: number;
  name: string;
  inventory_code: string | null;
  category: string | null;
  flag_type: "maintenance" | "warranty" | string;
  flag_label: string;
  flag_level: "danger" | "warning" | "success";
  date: string;
  days_remaining: number;
}

export interface DashboardOverview {
  generated_at: string;
  period: {
    today: string;
    next_30_days: string;
  };
  metrics: {
    total_assets: number;
    active_assets: number;
    assigned_assets: number;
    in_stock_assets: number;
    in_repair_assets: number;
    faulty_assets: number;
    disposed_assets: number;
    lost_assets: number;
    active_assignments: number;
    maintenance_overdue: number;
    upcoming_maintenance: number;
    warranty_expired: number;
    warranty_upcoming_30_days: number;
    expired_licenses: number;
    licenses_expiring_30_days: number;
    visible_pending_reminders: number;
    open_tickets: number;
  };
  metric_cards: MetricCardDto[];
  asset_status_counts: Array<{
    status: string;
    label: string;
    count: number;
  }>;
  asset_category_distribution: {
    labels: string[];
    counts: number[];
  };
  upcoming_license_list: UpcomingLicenseDto[];
  attention: {
    maintenance_overdue: number;
    warranty_expired: number;
    licenses_expiring_30_days: number;
    visible_pending_reminders: number;
    assets: AttentionAssetDto[];
  };
  reminders: {
    pending: number;
    visible_pending: number;
    by_source_type: Array<{
      source_type: string;
      count: number;
    }>;
  };
}