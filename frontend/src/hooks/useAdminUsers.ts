import { useQuery } from "@tanstack/react-query";
import { getAdminUserDetail, getAdminUsersTable } from "../api/adminUsers";
import type { TableQueryState } from "../types/table";

export function adminUsersQueryKey(state: TableQueryState) {
  return ["admin-console", "users", state] as const;
}

export function adminUserDetailQueryKey(userId?: number | null) {
  return ["admin-console", "users", "detail", userId] as const;
}

export function useAdminUsersTable(state: TableQueryState) {
  return useQuery({
    queryKey: adminUsersQueryKey(state),
    queryFn: () => getAdminUsersTable(state),
    staleTime: 30_000,
  });
}

export function useAdminUserDetail(userId?: number | null) {
  return useQuery({
    queryKey: adminUserDetailQueryKey(userId),
    queryFn: () => getAdminUserDetail(Number(userId)),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}
