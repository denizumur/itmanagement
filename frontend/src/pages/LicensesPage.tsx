import {
  IconCalendar,
  IconCalendarDue,
  IconEdit,
  IconHistory,
  IconKey,
  IconNotes,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { ErrorState } from "../components/common/ErrorState";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { Skeleton } from "../components/common/Skeleton";
import { AuditHistoryLink } from "../components/audit/AuditHistoryLink";
import { TablePagination } from "../components/common/TablePagination";
import { AppShell } from "../components/layout/AppShell";
import { AppToast } from "../components/ui/AppToast";
import { GlowButton } from "../components/ui/GlowButton";
import { PageHeader } from "../components/ui/PageHeader";
import { PageTransition } from "../components/ui/PageTransition";
import { SlideOverPanel } from "../components/ui/SlideOverPanel";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAssets } from "../hooks/useInventory";
import {
  useCreateLicenseSubscription,
  useDeleteLicenseSubscription,
  useLicenseSubscriptionSummary,
  useLicenseSubscriptionTable,
  useRestoreLicenseSubscription,
  useUpdateLicenseSubscription,
} from "../hooks/useLicensing";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { cn } from "../lib/cn";
import { canManage } from "../lib/rbac";
import type { Asset } from "../types/inventory";
import type {
  LicenseBillingCycle,
  LicenseSubscription,
  LicenseSubscriptionPayload,
  LicenseType,
} from "../types/licensing";

type LicenseFormMode = "create" | "edit";

type ToastState = {
  type: "success" | "error";
  message: string;
};

const licenseTypeOptions: Array<{ value: LicenseType; label: string }> = [
  { value: "subscription", label: "Abonelik" },
  { value: "license", label: "Lisans" },
];

const billingCycleOptions: Array<{
  value: LicenseBillingCycle;
  label: string;
}> = [
  { value: "yearly", label: "Yıllık" },
  { value: "monthly", label: "Aylık" },
  { value: "one_time", label: "Tek seferlik" },
  { value: "other", label: "Diğer" },
];

function formatDate(value?: string | null) {
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

function formatCurrency(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return "₺0";
  }

  const numericValue =
    typeof value === "number" ? value : Number(value.toString());

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function getMutationErrorMessage(error: unknown) {
  const fallback =
    "İşlem tamamlanamadı. Lütfen alanları kontrol edip tekrar dene.";

  if (!error || typeof error !== "object" || !("response" in error)) {
    return fallback;
  }

  const response = (
    error as {
      response?: {
        data?: unknown;
      };
    }
  ).response;

  const data = response?.data;

  if (!data) {
    return fallback;
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object" && "detail" in data) {
    const detail = (data as { detail?: unknown }).detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  if (typeof data === "object") {
    const firstEntry = Object.entries(data as Record<string, unknown>)[0];

    if (firstEntry) {
      const [field, value] = firstEntry;

      if (Array.isArray(value)) {
        return `${field}: ${value.join(", ")}`;
      }

      if (typeof value === "string") {
        return `${field}: ${value}`;
      }
    }
  }

  return fallback;
}

function hasMaskingCharacter(value: string) {
  return ["*", "X", "x", "•"].some((marker) => value.includes(marker));
}

function getLicenseStatusVariant(
  license: LicenseSubscription
): "accent" | "success" | "warning" | "danger" | "neutral" {
  if (license.is_deleted) {
    return "neutral";
  }

  if (!license.is_active) {
    return "neutral";
  }

  if (license.is_expired) {
    return "danger";
  }

  if (license.is_expiring_soon_30_days) {
    return "warning";
  }

  return "success";
}

function getLicenseStatusLabel(license: LicenseSubscription) {
  if (license.is_deleted) {
    return "Silinmiş";
  }

  if (!license.is_active) {
    return "Pasif";
  }

  if (license.is_expired) {
    return "Süresi doldu";
  }

  if (license.is_expiring_soon_30_days) {
    return "Yaklaşıyor";
  }

  return "Aktif";
}

function getAssetLabel(asset: Asset) {
  return [asset.inventory_code, asset.name].filter(Boolean).join(" - ");
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  const displayValue =
    value === undefined || value === null || value === "" ? "-" : value;

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-0/90 p-md shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-panel focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <p className="text-caption text-text-secondary">{label}</p>
      <div className="mt-xs text-body font-medium text-text-primary">
        {displayValue}
      </div>
    </div>
  );
}

function DetailSection({
  title,
  icon,
  tone = "accent",
  children,
}: {
  title: string;
  icon: ReactNode;
  tone?: "accent" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const toneClasses = {
    accent: "border-accent/20 bg-accent-bg text-accent",
    success: "border-success/20 bg-success-bg text-success",
    warning: "border-warning/25 bg-warning-bg text-warning",
    danger: "border-danger/25 bg-danger-bg text-danger",
  };

  return (
    <section className="rounded-panel border border-border-subtle bg-surface-1/80 p-md shadow-panel">
      <div className="mb-md flex items-center gap-sm">
        <span
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-2xl border shadow-sm",
            toneClasses[tone]
          )}
        >
          {icon}
        </span>
        <h3 className="text-body font-semibold text-text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function LicenseAvatar({ license }: { license: LicenseSubscription }) {
  const initial = license.name.slice(0, 1).toLocaleUpperCase("tr-TR") || "L";
  const risky = license.is_expired || license.is_expiring_soon_30_days;

  return (
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border text-body font-semibold shadow-sm",
        risky
          ? "border-warning/25 bg-warning-bg text-warning"
          : "border-accent/25 bg-accent-bg text-accent"
      )}
    >
      <span aria-hidden={true}>{initial}</span>
      <span className="absolute -right-1 -top-1 rounded-full border border-surface-1 bg-surface-1 text-text-secondary">
        <IconKey size={15} aria-hidden={true} />
      </span>
    </span>
  );
}

function DateChip({
  label,
  value,
  tone = "accent",
}: {
  label: string;
  value?: string | null;
  tone?: "accent" | "success" | "warning" | "danger";
}) {
  const toneClasses = {
    accent: "border-accent/25 bg-accent-bg/70 text-accent",
    success: "border-success/25 bg-success-bg/70 text-success",
    warning: "border-warning/25 bg-warning-bg/70 text-warning",
    danger: "border-danger/25 bg-danger-bg/70 text-danger",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-xs rounded-xl border px-sm py-xs text-caption font-medium shadow-sm transition hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        toneClasses[tone]
      )}
    >
      <IconCalendarDue size={14} aria-hidden={true} />
      <span>{label}</span>
      <span className="text-text-primary">{formatDate(value)}</span>
    </span>
  );
}

function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-xs rounded-full border border-accent/25 bg-accent-bg px-sm py-xs text-caption font-semibold text-accent shadow-sm">
      <span>
        {label}: {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 transition hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none"
        aria-label={`${label} filtresini kaldır`}
        title={`${label} filtresini kaldır`}
      >
        <IconX size={13} aria-hidden={true} />
      </button>
    </span>
  );
}

function getSelectedStatusFilter(filters: Record<string, string | string[]>) {
  if (filters.expired === "true") {
    return "expired";
  }

  if (filters.upcoming === "true") {
    return "upcoming";
  }

  if (filters.is_active === "true") {
    return "active";
  }

  if (filters.is_active === "false") {
    return "inactive";
  }

  return "";
}

function buildLicenseColumns({
  userCanManage,
  isSubmitting,
  onEditLicense,
  onDeleteLicense,
  onRestoreLicense,
}: {
  userCanManage: boolean;
  isSubmitting: boolean;
  onEditLicense: (license: LicenseSubscription) => void;
  onDeleteLicense: (license: LicenseSubscription) => void;
  onRestoreLicense: (license: LicenseSubscription) => void;
}): DataTableColumn<LicenseSubscription>[] {
  return [
    {
      key: "name",
      label: "Lisans / Abonelik",
      sortable: true,
      sortKey: "name",
      render: (license) => (
        <div
          className={cn(
            "flex min-w-[260px] items-center gap-sm",
            license.is_deleted ? "opacity-70" : ""
          )}
        >
          <LicenseAvatar license={license} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">
              {license.name}
            </p>
            <div className="mt-xs flex max-w-full flex-wrap gap-xs">
              <span className="inline-flex max-w-full rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-[11px] font-medium text-text-secondary shadow-sm">
                <span className="truncate">
                  {license.tracking_code ?? "Takip kodu yok"}
                </span>
              </span>
              {license.license_key_masked ? (
                <span className="inline-flex max-w-full rounded-full border border-warning/20 bg-warning-bg px-sm py-[2px] text-[11px] font-medium text-warning shadow-sm">
                  <span className="truncate">{license.license_key_masked}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      label: "Tip / Plan",
      sortable: true,
      sortKey: "type",
      render: (license) => (
        <div className="flex flex-col gap-xs">
          <StatusBadge variant={license.type === "license" ? "accent" : "warning"}>
            {license.type_label ??
              (license.type === "license" ? "Lisans" : "Abonelik")}
          </StatusBadge>
          <span className="text-caption text-text-secondary">
            {license.billing_cycle_label ?? license.billing_cycle}
          </span>
        </div>
      ),
    },
    {
      key: "vendor",
      label: "Sağlayıcı",
      sortable: true,
      sortKey: "vendor",
      render: (license) => (
        <div className="min-w-[160px] rounded-2xl border border-border-subtle bg-surface-0/80 px-sm py-xs shadow-sm">
          <p className="text-body font-medium text-text-primary">
            {license.vendor || "-"}
          </p>
          <p className="text-caption text-text-secondary">
            {license.auto_renew ? "Otomatik yenileme" : "Manuel takip"}
          </p>
        </div>
      ),
    },
    {
      key: "seat_count",
      label: "Koltuk",
      sortable: true,
      sortKey: "seat_count",
      render: (license) => (
        <span className="inline-flex items-center gap-xs rounded-xl border border-success/25 bg-success-bg/70 px-sm py-xs text-caption font-semibold text-success shadow-sm">
          <IconUsers size={14} aria-hidden={true} />
          {license.seat_count}
        </span>
      ),
    },
    {
      key: "assigned_asset",
      label: "Bağlı Varlık",
      sortable: true,
      sortKey: "assigned_asset__name",
      render: (license) =>
        license.assigned_asset_name ? (
          <div className="flex min-w-[190px] items-center gap-sm">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent-bg text-accent shadow-sm">
              <IconShieldCheck size={15} aria-hidden={true} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-text-primary">
                {license.assigned_asset_name}
              </p>
              <p className="truncate text-caption text-text-secondary">
                {license.assigned_asset_inventory_code ?? "-"}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-caption text-text-secondary">Atanmamış</span>
        ),
    },
    {
      key: "timeline",
      label: "Tarihler",
      sortable: true,
      sortKey: "end_date",
      render: (license) => (
        <div className="flex min-w-[200px] flex-col gap-xs">
          <DateChip label="Başlangıç" value={license.start_date} />
          <DateChip
            label="Bitiş"
            value={license.end_date}
            tone={
              license.is_expired
                ? "danger"
                : license.is_expiring_soon_30_days
                  ? "warning"
                  : "success"
            }
          />
        </div>
      ),
    },
    {
      key: "cost",
      label: "Yenileme",
      sortable: true,
      sortKey: "renewal_cost",
      className: "text-right",
      render: (license) => (
        <div className="flex flex-col items-end gap-xs">
          <span className="font-semibold text-text-primary">
            {formatCurrency(license.renewal_cost)}
          </span>
          <span className="text-caption text-text-secondary">
            {license.days_until_end === null ||
            license.days_until_end === undefined
              ? "Gün bilgisi yok"
              : `${license.days_until_end} gün`}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Durum",
      render: (license) => (
        <StatusBadge variant={getLicenseStatusVariant(license)}>
          {getLicenseStatusLabel(license)}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      label: "Aksiyon",
      className: "text-right",
      render: (license) => (
        <div className="flex justify-end gap-xs">
          {userCanManage ? (
            license.is_deleted ? (
              <button
                type="button"
                onClick={() => onRestoreLicense(license)}
                disabled={isSubmitting}
                className="inline-flex size-9 items-center justify-center rounded-xl border border-success/30 bg-success-bg text-success shadow-sm transition hover:border-success focus:outline-none focus:ring-2 focus:ring-success/25 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                aria-label={`${license.name} kaydını geri yükle`}
                title="Geri yükle"
              >
                <IconRefresh size={16} aria-hidden={true} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onEditLicense(license)}
                  className="inline-flex size-9 items-center justify-center rounded-xl border border-accent/30 bg-accent-bg text-accent shadow-sm transition hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
                  aria-label={`${license.name} kaydını düzenle`}
                  title="Düzenle"
                >
                  <IconEdit size={16} aria-hidden={true} />
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteLicense(license)}
                  disabled={isSubmitting}
                  className="inline-flex size-9 items-center justify-center rounded-xl border border-danger/30 bg-danger-bg text-danger shadow-sm transition hover:border-danger focus:outline-none focus:ring-2 focus:ring-danger/25 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                  aria-label={`${license.name} kaydını sil`}
                  title="Sil"
                >
                  <IconTrash size={16} aria-hidden={true} />
                </button>
              </>
            )
          ) : null}
        </div>
      ),
    },
  ];
}
function LicenseForm({
  mode,
  license,
  assets,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  mode: LicenseFormMode;
  license?: LicenseSubscription | null;
  assets: Asset[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (payload: LicenseSubscriptionPayload) => void;
}) {
  const initialState = useMemo<LicenseSubscriptionPayload>(
    () => ({
      name: license?.name ?? "",
      tracking_code: license?.tracking_code ?? "",
      type: license?.type ?? "subscription",
      vendor: license?.vendor ?? "",
      license_key_masked: license?.license_key_masked ?? "",
      seat_count: license?.seat_count ?? 1,
      assigned_asset: license?.assigned_asset ?? null,
      start_date: license?.start_date ?? "",
      end_date: license?.end_date ?? "",
      renewal_cost: license?.renewal_cost ?? "",
      billing_cycle: license?.billing_cycle ?? "yearly",
      auto_renew: license?.auto_renew ?? false,
      is_active: license?.is_active ?? true,
      notes: license?.notes ?? "",
    }),
    [license]
  );

  const [form, setForm] = useState<LicenseSubscriptionPayload>(initialState);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialState);
    setError("");
  }, [initialState]);

  function updateField<K extends keyof LicenseSubscriptionPayload>(
    key: K,
    value: LicenseSubscriptionPayload[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Lisans/abonelik adı zorunludur.");
      return;
    }

    if (!form.seat_count || Number(form.seat_count) < 1) {
      setError("Kullanıcı/koltuk sayısı en az 1 olmalıdır.");
      return;
    }

    if (
      form.license_key_masked &&
      !hasMaskingCharacter(String(form.license_key_masked))
    ) {
      setError(
        "Tam lisans anahtarı saklama. Maskeli format kullan: XXXX-XXXX-1234."
      );
      return;
    }

    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError("Bitiş tarihi başlangıç tarihinden önce olamaz.");
      return;
    }

    setError("");

    onSubmit({
      ...form,
      name: form.name.trim(),
      tracking_code: form.tracking_code?.trim() || null,
      vendor: form.vendor?.trim() || "",
      license_key_masked: form.license_key_masked?.trim() || "",
      seat_count: Number(form.seat_count),
      assigned_asset: form.assigned_asset ? Number(form.assigned_asset) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      renewal_cost:
        form.renewal_cost === "" || form.renewal_cost === null
          ? null
          : form.renewal_cost,
      notes: form.notes?.trim() || "",
    });
  }

  const fieldClassName =
    "w-full rounded-2xl border border-border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <form className="space-y-md" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger-bg px-md py-sm text-body font-medium text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-md sm:grid-cols-2">
        <label className="space-y-xs sm:col-span-2">
          <span className="text-caption font-medium text-text-secondary">
            Lisans / abonelik adı *
          </span>
          <input
            className={fieldClassName}
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Microsoft 365 Business Premium"
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption font-medium text-text-secondary">
            Takip kodu
          </span>
          <input
            className={fieldClassName}
            value={form.tracking_code ?? ""}
            onChange={(event) =>
              updateField("tracking_code", event.target.value)
            }
            placeholder="LIC-M365-001"
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption font-medium text-text-secondary">Tip</span>
          <select
            className={fieldClassName}
            value={form.type}
            onChange={(event) =>
              updateField("type", event.target.value as LicenseType)
            }
          >
            {licenseTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-xs">
          <span className="text-caption font-medium text-text-secondary">
            Tedarikçi
          </span>
          <input
            className={fieldClassName}
            value={form.vendor ?? ""}
            onChange={(event) => updateField("vendor", event.target.value)}
            placeholder="Microsoft, Adobe, ESET..."
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption font-medium text-text-secondary">
            Maskeli lisans anahtarı
          </span>
          <input
            className={fieldClassName}
            value={form.license_key_masked ?? ""}
            onChange={(event) =>
              updateField("license_key_masked", event.target.value)
            }
            placeholder="XXXX-XXXX-1234"
          />
          <p className="rounded-xl border border-warning/20 bg-warning-bg px-sm py-xs text-caption text-warning">
            Tam anahtar girme. Sadece maskeli değer saklanır.
          </p>
        </label>

        <label className="space-y-xs">
          <span className="text-caption font-medium text-text-secondary">
            Kullanıcı / koltuk sayısı *
          </span>
          <input
            type="number"
            min={1}
            className={fieldClassName}
            value={form.seat_count}
            onChange={(event) =>
              updateField("seat_count", Number(event.target.value))
            }
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption font-medium text-text-secondary">
            Bağlı varlık
          </span>
          <select
            className={fieldClassName}
            value={form.assigned_asset ? String(form.assigned_asset) : ""}
            onChange={(event) =>
              updateField(
                "assigned_asset",
                event.target.value ? Number(event.target.value) : null
              )
            }
          >
            <option value="">Varlığa bağlı değil</option>
            {assets.map((asset) => (
              <option key={asset.id} value={String(asset.id)}>
                {getAssetLabel(asset)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-xs">
          <span className="text-caption font-medium text-text-secondary">
            Faturalama döngüsü
          </span>
          <select
            className={fieldClassName}
            value={form.billing_cycle}
            onChange={(event) =>
              updateField(
                "billing_cycle",
                event.target.value as LicenseBillingCycle
              )
            }
          >
            {billingCycleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-xs">
          <span className="text-caption font-medium text-text-secondary">
            Başlangıç tarihi
          </span>
          <input
            type="date"
            className={fieldClassName}
            value={form.start_date ?? ""}
            onChange={(event) => updateField("start_date", event.target.value)}
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption font-medium text-text-secondary">
            Bitiş / yenileme tarihi
          </span>
          <input
            type="date"
            className={fieldClassName}
            value={form.end_date ?? ""}
            onChange={(event) => updateField("end_date", event.target.value)}
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption font-medium text-text-secondary">
            Yenileme maliyeti
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={fieldClassName}
            value={form.renewal_cost ?? ""}
            onChange={(event) =>
              updateField("renewal_cost", event.target.value)
            }
            placeholder="12000"
          />
        </label>

        <div className="space-y-sm rounded-2xl border border-border-subtle bg-surface-0 p-md">
          <label className="flex items-center gap-sm">
            <input
              type="checkbox"
              checked={form.auto_renew}
              onChange={(event) =>
                updateField("auto_renew", event.target.checked)
              }
            />
            <span className="text-body text-text-primary">
              Otomatik yenileniyor
            </span>
          </label>

          <label className="flex items-center gap-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                updateField("is_active", event.target.checked)
              }
            />
            <span className="text-body text-text-primary">Aktif kayıt</span>
          </label>
        </div>

        <label className="space-y-xs sm:col-span-2">
          <span className="text-caption font-medium text-text-secondary">
            Notlar
          </span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
            value={form.notes ?? ""}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Satın alma, yenileme, kullanıcı dağılımı veya operasyonel notlar..."
          />
        </label>
      </div>

      <div className="flex justify-end gap-sm border-t border-border-subtle pt-md">
        <GlowButton type="button" variant="ghost" onClick={onCancel}>
          Vazgeç
        </GlowButton>

        <GlowButton type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Kaydediliyor"
            : mode === "create"
              ? "Lisans oluştur"
              : "Değişiklikleri kaydet"}
        </GlowButton>
      </div>
    </form>
  );
}

export function LicensesPage() {
  const { user } = useAuth();
  const userCanManage = canManage(user?.role);

  const {
    state,
    setSearch,
    setSort,
    setPage,
    setPageSize,
    setFilter,
    resetFilters,
  } = useTableQueryState({
    page: 1,
    pageSize: 25,
    ordering: "end_date",
  });

  const [selectedLicense, setSelectedLicense] =
    useState<LicenseSubscription | null>(null);
  const [formMode, setFormMode] = useState<LicenseFormMode | null>(null);
  const [editingLicense, setEditingLicense] =
    useState<LicenseSubscription | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const selectedType =
    typeof state.filters.type === "string" ? state.filters.type : "";

  const selectedDeleted =
    typeof state.filters.deleted === "string" ? state.filters.deleted : "";

  const showDeleted = selectedDeleted === "true";

  const selectedStatusFilter = showDeleted
    ? ""
    : getSelectedStatusFilter(state.filters);

  const licensesQuery = useLicenseSubscriptionTable(state);
  const summaryQuery = useLicenseSubscriptionSummary();
  const assetsQuery = useAssets({});

  const createMutation = useCreateLicenseSubscription();
  const updateMutation = useUpdateLicenseSubscription();
  const deleteMutation = useDeleteLicenseSubscription();
  const restoreMutation = useRestoreLicenseSubscription();

  const licenseTableData = licensesQuery.data;
  const licenses = licenseTableData?.results ?? [];
  const summary = summaryQuery.data;
  const assets = assetsQuery.data ?? [];

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    restoreMutation.isPending;

  const isInitialLoading =
    licensesQuery.isLoading || summaryQuery.isLoading || assetsQuery.isLoading;

  const hasError =
    licensesQuery.isError || summaryQuery.isError || assetsQuery.isError;

  const selectedTypeLabel =
    selectedType === "subscription"
      ? "Abonelik"
      : selectedType === "license"
        ? "Lisans"
        : "";

  const selectedStatusLabel =
    selectedStatusFilter === "active"
      ? "Aktif"
      : selectedStatusFilter === "inactive"
        ? "Pasif"
        : selectedStatusFilter === "upcoming"
          ? "30 gün içinde yenilenecek"
          : selectedStatusFilter === "expired"
            ? "Süresi dolan"
            : "";

  const hasActiveFilters = Boolean(
    state.search || selectedType || selectedStatusFilter || showDeleted
  );

  function refetchAll() {
    licensesQuery.refetch();
    summaryQuery.refetch();
    assetsQuery.refetch();
  }

  function openCreateForm() {
    setSelectedLicense(null);
    setEditingLicense(null);
    setFormMode("create");
  }

  function openEditForm(license: LicenseSubscription) {
    setSelectedLicense(null);
    setEditingLicense(license);
    setFormMode("edit");
  }

  function closeForm() {
    if (isSubmitting) {
      return;
    }

    setFormMode(null);
    setEditingLicense(null);
  }

  function applyStatusFilter(value: string) {
    setFilter("is_active", null);
    setFilter("expired", null);
    setFilter("upcoming", null);

    if (value === "active") {
      setFilter("is_active", "true");
    }

    if (value === "inactive") {
      setFilter("is_active", "false");
    }

    if (value === "expired") {
      setFilter("expired", "true");
    }

    if (value === "upcoming") {
      setFilter("upcoming", "true");
    }
  }

  function applyDeletedFilter(checked: boolean) {
    setFilter("deleted", checked ? "true" : null);

    if (checked) {
      setFilter("is_active", null);
      setFilter("expired", null);
      setFilter("upcoming", null);
    }
  }

  async function handleSubmit(payload: LicenseSubscriptionPayload) {
    try {
      if (formMode === "create") {
        await createMutation.mutateAsync(payload);

        setToast({
          type: "success",
          message: "Lisans/abonelik başarıyla oluşturuldu.",
        });
      } else if (formMode === "edit" && editingLicense) {
        await updateMutation.mutateAsync({
          id: editingLicense.id,
          payload,
        });

        setToast({
          type: "success",
          message: "Lisans/abonelik başarıyla güncellendi.",
        });
      }

      setFormMode(null);
      setEditingLicense(null);
      refetchAll();
    } catch (error) {
      setToast({
        type: "error",
        message: getMutationErrorMessage(error),
      });
    }
  }

  async function handleDelete(license: LicenseSubscription) {
    const confirmed = window.confirm(
      `"${license.name}" kaydı pasife/silinmiş duruma alınacak. Devam edilsin mi?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(license.id);

      setToast({
        type: "success",
        message: "Lisans/abonelik kaydı silindi.",
      });

      refetchAll();
    } catch (error) {
      setToast({
        type: "error",
        message: getMutationErrorMessage(error),
      });
    }
  }

  async function handleRestore(license: LicenseSubscription) {
    const confirmed = window.confirm(
      `"${license.name}" kaydı geri yüklenecek. Devam edilsin mi?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await restoreMutation.mutateAsync(license.id);

      setToast({
        type: "success",
        message: "Lisans/abonelik kaydı geri yüklendi.",
      });

      if (selectedLicense?.id === license.id) {
        setSelectedLicense(null);
      }

      refetchAll();
    } catch (error) {
      setToast({
        type: "error",
        message: getMutationErrorMessage(error),
      });
    }
  }

  const licenseColumns = useMemo(
    () =>
      buildLicenseColumns({
        userCanManage,
        isSubmitting,
        onEditLicense: openEditForm,
        onDeleteLicense: handleDelete,
        onRestoreLicense: handleRestore,
      }),
    [userCanManage, isSubmitting]
  );

  if (isInitialLoading) {
    return (
      <AppShell>
        <div className="flex flex-wrap gap-sm">
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-28 rounded-full" />
          <Skeleton className="h-14 w-28 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-36 rounded-full" />
        </div>

        <div className="mt-lg">
          <Skeleton className="h-[420px]" />
        </div>
      </AppShell>
    );
  }

  if (hasError) {
    return (
      <AppShell>
        <ErrorState message="Lisans/abonelik verisi alınamadı. API endpointlerini ve yetki durumunu kontrol et." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          eyebrow="Lisans ve Abonelik Yönetimi"
          title="Lisanslar"
          description="Lisansları, abonelikleri, yenileme tarihlerini, koltuk sayılarını ve yenileme maliyetlerini tek ekrandan takip et."
          actions={
            <>
              <GlowButton
                variant="ghost"
                onClick={refetchAll}
                disabled={licensesQuery.isFetching || isSubmitting}
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                {licensesQuery.isFetching ? "Yenileniyor" : "Veriyi yenile"}
              </GlowButton>

              {userCanManage && !showDeleted && (
                <GlowButton
                  icon={<IconPlus size={16} aria-hidden={true} />}
                  onClick={openCreateForm}
                  disabled={isSubmitting}
                >
                  Yeni Lisans
                </GlowButton>
              )}
            </>
          }
        />

        <section className="mt-lg overflow-hidden rounded-panel border border-border-strong/60 bg-surface-1/75 shadow-panel backdrop-blur-sm">
          <div className="relative grid gap-md border-b border-border-subtle/80 p-md lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,var(--surface-1),transparent),radial-gradient(circle_at_0%_0%,var(--bg-accent),transparent_32%),radial-gradient(circle_at_88%_0%,var(--bg-warning),transparent_28%)] opacity-80" />

            <div className="relative min-w-0">
              <div className="flex flex-wrap items-center gap-sm">
                <span className="inline-flex items-center gap-xs rounded-full border border-accent/25 bg-accent-bg/70 px-sm py-xs text-caption font-semibold text-accent shadow-sm">
                  <IconSparkles size={14} aria-hidden={true} />
                  License Intelligence Console
                </span>
                <span className="inline-flex items-center gap-xs rounded-full border border-border bg-surface-0/80 px-sm py-xs text-caption text-text-secondary shadow-sm">
                  Lisans Operasyon Merkezi
                </span>
              </div>

              <p className="mt-sm max-w-3xl text-body leading-7 text-text-secondary">
                Lisans, abonelik ve yenileme risklerini tek ekrandan takip et;
                sağlayıcı, koltuk, bağlı varlık ve maliyet sinyallerini hızlı
                tara.
              </p>
            </div>

            <div className="relative grid grid-cols-2 gap-xs sm:grid-cols-4 lg:min-w-[520px]">
              <MiniMetricCard
                label="Toplam"
                value={licenseTableData?.count ?? licenses.length}
                icon={<IconKey size={14} aria-hidden={true} />}
                tone="accent"
              />
              <MiniMetricCard
                label="Aktif"
                value={summary?.active ?? 0}
                icon={<IconShieldCheck size={14} aria-hidden={true} />}
                tone="success"
              />
              <MiniMetricCard
                label="Yaklaşan"
                value={summary?.upcoming_30_days ?? 0}
                icon={<IconCalendarDue size={14} aria-hidden={true} />}
                tone="warning"
              />
              <MiniMetricCard
                label="Riskli"
                value={summary?.expired ?? 0}
                icon={<IconKey size={14} aria-hidden={true} />}
                tone="danger"
              />
            </div>
          </div>

          <div className="grid gap-sm p-md xl:grid-cols-[1fr_180px_220px_190px_auto]">
            <label className="flex min-h-10 items-center gap-sm rounded-xl border border-accent/25 bg-surface-0/85 px-md py-xs shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none">
              <IconSearch
                size={18}
                className="text-accent"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="Lisans adı, takip kodu, sağlayıcı ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="min-h-10 rounded-xl border border-border bg-surface-0/85 px-sm py-xs text-body text-text-primary shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
              value={selectedType}
              onChange={(event) => setFilter("type", event.target.value || null)}
              aria-label="Tip filtresi"
            >
              <option value="">Tüm tipler</option>
              <option value="subscription">Abonelik</option>
              <option value="license">Lisans</option>
            </select>

            <select
              className="min-h-10 rounded-xl border border-border bg-surface-0/85 px-sm py-xs text-body text-text-primary shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
              value={selectedStatusFilter}
              onChange={(event) => applyStatusFilter(event.target.value)}
              aria-label="Durum filtresi"
              disabled={showDeleted}
            >
              <option value="">Tüm durumlar</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
              <option value="upcoming">30 gün içinde yenilenecek</option>
              <option value="expired">Süresi dolan</option>
            </select>

            <label className="flex min-h-10 items-center gap-sm rounded-xl border border-border bg-surface-0/85 px-sm py-xs text-body text-text-primary shadow-sm transition focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(event) => applyDeletedFilter(event.target.checked)}
              />
              <span>Silinenleri göster</span>
            </label>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-surface-0/85 px-md py-xs text-body font-medium text-text-primary shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
            >
              Temizle
            </button>
          </div>

          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-sm border-t border-border-subtle/80 px-md py-sm">
              {state.search ? (
                <FilterChip
                  label="Arama"
                  value={state.search}
                  onRemove={() => setSearch("")}
                />
              ) : null}

              {selectedType ? (
                <FilterChip
                  label="Tip"
                  value={selectedTypeLabel}
                  onRemove={() => setFilter("type", null)}
                />
              ) : null}

              {selectedStatusFilter ? (
                <FilterChip
                  label="Durum"
                  value={selectedStatusLabel}
                  onRemove={() => applyStatusFilter("")}
                />
              ) : null}

              {showDeleted ? (
                <FilterChip
                  label="Arşiv"
                  value="Silinenler"
                  onRemove={() => applyDeletedFilter(false)}
                />
              ) : null}
            </div>
          ) : null}
        </section>
        <section className="mt-lg flex flex-col gap-md">
          <DataTable
            columns={licenseColumns}
            data={licenses}
            getRowKey={(license) => license.id}
            ordering={state.ordering}
            onSortChange={setSort}
            isLoading={licensesQuery.isLoading}
            emptyMessage={
              showDeleted
                ? "Silinen lisans veya abonelik bulunamadı."
                : "Filtrelere uygun lisans veya abonelik bulunamadı."
            }
            onViewDetails={setSelectedLicense}
            viewDetailsLabel="Lisans detayını gör"
          />

          <TablePagination
            page={state.page}
            pageSize={state.pageSize}
            totalCount={licenseTableData?.count ?? 0}
            hasNext={Boolean(licenseTableData?.next)}
            hasPrevious={Boolean(licenseTableData?.previous)}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </section>

        <SlideOverPanel
          open={Boolean(selectedLicense)}
          title={selectedLicense?.name ?? "Lisans detayı"}
          description={selectedLicense?.tracking_code ?? undefined}
          onClose={() => setSelectedLicense(null)}
        >
          {selectedLicense && (
            <div className="space-y-md">
              <section className="overflow-hidden rounded-panel border border-accent/20 bg-surface-0 shadow-panel">
                <div className="h-1 bg-accent" />
                <div className="flex flex-wrap items-center justify-between gap-md">
                  <div className="flex min-w-0 items-center gap-md p-md">
                    <LicenseAvatar license={selectedLicense} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-sm">
                        <h3 className="truncate text-lg font-semibold text-text-primary">
                          {selectedLicense.name}
                        </h3>
                        <StatusBadge
                          variant={getLicenseStatusVariant(selectedLicense)}
                        >
                          {getLicenseStatusLabel(selectedLicense)}
                        </StatusBadge>
                      </div>
                      <div className="mt-xs flex flex-wrap gap-xs">
                        <span className="rounded-full border border-border-subtle bg-surface-1 px-sm py-[2px] text-caption font-medium text-text-secondary">
                          {selectedLicense.tracking_code ?? "Takip kodu yok"}
                        </span>
                        <span className="rounded-full border border-accent/20 bg-accent-bg px-sm py-[2px] text-caption font-medium text-accent">
                          {selectedLicense.vendor || "Sağlayıcı yok"}
                        </span>
                        <span className="rounded-full border border-border-subtle bg-surface-1 px-sm py-[2px] text-caption text-text-secondary">
                          Bitiş: {formatDate(selectedLicense.end_date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-sm p-md">
                    {userCanManage &&
                      (selectedLicense.is_deleted ? (
                        <GlowButton
                          variant="ghost"
                          icon={<IconRefresh size={16} aria-hidden={true} />}
                          onClick={() => handleRestore(selectedLicense)}
                          disabled={isSubmitting}
                        >
                          Geri Yükle
                        </GlowButton>
                      ) : (
                        <GlowButton
                          variant="ghost"
                          icon={<IconEdit size={16} aria-hidden={true} />}
                          onClick={() => openEditForm(selectedLicense)}
                        >
                          Düzenle
                        </GlowButton>
                      ))}

                    <AuditHistoryLink
                      entityType="licensing.LicenseSubscription"
                      entityId={selectedLicense.id}
                    />
                  </div>
                </div>
              </section>

              <DetailSection
                title="Lisans Bilgisi"
                icon={<IconKey size={17} aria-hidden={true} />}
                tone={selectedLicense.is_expired ? "danger" : "accent"}
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Takip kodu" value={selectedLicense.tracking_code} />
                  <DetailRow
                    label="Tip"
                    value={
                      selectedLicense.type_label ??
                      (selectedLicense.type === "license" ? "Lisans" : "Abonelik")
                    }
                  />
                  <DetailRow
                    label="Maskeli lisans anahtarı"
                    value={selectedLicense.license_key_masked}
                  />
                  <DetailRow label="Koltuk sayısı" value={selectedLicense.seat_count} />
                </div>
              </DetailSection>

              <DetailSection
                title="Sağlayıcı / Plan"
                icon={<IconShieldCheck size={17} aria-hidden={true} />}
                tone="success"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow label="Sağlayıcı" value={selectedLicense.vendor} />
                  <DetailRow
                    label="Faturalama"
                    value={
                      selectedLicense.billing_cycle_label ??
                      selectedLicense.billing_cycle
                    }
                  />
                  <DetailRow
                    label="Otomatik yenileme"
                    value={selectedLicense.auto_renew ? "Evet" : "Hayır"}
                  />
                  <DetailRow
                    label="Aktiflik"
                    value={selectedLicense.is_active ? "Aktif" : "Pasif"}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Atama / Varlık"
                icon={<IconUsers size={17} aria-hidden={true} />}
                tone="warning"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Bağlı varlık"
                    value={
                      selectedLicense.assigned_asset_name
                        ? selectedLicense.assigned_asset_name
                        : null
                    }
                  />
                  <DetailRow
                    label="Varlık kodu"
                    value={selectedLicense.assigned_asset_inventory_code}
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Tarihler"
                icon={<IconCalendarDue size={17} aria-hidden={true} />}
                tone={
                  selectedLicense.is_expired
                    ? "danger"
                    : selectedLicense.is_expiring_soon_30_days
                      ? "warning"
                      : "success"
                }
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Başlangıç tarihi"
                    value={formatDate(selectedLicense.start_date)}
                  />
                  <DetailRow
                    label="Bitiş / yenileme tarihi"
                    value={formatDate(selectedLicense.end_date)}
                  />
                  <DetailRow
                    label="Kalan gün"
                    value={
                      selectedLicense.days_until_end === null ||
                      selectedLicense.days_until_end === undefined
                        ? "-"
                        : selectedLicense.days_until_end
                    }
                  />
                  <DetailRow
                    label="Silinme tarihi"
                    value={
                      selectedLicense.is_deleted
                        ? formatDate(selectedLicense.deleted_at)
                        : null
                    }
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Maliyet / Yenileme"
                icon={<IconCalendar size={17} aria-hidden={true} />}
                tone="accent"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Yenileme maliyeti"
                    value={formatCurrency(selectedLicense.renewal_cost)}
                  />
                  <DetailRow
                    label="Yenileme riski"
                    value={
                      selectedLicense.is_expired
                        ? "Süresi doldu"
                        : selectedLicense.is_expiring_soon_30_days
                          ? "30 gün içinde yenilenecek"
                          : "Risk görünmüyor"
                    }
                  />
                </div>
              </DetailSection>

              <DetailSection
                title="Notlar"
                icon={<IconNotes size={17} aria-hidden={true} />}
                tone="accent"
              >
                <DetailRow label="Notlar" value={selectedLicense.notes} />
              </DetailSection>

              <DetailSection
                title="Sistem bilgisi"
                icon={<IconHistory size={17} aria-hidden={true} />}
                tone="success"
              >
                <div className="grid gap-md sm:grid-cols-2">
                  <DetailRow
                    label="Oluşturulma tarihi"
                    value={formatDate(selectedLicense.created_at)}
                  />
                  <DetailRow
                    label="Güncellenme tarihi"
                    value={formatDate(selectedLicense.updated_at)}
                  />
                </div>
              </DetailSection>
            </div>
          )}        </SlideOverPanel>

        <SlideOverPanel
          open={Boolean(formMode)}
          title={formMode === "create" ? "Yeni Lisans" : "Lisans Düzenle"}
          description={
            formMode === "create"
              ? "Yeni lisans veya abonelik kaydı oluştur."
              : editingLicense
                ? `${editingLicense.name} kaydını güncelle.`
                : "Lisans kaydını güncelle."
          }
          onClose={closeForm}
        >
          {formMode && (
            <LicenseForm
              mode={formMode}
              license={formMode === "edit" ? editingLicense : null}
              assets={assets}
              isSubmitting={isSubmitting}
              onCancel={closeForm}
              onSubmit={handleSubmit}
            />
          )}
        </SlideOverPanel>

        {toast && (
          <AppToast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
      </PageTransition>
    </AppShell>
  );
}
