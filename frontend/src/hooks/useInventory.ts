import { useQuery } from "@tanstack/react-query";
import {
  getAssetCategories,
  getAssets,
  getAssetSummary,
} from "../api/inventory";
import type { AssetFilters } from "../types/inventory";

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