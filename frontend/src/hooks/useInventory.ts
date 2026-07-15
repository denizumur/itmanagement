import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAsset,
  createAssetWithAssignment,
  getAssetCategories,
  getAssets,
  getAssetsTable,
  getAssetSummary,
  updateAsset,
} from "../api/inventory";
import type { AssetFilters, AssetFormPayload } from "../types/inventory";
import type { TableQueryState } from "../types/table";

export function useCreateAssetWithAssignment() {
  return useMutation({
    mutationFn: createAssetWithAssignment,
  });
}

export function useAssets(filters: AssetFilters) {
  return useQuery({
    queryKey: ["inventory", "assets", filters],
    queryFn: () => getAssets(filters),
    staleTime: 45_000,
  });
}

export function useAssetTable(state: TableQueryState) {
  return useQuery({
    queryKey: ["inventory", "assets-table", state],
    queryFn: () => getAssetsTable(state),
    placeholderData: keepPreviousData,
    staleTime: 45_000,
  });
}

export function useAssetSummary() {
  return useQuery({
    queryKey: ["inventory", "assets", "summary"],
    queryFn: getAssetSummary,
    staleTime: 60_000,
  });
}

export function useAssetCategories() {
  return useQuery({
    queryKey: ["inventory", "categories"],
    queryFn: getAssetCategories,
    staleTime: 5 * 60_000,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAsset,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: AssetFormPayload;
    }) => updateAsset(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}