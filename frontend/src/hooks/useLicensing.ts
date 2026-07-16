import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createLicenseSubscription,
  deleteLicenseSubscription,
  getExpiredLicenseSubscriptions,
  getLicenseSubscriptions,
  getLicenseSubscriptionsTable,
  getLicenseSubscriptionSummary,
  getUpcomingLicenseSubscriptions,
  restoreLicenseSubscription,
  updateLicenseSubscription,
} from "../api/licensing";
import type { TableQueryState } from "../types/table";
import type {
  LicenseSubscriptionFilters,
  LicenseSubscriptionPayload,
} from "../types/licensing";

export function useLicenseSubscriptions(filters?: LicenseSubscriptionFilters) {
  return useQuery({
    queryKey: ["licensing", "subscriptions", filters],
    queryFn: () => getLicenseSubscriptions(filters),
    staleTime: 45_000,
  });
}

export function useLicenseSubscriptionTable(state: TableQueryState) {
  return useQuery({
    queryKey: ["licensing", "subscriptions-table", state],
    queryFn: () => getLicenseSubscriptionsTable(state),
    placeholderData: keepPreviousData,
    staleTime: 45_000,
  });
}

export function useLicenseSubscriptionSummary() {
  return useQuery({
    queryKey: ["licensing", "summary"],
    queryFn: getLicenseSubscriptionSummary,
    staleTime: 45_000,
  });
}

export function useExpiredLicenseSubscriptions() {
  return useQuery({
    queryKey: ["licensing", "expired"],
    queryFn: getExpiredLicenseSubscriptions,
    staleTime: 45_000,
  });
}

export function useUpcomingLicenseSubscriptions(days = 30) {
  return useQuery({
    queryKey: ["licensing", "upcoming", days],
    queryFn: () => getUpcomingLicenseSubscriptions(days),
    staleTime: 45_000,
  });
}

export function useCreateLicenseSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LicenseSubscriptionPayload) =>
      createLicenseSubscription(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["licensing"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}

export function useUpdateLicenseSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<LicenseSubscriptionPayload>;
    }) => updateLicenseSubscription(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["licensing"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}

export function useDeleteLicenseSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteLicenseSubscription(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["licensing"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}

export function useRestoreLicenseSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => restoreLicenseSubscription(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["licensing"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}