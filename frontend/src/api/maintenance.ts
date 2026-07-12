import { api } from "./http";
import type {
  MaintenanceCreatePayload,
  MaintenanceFilters,
  MaintenanceRecord,
  MaintenanceSummary,
  PaginatedMaintenanceResponse,
} from "../types/maintenance";

const MAINTENANCE_RECORDS_ENDPOINT = "/api/maintenance/records/";

function extractResults<T>(responseData: T[] | PaginatedMaintenanceResponse<T>) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  return responseData.results;
}

function cleanParams(filters: MaintenanceFilters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  );
}

function cleanPayload(payload: MaintenanceCreatePayload) {
  return {
    asset: payload.asset,
    type: payload.type ?? payload.record_type,
    performed_at:
      payload.performed_at ||
      payload.maintenance_date ||
      payload.repair_date ||
      payload.disposal_date ||
      null,
    next_due_date:
      payload.next_due_date ||
      payload.due_date ||
      payload.scheduled_date ||
      null,
    frequency_days:
      payload.frequency_days === "" ? null : payload.frequency_days ?? null,
    description: payload.description?.trim() || payload.notes?.trim() || null,
    cost: payload.cost === "" ? null : payload.cost ?? null,
    performed_by: payload.performed_by?.trim() || null,
    asset_status_after:
      "asset_status_after" in payload
        ? String(payload.asset_status_after ?? "")
        : "",
  };
}
export async function getMaintenanceRecords(filters: MaintenanceFilters = {}) {
  const response = await api.get<
    MaintenanceRecord[] | PaginatedMaintenanceResponse<MaintenanceRecord>
  >(MAINTENANCE_RECORDS_ENDPOINT, {
    params: cleanParams(filters),
  });

  return extractResults(response.data);
}

export async function getMaintenanceSummary() {
  const response = await api.get<MaintenanceSummary>(
    `${MAINTENANCE_RECORDS_ENDPOINT}summary/`
  );

  return response.data;
}

export async function getUpcomingMaintenanceRecords() {
  const response = await api.get<
    MaintenanceRecord[] | PaginatedMaintenanceResponse<MaintenanceRecord>
  >(`${MAINTENANCE_RECORDS_ENDPOINT}upcoming/`);

  return extractResults(response.data);
}

export async function getOverdueMaintenanceRecords() {
  const response = await api.get<
    MaintenanceRecord[] | PaginatedMaintenanceResponse<MaintenanceRecord>
  >(`${MAINTENANCE_RECORDS_ENDPOINT}overdue/`);

  return extractResults(response.data);
}

export async function getMaintenanceRecordsByAsset(assetId: number) {
  const response = await api.get<
    MaintenanceRecord[] | PaginatedMaintenanceResponse<MaintenanceRecord>
  >(`${MAINTENANCE_RECORDS_ENDPOINT}by-asset/${assetId}/`);

  return extractResults(response.data);
}

export async function createMaintenanceRecord(payload: MaintenanceCreatePayload) {
  const response = await api.post<MaintenanceRecord>(
    MAINTENANCE_RECORDS_ENDPOINT,
    cleanPayload(payload)
  );

  return response.data;
}