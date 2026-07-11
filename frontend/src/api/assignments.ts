import { api } from "./http";
import type {
  Assignment,
  AssignmentCreatePayload,
  AssignmentReturnPayload,
  PaginatedAssignmentResponse,
} from "../types/assignments";

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
    assigned_at: payload.assigned_at || null,
    notes: payload.notes?.trim() || null,
  };
}

function cleanReturnPayload(payload: AssignmentReturnPayload = {}) {
  return {
    returned_at: payload.returned_at || payload.return_date || null,
    return_date: payload.return_date || payload.returned_at || null,
    return_notes: payload.return_notes?.trim() || null,
    notes: payload.notes?.trim() || null,
  };
}

export async function getAssignments() {
  const response = await api.get<
    Assignment[] | PaginatedAssignmentResponse<Assignment>
  >("/api/assignments/");

  return extractResults(response.data);
}

export async function getActiveAssignments() {
  const response = await api.get<
    Assignment[] | PaginatedAssignmentResponse<Assignment>
  >("/api/assignments/active/");

  return extractResults(response.data);
}

export async function createAssignment(payload: AssignmentCreatePayload) {
  const response = await api.post<Assignment>(
    "/api/assignments/",
    cleanAssignmentPayload(payload)
  );

  return response.data;
}

export async function returnAssignment(
  id: number,
  payload: AssignmentReturnPayload = {}
) {
  const response = await api.post<Assignment>(
    `/api/assignments/${id}/return/`,
    cleanReturnPayload(payload)
  );

  return response.data;
}