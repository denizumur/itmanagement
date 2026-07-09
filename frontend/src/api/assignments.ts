import { api } from "./http";
import type {
  Assignment,
  PaginatedAssignmentResponse,
} from "../types/assignments";

function extractResults<T>(responseData: T[] | PaginatedAssignmentResponse<T>) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  return responseData.results;
}

export async function getActiveAssignments() {
  const response = await api.get<
    Assignment[] | PaginatedAssignmentResponse<Assignment>
  >("/api/assignments/active/");

  return extractResults(response.data);
}