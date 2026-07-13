import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelReminder,
  dismissReminder,
  generateReminders,
  getReminderSummary,
  getReminders,
  markReminderSent,
} from "../api/reminders";
import type { ReminderFilters, ReminderGeneratePayload } from "../types/reminders";

export function useReminders(filters?: ReminderFilters) {
  return useQuery({
    queryKey: ["reminders", "list", filters],
    queryFn: () => getReminders(filters),
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
    },
  });
}