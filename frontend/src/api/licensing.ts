import { buildTableApiParams } from "../lib/tableQuery";
import type { PaginatedApiResponse } from "../types/api";
import type { TableQueryState } from "../types/table";
import { api } from "./http";
import type {
  LicenseSubscription,
  LicenseSubscriptionFilters,
  LicenseSubscriptionPayload,
  LicenseSubscriptionSummary,
} from "../types/licensing";

const LICENSES_ENDPOINT = "/api/licensing/subscriptions/";

function cleanParams(filters?: LicenseSubscriptionFilters) {
  if (!filters) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== ""
    )
  );
}

export async function getLicenseSubscriptions(
  filters?: LicenseSubscriptionFilters
) {
  const response = await api.get<LicenseSubscription[]>(LICENSES_ENDPOINT, {
    params: cleanParams(filters),
  });

  return response.data;
}

export async function getLicenseSubscriptionsTable(state: TableQueryState) {
  const response = await api.get<PaginatedApiResponse<LicenseSubscription>>(
    `${LICENSES_ENDPOINT}table/`,
    {
      params: buildTableApiParams(state),
    }
  );

  return response.data;
}

export async function getLicenseSubscriptionSummary() {
  const response = await api.get<LicenseSubscriptionSummary>(
    `${LICENSES_ENDPOINT}summary/`
  );

  return response.data;
}

export async function getExpiredLicenseSubscriptions() {
  const response = await api.get<LicenseSubscription[]>(
    `${LICENSES_ENDPOINT}expired/`
  );

  return response.data;
}

export async function getUpcomingLicenseSubscriptions(days = 30) {
  const response = await api.get<LicenseSubscription[]>(
    `${LICENSES_ENDPOINT}upcoming/`,
    {
      params: { days },
    }
  );

  return response.data;
}

export async function createLicenseSubscription(
  payload: LicenseSubscriptionPayload
) {
  const response = await api.post<LicenseSubscription>(
    LICENSES_ENDPOINT,
    cleanLicensePayload(payload)
  );

  return response.data;
}

export async function updateLicenseSubscription(
  id: number,
  payload: Partial<LicenseSubscriptionPayload>
) {
  const response = await api.patch<LicenseSubscription>(
    `${LICENSES_ENDPOINT}${id}/`,
    cleanLicensePayload(payload)
  );

  return response.data;
}

export async function deleteLicenseSubscription(id: number) {
  await api.delete(`${LICENSES_ENDPOINT}${id}/`);
}

export async function restoreLicenseSubscription(id: number) {
  const response = await api.post<LicenseSubscription>(
    `${LICENSES_ENDPOINT}${id}/restore/`
  );

  return response.data;
}

function cleanLicensePayload(
  payload: Partial<LicenseSubscriptionPayload>
): Partial<LicenseSubscriptionPayload> {
  return {
    ...payload,
    tracking_code: payload.tracking_code || null,
    vendor: payload.vendor || "",
    license_key_masked: payload.license_key_masked || "",
    assigned_asset: payload.assigned_asset || null,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    renewal_cost:
      payload.renewal_cost === "" || payload.renewal_cost === undefined
        ? null
        : payload.renewal_cost,
    notes: payload.notes || "",
  };
}