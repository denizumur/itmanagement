import { buildTableApiParams } from "../lib/tableQuery";
import type {
  AdminUserDetail,
  PaginatedAdminUsersResponse,
} from "../types/adminUsers";
import type { TableQueryState } from "../types/table";
import { api } from "./http";

const ADMIN_USERS_ENDPOINT = "/api/admin-console/users/";

export async function getAdminUsersTable(state: TableQueryState) {
  const response = await api.get<PaginatedAdminUsersResponse>(
    ADMIN_USERS_ENDPOINT,
    {
      params: buildTableApiParams(state),
    }
  );

  return response.data;
}

export async function getAdminUserDetail(userId: number) {
  const response = await api.get<AdminUserDetail>(
    `${ADMIN_USERS_ENDPOINT}${userId}/`
  );

  return response.data;
}
