export type NotificationSeverity = "normal" | "critical";
export type NotificationType = "ticket" | "reminder";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  url: string;
  created_at: string;
  metadata: {
    ticket_id?: number;
    reminder_id?: number;
    status?: string;
    status_label?: string;
    priority?: string;
    priority_label?: string;
    employee_name?: string;
    source_type?: string;
    source_type_label?: string;
    due_date?: string;
    days_until_due?: number;
    threshold_days?: number;
    bucket?: "due_today" | "seven_days" | "thirty_days";
  };
}

export interface NotificationOverview {
  urgent_tickets: NotificationItem[];
  active_tickets: NotificationItem[];
  reminders_due_today: NotificationItem[];
  reminders_7_days: NotificationItem[];
  reminders_30_days: NotificationItem[];
}

export interface NotificationCenterResponse {
  counts: {
    normal: number;
    critical: number;
    total: number;
  };
  normal: NotificationItem[];
  critical: NotificationItem[];
  overview: NotificationOverview;
  polling: {
    normal_interval_seconds: number;
    critical_interval_seconds: number;
  };
}