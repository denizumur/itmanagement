import { api } from "./http";
import type { NotificationCenterResponse } from "../types/notifications";

export async function fetchNotificationCenter() {
  const response = await api.get<NotificationCenterResponse>("/api/notifications/");
  return response.data;
}