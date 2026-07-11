import { api } from "./http";
import type { Employee, PaginatedEmployeeResponse } from "../types/employees";

const EMPLOYEES_ENDPOINT = "/api/employees/";

function extractResults<T>(responseData: T[] | PaginatedEmployeeResponse<T>) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  return responseData.results;
}

export async function getEmployees() {
  const response = await api.get<
    Employee[] | PaginatedEmployeeResponse<Employee>
  >(EMPLOYEES_ENDPOINT);

  return extractResults(response.data);
}