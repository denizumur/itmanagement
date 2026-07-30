import { buildTableApiParams } from "../lib/tableQuery";
import type {
  AdminUserActionPayload,
  AdminUserActionResponse,
  AdminUserDetail,
  AdminUserRoleChangePayload,
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

export async function deactivateAdminUser(
  userId: number,
  payload: AdminUserActionPayload
) {
  const response = await api.post<AdminUserActionResponse>(
    `${ADMIN_USERS_ENDPOINT}${userId}/deactivate/`,
    payload
  );

  return response.data;
}

export async function reactivateAdminUser(
  userId: number,
  payload: AdminUserActionPayload
) {
  const response = await api.post<AdminUserActionResponse>(
    `${ADMIN_USERS_ENDPOINT}${userId}/reactivate/`,
    payload
  );

  return response.data;
}

export async function changeAdminUserRole(
  userId: number,
  payload: AdminUserRoleChangePayload
) {
  const response = await api.post<AdminUserActionResponse>(
    `${ADMIN_USERS_ENDPOINT}${userId}/change-role/`,
    payload
  );

  return response.data;
}
