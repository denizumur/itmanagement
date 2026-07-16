import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createMaintenanceRecord,
  getMaintenanceRecords,
  getMaintenanceRecordsByAsset,
  getMaintenanceRecordsTable,
  getMaintenanceSummary,
  getOverdueMaintenanceRecords,
  getUpcomingMaintenanceRecords,
} from "../api/maintenance";
import type { TableQueryState } from "../types/table";
import type {
  MaintenanceCreatePayload,
  MaintenanceFilters,
} from "../types/maintenance";

export function useMaintenanceRecords(filters: MaintenanceFilters = {}) {
  return useQuery({
    queryKey: ["maintenance", "records", filters],
    queryFn: () => getMaintenanceRecords(filters),
    staleTime: 45_000,
  });
}

export function useMaintenanceTable(state: TableQueryState) {
  return useQuery({
    queryKey: ["maintenance", "records-table", state],
    queryFn: () => getMaintenanceRecordsTable(state),
    placeholderData: keepPreviousData,
    staleTime: 45_000,
  });
}

export function useMaintenanceSummary() {
  return useQuery({
    queryKey: ["maintenance", "summary"],
    queryFn: getMaintenanceSummary,
    staleTime: 45_000,
  });
}

export function useUpcomingMaintenanceRecords() {
  return useQuery({
    queryKey: ["maintenance", "upcoming"],
    queryFn: getUpcomingMaintenanceRecords,
    staleTime: 45_000,
  });
}

export function useOverdueMaintenanceRecords() {
  return useQuery({
    queryKey: ["maintenance", "overdue"],
    queryFn: getOverdueMaintenanceRecords,
    staleTime: 45_000,
  });
}

export function useMaintenanceRecordsByAsset(assetId?: number | null) {
  return useQuery({
    queryKey: ["maintenance", "by-asset", assetId],
    queryFn: () => getMaintenanceRecordsByAsset(Number(assetId)),
    enabled: Boolean(assetId),
    staleTime: 45_000,
  });
}

export function useCreateMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MaintenanceCreatePayload) =>
      createMaintenanceRecord(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["maintenance"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["inventory"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["dashboard"],
      });
    },
  });
}