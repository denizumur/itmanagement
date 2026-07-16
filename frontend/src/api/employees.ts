import { buildTableApiParams } from "../lib/tableQuery";
import type { PaginatedApiResponse } from "../types/api";
import type {
  Employee,
  EmployeeDetailResponse,
  PaginatedEmployeeResponse,
} from "../types/employees";
import type { TableQueryState } from "../types/table";
import { api } from "./http";

const EMPLOYEES_ENDPOINT = "/api/employees/";
const EMPLOYEES_TABLE_ENDPOINT = "/api/employees/table/";
const EMPLOYEES_EXPORT_ENDPOINT = "/api/employees/export/";

function extractResults<T>(responseData: T[] | PaginatedEmployeeResponse<T>) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  return responseData.results;
}

function getExportFileName(contentDisposition?: string) {
  if (!contentDisposition) {
    return "personnel-export.csv";
  }

  const utf8FileNameMatch = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)/i
  );

  if (utf8FileNameMatch?.[1]) {
    return decodeURIComponent(utf8FileNameMatch[1].replace(/"/g, ""));
  }

  const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);

  if (fileNameMatch?.[1]) {
    return fileNameMatch[1];
  }

  return "personnel-export.csv";
}

function triggerFileDownload(blob: Blob, fileName: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();

  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
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

export async function getEmployeeDetail(employeeId: number) {
  const response = await api.get<EmployeeDetailResponse>(
    `/api/employees/${employeeId}/detail/`
  );

  return response.data;
}

export async function downloadEmployeesExport(state: TableQueryState) {
  const response = await api.get<Blob>(EMPLOYEES_EXPORT_ENDPOINT, {
    params: buildTableApiParams(state),
    responseType: "blob",
  });

  const contentDisposition = response.headers["content-disposition"] as
    | string
    | undefined;

  const fileName = getExportFileName(contentDisposition);
  const blob = new Blob([response.data], {
    type: "text/csv;charset=utf-8",
  });

  triggerFileDownload(blob, fileName);
}