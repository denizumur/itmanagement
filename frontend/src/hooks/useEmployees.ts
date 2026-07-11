import { useQuery } from "@tanstack/react-query";
import { getEmployees } from "../api/employees";

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: getEmployees,
    staleTime: 60_000,
  });
}