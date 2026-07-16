import { buildTableApiParams } from "../lib/tableQuery";
import type { TableQueryState } from "../types/table";
import { api } from "./http";
import type {
  PaginatedReminderResponse,
  Reminder,
  ReminderFilters,
  ReminderGeneratePayload,
  ReminderSummary,
} from "../types/reminders";

const REMINDERS_ENDPOINT = "/api/reminders/";

function cleanParams(filters?: ReminderFilters) {
  if (!filters) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) =>
        value !== undefined && value !== null && value !== "" && value !== "all"
    )
  );
}

export async function getReminders(filters?: ReminderFilters) {
  const response = await api.get<Reminder[]>(REMINDERS_ENDPOINT, {
    params: cleanParams(filters),
  });

  return response.data;
}

export async function getRemindersTable(state: TableQueryState) {
  const response = await api.get<PaginatedReminderResponse<Reminder>>(
    `${REMINDERS_ENDPOINT}table/`,
    {
      params: buildTableApiParams(state),
    }
  );

  return response.data;
}

export async function getReminderSummary(filters?: ReminderFilters) {
  const response = await api.get<ReminderSummary>(
    `${REMINDERS_ENDPOINT}summary/`,
    {
      params: cleanParams(filters),
    }
  );

  return response.data;
}

export async function generateReminders(
  payload: ReminderGeneratePayload = { channel: "in_app" }
) {
  const response = await api.post(`${REMINDERS_ENDPOINT}generate/`, payload);

  return response.data;
}

export async function snoozeReminderToday(id: number) {
  const response = await api.post<Reminder>(
    `${REMINDERS_ENDPOINT}${id}/snooze_today/`
  );

  return response.data;
}

export async function dismissReminder(id: number) {
  const response = await api.post<Reminder>(`${REMINDERS_ENDPOINT}${id}/dismiss/`);

  return response.data;
}

export async function cancelReminder(id: number) {
  const response = await api.post<Reminder>(`${REMINDERS_ENDPOINT}${id}/cancel/`);

  return response.data;
}

export async function markReminderSent(id: number) {
  const response = await api.post<Reminder>(
    `${REMINDERS_ENDPOINT}${id}/mark_sent/`
  );

  return response.data;
}