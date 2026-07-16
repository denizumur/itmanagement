import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  cancelReminder,
  dismissReminder,
  generateReminders,
  getReminderSummary,
  getReminders,
  getRemindersTable,
  markReminderSent,
  snoozeReminderToday,
} from "../api/reminders";
import type { TableQueryState } from "../types/table";
import type { ReminderFilters, ReminderGeneratePayload } from "../types/reminders";

export function useReminders(filters?: ReminderFilters) {
  return useQuery({
    queryKey: ["reminders", "list", filters],
    queryFn: () => getReminders(filters),
    staleTime: 45_000,
  });
}

export function useRemindersTable(state: TableQueryState) {
  return useQuery({
    queryKey: ["reminders", "table", state],
    queryFn: () => getRemindersTable(state),
    placeholderData: keepPreviousData,
    staleTime: 45_000,
  });
}

export function useReminderSummary(filters?: ReminderFilters) {
  return useQuery({
    queryKey: ["reminders", "summary", filters],
    queryFn: () => getReminderSummary(filters),
    staleTime: 45_000,
  });
}

export function useGenerateReminders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: ReminderGeneratePayload) =>
      generateReminders(payload ?? { channel: "in_app" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useSnoozeReminderToday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => snoozeReminderToday(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDismissReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => dismissReminder(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useCancelReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => cancelReminder(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkReminderSent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => markReminderSent(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}