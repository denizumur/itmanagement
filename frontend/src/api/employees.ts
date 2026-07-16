import { buildTableApiParams } from "../lib/tableQuery";
import type { PaginatedApiResponse } from "../types/api";
import type { Employee, PaginatedEmployeeResponse } from "../types/employees";
import type { TableQueryState } from "../types/table";
import { api } from "./http";

const EMPLOYEES_ENDPOINT = "/api/employees/";
const EMPLOYEES_TABLE_ENDPOINT = "/api/employees/table/";

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

export async function getEmployeesTable(state: TableQueryState) {
  const response = await api.get<PaginatedApiResponse<Employee>>(
    EMPLOYEES_TABLE_ENDPOINT,
    {
      params: buildTableApiParams(state),
    }
  );

  return response.data;
}