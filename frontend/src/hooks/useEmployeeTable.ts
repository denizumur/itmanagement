import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  commitEmployeeImport,
  downloadEmployeesExcelExport,
  downloadEmployeesExport,
  dryRunEmployeeImport,
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
    mutationFn: (state: TableQueryState) => downloadEmployeesExcelExport(state),
  });
}

export function useEmployeeCsvExport() {
  return useMutation({
    mutationFn: (state: TableQueryState) => downloadEmployeesExport(state),
  });
}

export function useEmployeeImportDryRun() {
  return useMutation({
    mutationFn: (file: File) => dryRunEmployeeImport(file),
  });
}

export function useEmployeeImportCommit() {
  return useMutation({
    mutationFn: (importId: string) => commitEmployeeImport(importId),
  });
}
