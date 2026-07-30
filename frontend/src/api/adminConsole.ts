import type { AdminConsoleOverview } from "../types/adminConsole";
import { api } from "./http";

const ADMIN_CONSOLE_OVERVIEW_ENDPOINT = "/api/admin-console/overview/";

export async function getAdminConsoleOverview() {
  const response = await api.get<AdminConsoleOverview>(
    ADMIN_CONSOLE_OVERVIEW_ENDPOINT
  );

  return response.data;
}
