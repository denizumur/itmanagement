import type { PaginatedApiResponse } from "./api";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "assign"
  | "return"
  | "dispose"
  | "status_change"
  | "export"
  | "login"
  | "logout"
  | "other"
  | string;

export interface AuditLogListItem {
  id: number;
  actor: number | null;
  actor_name: string;
  actor_username?: string | null;
  action: AuditAction;
  action_label: string;
  entity_type: string;
  entity_type_label: string;
  entity_id: string;
  entity_repr: string;
  module?: string | null;
  operation?: string | null;
  request_method?: string | null;
  request_path?: string | null;
  ip_address?: string | null;
  created_at: string;
  has_changes: boolean;
  changes_count: number;
  is_critical: boolean;
}

export interface AuditLogChange {
  before: unknown;
  after: unknown;
}

export type AuditLogChanges = Record<string, AuditLogChange>;

export interface AuditLogDetail extends AuditLogListItem {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changes: AuditLogChanges;
  metadata: Record<string, unknown>;
  user_agent?: string | null;
}

export interface AuditEntitySummary {
  entity_type: string;
  label: string;
  count: number;
}

export interface AuditCriticalSummary {
  delete: number;
  restore: number;
  export: number;
  dispose: number;
  cancel: number;
  total: number;
}

export interface AuditLogSummary {
  total: number;
  by_entity_type: AuditEntitySummary[];
  by_action: Record<string, number>;
  critical: AuditCriticalSummary;
  critical_actions: string[];
}

export type PaginatedAuditLogResponse = PaginatedApiResponse<AuditLogListItem>;