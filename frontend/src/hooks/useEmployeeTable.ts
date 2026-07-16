import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  downloadEmployeesExport,
  getEmployeeDetail,
  getEmployeesTable,
} from "../api/employees";
import type { TableQueryState } from "../types/table";

export function useEmployeeTable(state: TableQueryState) {
  return useQuery({
    queryKey: ["employees-table", state],
    queryFn: () => getEmployeesTable(state),
    placeholderData: keepPreviousData,
  });
}

export function useEmployeeDetail(employeeId: number | null) {
  return useQuery({
    queryKey: ["employees", "detail", employeeId],
    queryFn: () => getEmployeeDetail(employeeId as number),
    enabled: Boolean(employeeId),
  });
}

export function useEmployeeExport() {
  return useMutation({
    mutationFn: (state: TableQueryState) => downloadEmployeesExport(state),
  });
}