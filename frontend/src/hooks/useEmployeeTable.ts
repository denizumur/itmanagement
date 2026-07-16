import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getEmployeesTable } from "../api/employees";
import type { TableQueryState } from "../types/table";

export function useEmployeeTable(state: TableQueryState) {
  return useQuery({
    queryKey: ["employees-table", state],
    queryFn: () => getEmployeesTable(state),
    placeholderData: keepPreviousData,
  });
}