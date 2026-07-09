import { api } from "./http";
import type { DashboardOverview } from "../types/dashboard";

export async function getDashboardOverview() {
  const response = await api.get<DashboardOverview>("/api/dashboard/overview/");
  return response.data;
}