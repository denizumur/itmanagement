import { buildTableApiParams } from "../lib/tableQuery";
import type { TableQueryState } from "../types/table";
import { api } from "./http";
import type {
  Assignment,
  AssignmentCreatePayload,
  AssignmentReturnPayload,
  AssignmentSummary,
  PaginatedAssignmentResponse,
} from "../types/assignments";

const ASSIGNMENTS_ENDPOINT = "/api/assignments/";

function extractResults<T>(responseData: T[] | PaginatedAssignmentResponse<T>) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  return responseData.results;
}

function cleanAssignmentPayload(payload: AssignmentCreatePayload) {
  return {
    asset: payload.asset,
    employee: payload.employee,
    ...(payload.assigned_at ? { assigned_at: payload.assigned_at } : {}),
    notes: payload.notes?.trim() || "",
  };
}

function cleanReturnPayload(payload: AssignmentReturnPayload = {}) {
  const returnedAt = payload.returned_at || payload.return_date || undefined;

  return {
    ...(returnedAt
      ? {
          returned_at: returnedAt,
          return_date: returnedAt,
        }
      : {}),
    return_notes: payload.return_notes?.trim() || "",
    notes: payload.notes?.trim() || "",
  };
}

export async function getAssignments() {
  const response = await api.get<
    Assignment[] | PaginatedAssignmentResponse<Assignment>
  >(ASSIGNMENTS_ENDPOINT);

  return extractResults(response.data);
}

export async function getAssignmentsTable(state: TableQueryState) {
  const response = await api.get<PaginatedAssignmentResponse<Assignment>>(
    `${ASSIGNMENTS_ENDPOINT}table/`,
    {
      params: buildTableApiParams(state),
    }
  );

  return response.data;
}

export async function getAssignmentSummary() {
  const response = await api.get<AssignmentSummary>(
    `${ASSIGNMENTS_ENDPOINT}summary/`
  );

  return response.data;
}

export async function getActiveAssignments() {
  const response = await api.get<
    Assignment[] | PaginatedAssignmentResponse<Assignment>
  >(`${ASSIGNMENTS_ENDPOINT}active/`);

  return extractResults(response.data);
}

export async function createAssignment(payload: AssignmentCreatePayload) {
  const response = await api.post<Assignment>(
    ASSIGNMENTS_ENDPOINT,
    cleanAssignmentPayload(payload)
  );

  return response.data;
}

export async function returnAssignment(
  id: number,
  payload: AssignmentReturnPayload = {}
) {
  const response = await api.post<Assignment>(
    `${ASSIGNMENTS_ENDPOINT}${id}/return/`,
    cleanReturnPayload(payload)
  );

  return response.data;
}