import { useQuery } from "@tanstack/react-query";
import {
  getAssetCategories,
  getAssets,
  getAssetSummary,
} from "../api/inventory";
import type { AssetFilters } from "../types/inventory";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAsset, updateAsset } from "../api/inventory";
import type { AssetFormPayload } from "../types/inventory";



export function useAssets(filters: AssetFilters) {
  return useQuery({
    queryKey: ["inventory", "assets", filters],
    queryFn: () => getAssets(filters),
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
