import { useQuery } from "@tanstack/react-query";
import { getAdminConsoleOverview } from "../api/adminConsole";

export function adminConsoleOverviewQueryKey() {
  return ["admin-console", "overview"] as const;
}

export function useAdminConsoleOverview() {
  return useQuery({
    queryKey: adminConsoleOverviewQueryKey(),
    queryFn: getAdminConsoleOverview,
    staleTime: 30_000,
  });
}
