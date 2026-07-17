import { buildTableApiParams } from "../lib/tableQuery";
import type {
  AuditLogDetail,
  AuditLogSummary,
  PaginatedAuditLogResponse,
} from "../types/audit";
import type { TableQueryState } from "../types/table";
import { api } from "./http";

const AUDIT_LOGS_ENDPOINT = "/api/audit/logs/";
const AUDIT_LOG_SUMMARY_ENDPOINT = "/api/audit/logs/summary/";

export async function getAuditLogsTable(state: TableQueryState) {
  const response = await api.get<PaginatedAuditLogResponse>(AUDIT_LOGS_ENDPOINT, {
    params: buildTableApiParams(state),
  });

  return response.data;
}

export async function getAuditLogDetail(auditLogId: number) {
  const response = await api.get<AuditLogDetail>(
    `${AUDIT_LOGS_ENDPOINT}${auditLogId}/`
  );

  return response.data;
}

export async function getAuditLogSummary() {
  const response = await api.get<AuditLogSummary>(AUDIT_LOG_SUMMARY_ENDPOINT);

  return response.data;
}