export type NotificationSeverity = "normal" | "critical";

export type NotificationType = "ticket" | "ticket_approval" | "reminder";

export type NotificationMetadata = Record<string, unknown>;

export interface NotificationItem {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  urgency_score: number;
  urgency_label: string;
  title: string;
  message: string;
  url: string;
  created_at: string;
  metadata: NotificationMetadata;
}

export interface NotificationCounts {
  normal: number;
  critical: number;
  total: number;
}

export interface NotificationOverview {
  urgent_tickets: NotificationItem[];
  active_tickets: NotificationItem[];
  pending_approvals: NotificationItem[];
  reminders_due_today: NotificationItem[];
  reminders_7_days: NotificationItem[];
  reminders_30_days: NotificationItem[];
}

export interface NotificationPolling {
  interval_seconds?: number;
  normal_interval_seconds?: number;
  critical_interval_seconds?: number;
}

export interface NotificationCenterResponse {
  counts: NotificationCounts;
  items: NotificationItem[];
  normal: NotificationItem[];
  critical: NotificationItem[];
  overview: NotificationOverview;
  polling: NotificationPolling;
}