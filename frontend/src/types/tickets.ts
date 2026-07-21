import type { PaginatedApiResponse } from "./api";

export type TicketStatus =
  | "open"
  | "in_progress"
  | "returned_to_requester"
  | "resolved"
  | "closed";

export type TicketPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

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
  resolution_note: string;
  resolved_by: number | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  closed_by: number | null;
  closed_by_name: string | null;
  closed_at: string | null;
  comments_count: number;
  attachments_count: number;
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

export interface TicketStatusUpdatePayload {
  ticketId: number;
  status: TicketStatus;
  solution_note?: string;
}
export interface TicketReturnToRequesterPayload {
  comment: string;
}
export interface TicketResolutionReopenPayload {
  reason: string;
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
  decision_note: string;
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

export interface TicketAttachment {
  id: number;
  ticket: number;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: number | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  download_url: string;
}

export interface TicketAttachmentUploadPayload {
  ticketId: number;
  file: File;
}

export interface TicketSummary {
  total: number;
  open: number;
  in_progress: number;
  returned_to_requester: number;
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

export interface RequesterContextNamedObject {
  id: number;
  name?: string;
  full_name?: string;
  email?: string | null;
}

export interface RequesterContextEmployee {
  id: number;
  full_name: string;
  email: string | null;
  phone?: string | null;
  employee_code?: string | null;
  department: RequesterContextNamedObject | null;
  job_title: RequesterContextNamedObject | null;
  manager: RequesterContextNamedObject | null;
  is_active?: boolean;
}

export interface RequesterContextAssignment {
  id: number;
  asset_id: number;
  asset_name: string;
  asset_inventory_code: string | null;
  asset_serial_number: string | null;
  asset_category: string | null;
  asset_status: string | null;
  asset_status_label: string | null;
  asset_display_identifier: string | null;
  assigned_at: string;
}

export interface TicketRequesterApprovalPreview {
  requires_approval: boolean;
  approver_name: string | null;
  approver_email: string | null;
  approver_role: string | null;
}

export interface TicketAttachmentLimits {
  max_file_size_bytes: number;
  max_file_size_mb: number;
  max_files_per_ticket: number;
  allowed_mime_types: string[];
}

export interface TicketRequesterContext {
  employee: RequesterContextEmployee;
  active_assignments: RequesterContextAssignment[];
  approval_preview: TicketRequesterApprovalPreview;
  limits: TicketAttachmentLimits;
}

export interface TicketContextAsset {
  id: number;
  name: string;
  brand?: string | null;
  model?: string | null;
  inventory_code: string | null;
  serial_number: string | null;
  display_identifier: string | null;
  category: string | null;
  status: string | null;
  status_label: string | null;
  location?: string | null;
  ip_address?: string | null;
  mac_address?: string | null;
  warranty_end_date?: string | null;
  next_maintenance_due_date?: string | null;
}

export interface TicketContextAssignment {
  id: number;
  asset: TicketContextAsset;
  employee: {
    id: number;
    full_name: string;
    email: string | null;
  };
  assigned_at: string;
  returned_at: string | null;
  is_active: boolean;
}

export interface TicketContextRecentTicket {
  id: number;
  title: string;
  status: TicketStatus;
  status_label: string;
  priority: TicketPriority;
  priority_label: string;
  approval_status: TicketApprovalStatus;
  approval_status_label: string;
  category: TicketCategory;
  category_label: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface TicketContextApprovalItem {
  id: number;
  approver: {
    id: number;
    full_name: string;
    email: string | null;
  };
  approver_user: {
    id: number;
    username: string;
    display_name: string | null;
  } | null;
  requested_by: {
    id: number;
    username: string;
    display_name: string | null;
  } | null;
  status: "pending" | "approved" | "rejected";
  status_label: string;
  decision_note: string;
  requested_at: string;
  decided_at: string | null;
}

export interface TicketContextActions {
  can_view_context: boolean;
  can_update_status: boolean;
  can_assign_ticket: boolean;
  can_return_to_requester: boolean;
  can_add_public_reply: boolean;
  can_add_internal_note: boolean;
  can_upload_attachment: boolean;
  can_download_attachment: boolean;
  can_view_internal_notes: boolean;
  is_read_only: boolean;
  blocked_reason: string | null;
}

export interface TicketContext {
  ticket: Ticket;
  requester: RequesterContextEmployee;
  asset: TicketContextAsset | null;
  active_assignments: TicketContextAssignment[];
  requester_recent_tickets: TicketContextRecentTicket[];
  asset_recent_tickets: TicketContextRecentTicket[];
  approval: {
    status: TicketApprovalStatus;
    status_label: string;
    pending: TicketContextApprovalItem | null;
    history: TicketContextApprovalItem[];
  };
  comments_summary: {
    total: number;
    public: number;
    internal: number;
  };
  attachments_summary: {
    total: number;
    latest: TicketAttachment[];
    limits: TicketAttachmentLimits;
  };
  transition_rules: {
    allowed_statuses: TicketStatus[];
    requires_solution_note_for: TicketStatus[];
  };
  actions: TicketContextActions;
}
export type TicketTimelineItemType =
  | "ticket_created"
  | "approval_requested"
  | "approval_approved"
  | "approval_rejected"
  | "system_auto_closed_resolution"
  | "status_changed"
  | "assigned_changed"
  | "requester_resubmitted"
  | "requester_confirmed_resolution"
  | "requester_reopened_resolution"
  | "it_returned_to_requester"
  | "public_comment_added"
  | "internal_note_added"
  | "solution_note_added"
  | "attachment_uploaded";

export type TicketTimelineTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export interface TicketTimelineItem {
  id: string;
  type: TicketTimelineItemType;
  title: string;
  description: string;
  actor_name: string;
  created_at: string;
  tone: TicketTimelineTone;
  source: string;
  metadata: Record<string, unknown>;
}

export type TicketTimelineStageName =
  | "created"
  | "approval"
  | "it_review"
  | "resolved";

export type TicketTimelineStageState =
  | "done"
  | "approved"
  | "rejected"
  | "pending"
  | "skipped"
  | "in_progress"
  | "returned"
  | "resolved";

export interface TicketTimelineStage {
  id: string;
  stage: TicketTimelineStageName;
  label: string;
  state: TicketTimelineStageState;
  actor: string | null;
  actor_name: string | null;
  timestamp: string | null;
  created_at: string | null;
  comment: string | null;
  round: number;
  metadata: Record<string, unknown>;
}

export interface TicketTimelineResponse {
  ticket: number;
  current_status: TicketStatus;
  current_status_label: string;
  current_approval_status: TicketApprovalStatus;
  current_approval_status_label: string;
  stages: TicketTimelineStage[];
  items: TicketTimelineItem[];
}
export type PaginatedTicketResponse<T> = PaginatedApiResponse<T>;