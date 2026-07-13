import { api } from "./http";
import type {
  Asset,
  AssetCategory,
  AssetFilters,
  AssetFormPayload,
  AssetSummary,
  PaginatedResponse,
} from "../types/inventory";

function extractResults<T>(responseData: T[] | PaginatedResponse<T>) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  return responseData.results;
}

export async function getAssets(filters: AssetFilters = {}) {
  const response = await api.get<Asset[] | PaginatedResponse<Asset>>(
    "/api/inventory/assets/",
    {
      params: {
        search: filters.search || undefined,
        status: filters.status || undefined,
        category: filters.category || undefined,
      },
    }
  );

  return extractResults(response.data);
}

export async function getAssetSummary() {
  const response = await api.get<AssetSummary>("/api/inventory/assets/summary/");
  return response.data;
}

export async function getAssetCategories() {
  const response = await api.get<
    AssetCategory[] | PaginatedResponse<AssetCategory>
  >("/api/inventory/categories/");

  return extractResults(response.data);
}

export type CreateAssetWithAssignmentPayload = {
  asset: AssetFormPayload;
  assignment: {
    employee: number;
    assigned_at?: string | null;
    notes?: string | null;
  };
};

export type CreateAssetWithAssignmentResponse = {
  asset: Asset;
  assignment: unknown;
};

function cleanAssetPayload(payload: AssetFormPayload) {
  return {
    ...payload,
    inventory_code: payload.inventory_code || null,
    serial_number: payload.serial_number || null,
    brand: payload.brand || null,
    model: payload.model || null,
    category: payload.category || null,
    purchase_date: payload.purchase_date || null,
    warranty_end_date: payload.warranty_end_date || null,
    next_maintenance_due_date: payload.next_maintenance_due_date || null,
    location: payload.location || null,
    notes: payload.notes || null,
  };
}

export async function createAsset(payload: AssetFormPayload) {
  const response = await api.post<Asset>(
    "/api/inventory/assets/",
    cleanAssetPayload(payload)
  );

  return response.data;
}

export async function updateAsset(id: number, payload: AssetFormPayload) {
  const response = await api.patch<Asset>(
    `/api/inventory/assets/${id}/`,
    cleanAssetPayload(payload)
  );

  return response.data;
}
export async function createAssetWithAssignment(
  payload: CreateAssetWithAssignmentPayload
) {
  const response = await api.post<CreateAssetWithAssignmentResponse>(
    "/api/inventory/assets/create-with-assignment/",
    {
      asset: cleanAssetPayload(payload.asset),
      assignment: {
        employee: payload.assignment.employee,
        assigned_at: payload.assignment.assigned_at || undefined,
        notes: payload.assignment.notes || "",
      },
    }
  );

  return response.data;
}