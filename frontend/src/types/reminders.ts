import type { PaginatedApiResponse } from "./api";

export type ReminderSourceType =
  | "warranty"
  | "maintenance"
  | "license"
  | "ticket_sla";

export type ReminderStatus = "pending" | "sent" | "dismissed" | "cancelled";

export type ReminderChannel = "in_app" | "email";

export type ReminderTimeStatus =
  | "overdue"
  | "today"
  | "next_7_days"
  | "next_30_days"
  | "snoozed_today"
  | "future";

export type Reminder = {
  id: number;
  source_type: ReminderSourceType;
  source_type_label?: string | null;
  source_id: number;
  title: string;
  message: string;
  due_date: string;
  threshold_days: number;
  scheduled_for: string;
  channel: ReminderChannel;
  channel_label?: string | null;
  status: ReminderStatus;
  status_label?: string | null;
  notified_at?: string | null;
  dismissed_at?: string | null;
  cancelled_at?: string | null;
  snoozed_until?: string | null;
  snoozed_at?: string | null;
  metadata?: Record<string, unknown> | null;
  is_due_to_show: boolean;
  days_until_due: number;
  is_snoozed_today: boolean;
  is_visible_today: boolean;
  created_by?: number | null;
  created_by_username?: string | null;
  created_at: string;
  updated_at: string;
};

export type ReminderFilters = {
  source_type?: string;
  status?: string;
  channel?: string;
  visible?: string;
  snoozed_today?: string;
  time_status?: string;
  due_before?: string;
  due_after?: string;
  scheduled_before?: string;
  scheduled_after?: string;
};

export type ReminderSummary = {
  total: number;
  pending: number;
  visible_pending: number;
  sent: number;
  dismissed: number;
  cancelled: number;
  snoozed_today: number;
  overdue_due_date: number;
  due_today: number;
  upcoming_7_days: number;
  upcoming_30_days: number;
  by_source_type: Array<{
    source_type: string;
    count: number;
  }>;
  by_status: Array<{
    status: string;
    count: number;
  }>;
  by_channel: Array<{
    channel: string;
    count: number;
  }>;
};

export type ReminderGeneratePayload = {
  channel: ReminderChannel;
};

export type PaginatedReminderResponse<T> = PaginatedApiResponse<T>;