import { useQuery } from "@tanstack/react-query";
import {
  getAuditLogDetail,
  getAuditLogSummary,
  getAuditLogsTable,
} from "../api/audit";
import type { TableQueryState } from "../types/table";

export function auditLogsQueryKey(state: TableQueryState) {
  return ["audit", "logs", state] as const;
}

export function auditLogDetailQueryKey(auditLogId?: number | null) {
  return ["audit", "logs", "detail", auditLogId] as const;
}

export function auditSummaryQueryKey() {
  return ["audit", "summary"] as const;
}

export function useAuditLogsTable(state: TableQueryState) {
  return useQuery({
    queryKey: auditLogsQueryKey(state),
    queryFn: () => getAuditLogsTable(state),
    staleTime: 30_000,
  });
}

export function useAuditLogDetail(auditLogId?: number | null) {
  return useQuery({
    queryKey: auditLogDetailQueryKey(auditLogId),
    queryFn: () => getAuditLogDetail(Number(auditLogId)),
    enabled: Boolean(auditLogId),
    staleTime: 30_000,
  });
}

export function useAuditLogSummary() {
  return useQuery({
    queryKey: auditSummaryQueryKey(),
    queryFn: getAuditLogSummary,
    staleTime: 30_000,
  });
}