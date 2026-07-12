import type {
  MaintenanceRecord,
  MaintenanceRecordStatus,
  MaintenanceRecordType,
  MaintenanceSummary,
} from "../types/maintenance";

export const maintenanceTypeLabel: Record<string, string> = {
  maintenance: "Bakım",
  repair: "Onarım",
  disposal: "İmha",
};

export const maintenanceTypeVariant: Record<
  string,
  "accent" | "success" | "warning" | "danger" | "neutral"
> = {
  maintenance: "accent",
  repair: "warning",
  disposal: "danger",
};

export const maintenanceStatusLabel: Record<string, string> = {
  planned: "Planlandı",
  in_progress: "Devam ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  overdue: "Gecikmiş",
};

export const maintenanceStatusVariant: Record<
  string,
  "accent" | "success" | "warning" | "danger" | "neutral"
> = {
  planned: "accent",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
  overdue: "danger",
};

function normalizeValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/ /g, "_");
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

export function getMaintenanceRecordType(record: MaintenanceRecord): string {
  return normalizeValue(
    record.type ?? record.record_type ?? record.maintenance_type
  );
}

export function getMaintenanceTypeLabel(record: MaintenanceRecord): string {
  const explicitLabel =
    stringOrNull(record.type_label) ||
    stringOrNull(record.record_type_display) ||
    stringOrNull(record.type_display);

  if (explicitLabel) {
    return explicitLabel;
  }

  const type = getMaintenanceRecordType(record);

  return maintenanceTypeLabel[type] ?? String(type || "Kayıt");
}

export function getMaintenanceTypeVariant(
  record: MaintenanceRecord
): "accent" | "success" | "warning" | "danger" | "neutral" {
  const type = getMaintenanceRecordType(record);

  return maintenanceTypeVariant[type] ?? "neutral";
}

export function getMaintenanceStatus(record: MaintenanceRecord): string {
  if (record.is_overdue === true) {
    return "overdue";
  }

  const explicitStatus = normalizeValue(record.status);

  if (explicitStatus) {
    return explicitStatus;
  }

  return "completed";
}

export function getMaintenanceStatusLabel(record: MaintenanceRecord): string {
  if (record.is_overdue === true) {
    return "Gecikmiş";
  }

  const explicitLabel = stringOrNull(record.status_display);

  if (explicitLabel) {
    return explicitLabel;
  }

  const status = getMaintenanceStatus(record);

  return maintenanceStatusLabel[status] ?? String(status || "Tamamlandı");
}

export function getMaintenanceStatusVariant(
  record: MaintenanceRecord
): "accent" | "success" | "warning" | "danger" | "neutral" {
  const status = getMaintenanceStatus(record);

  return maintenanceStatusVariant[status] ?? "neutral";
}

export function getMaintenanceAssetId(record: MaintenanceRecord): number | null {
  if (typeof record.asset_id === "number") {
    return record.asset_id;
  }

  if (typeof record.asset === "number") {
    return record.asset;
  }

  if (
    record.asset &&
    typeof record.asset === "object" &&
    typeof record.asset.id === "number"
  ) {
    return record.asset.id;
  }

  if (
    record.asset_detail &&
    typeof record.asset_detail.id === "number"
  ) {
    return record.asset_detail.id;
  }

  return null;
}

export function getMaintenanceAssetName(record: MaintenanceRecord): string {
  const directName = stringOrNull(record.asset_name);

  if (directName) {
    return directName;
  }

  if (record.asset && typeof record.asset === "object") {
    return stringOrNull(record.asset.name) || "Varlık";
  }

  if (record.asset_detail?.name) {
    return stringOrNull(record.asset_detail.name) || "Varlık";
  }

  return "Varlık";
}

export function getMaintenanceAssetCode(record: MaintenanceRecord): string | null {
  const directCode =
    stringOrNull(record.asset_inventory_code) ||
    stringOrNull(record.asset_serial_number);

  if (directCode) {
    return directCode;
  }

  if (record.asset && typeof record.asset === "object") {
    return (
      stringOrNull(record.asset.inventory_code) ||
      stringOrNull(record.asset.serial_number)
    );
  }

  if (record.asset_detail) {
    return (
      stringOrNull(record.asset_detail.inventory_code) ||
      stringOrNull(record.asset_detail.serial_number)
    );
  }

  return null;
}

export function getMaintenanceRecordDate(
  record: MaintenanceRecord
): string | null {
  return (
    stringOrNull(record.performed_at) ||
    stringOrNull(record.scheduled_date) ||
    stringOrNull(record.due_date) ||
    stringOrNull(record.maintenance_date) ||
    stringOrNull(record.repair_date) ||
    stringOrNull(record.disposal_date) ||
    stringOrNull(record.completed_at) ||
    stringOrNull(record.created_at)
  );
}

export function formatMaintenanceDate(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatMaintenanceCost(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numberValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function getNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

export function getMaintenanceSummaryTotal(summary?: MaintenanceSummary): number {
  if (!summary) {
    return 0;
  }

  return getNumber(summary.total_records) || getNumber(summary.total);
}

export function getMaintenanceSummaryCount(
  summary: MaintenanceSummary | undefined,
  key: keyof MaintenanceSummary
): number {
  if (!summary) {
    return 0;
  }

  return getNumber(summary[key]);
}

export function isMaintenanceOverdue(record: MaintenanceRecord): boolean {
  if (record.is_overdue === true) {
    return true;
  }

  if (record.is_overdue === false) {
    return false;
  }

  const status = getMaintenanceStatus(record);

  if (status === "overdue") {
    return true;
  }

  const dateValue =
    stringOrNull(record.next_due_date) ||
    stringOrNull(record.due_date) ||
    stringOrNull(record.scheduled_date);

  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date < today && status !== "completed" && status !== "cancelled";
}

export function normalizeMaintenanceRecordType(
  type: MaintenanceRecordType
): string {
  return normalizeValue(type);
}

export function normalizeMaintenanceStatus(
  status: MaintenanceRecordStatus
): string {
  return normalizeValue(status);
}