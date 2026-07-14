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