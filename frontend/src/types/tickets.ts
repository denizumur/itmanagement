import type { PaginatedApiResponse } from "./api";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type TicketCategory =
  | "hardware"
  | "software"
  | "access"
  | "network"
  | "other";

export type TicketApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

export interface Ticket {
  id: number;
  employee: number;
  employee_name: string;
  employee_email: string;
  asset: number | null;
  asset_label: string | null;
  title: string;
  description: string;
  category: TicketCategory;
  category_label: string;
  priority: TicketPriority;
  priority_label: string;
  approval_status: TicketApprovalStatus;
  approval_status_label: string;
  pending_approver_name: string | null;
  status: TicketStatus;
  status_label: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by: number | null;
  created_by_name: string | null;
  comments_count: number;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketCreatePayload {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  asset?: number | null;
}

export interface TicketApproval {
  id: number;
  ticket: Ticket;
  approver: number;
  approver_name: string;
  approver_user: number | null;
  approver_username: string | null;
  requested_by: number | null;
  requested_by_username: string | null;
  status: "pending" | "approved" | "rejected";
  status_label: string;
  decision_note: string;
  requested_at: string;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketApprovalDecisionPayload {
  decision_note?: string;
}

export interface TicketComment {
  id: number;
  ticket: number;
  author: number | null;
  author_name: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketCommentCreatePayload {
  body: string;
  is_internal?: boolean;
}

export interface TicketSummary {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  urgent: number;
  high: number;
  high_or_urgent: number;
  pending_approval: number;
  approved_or_not_required_open: number;
}

export interface TicketFilters {
  search?: string;
  status?: TicketStatus | "";
  priority?: TicketPriority | "";
  category?: TicketCategory | "";
  approval_status?: TicketApprovalStatus | "";
}

export type PaginatedTicketResponse<T> = PaginatedApiResponse<T>;