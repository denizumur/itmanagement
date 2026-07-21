import {
  IconCalendar,
  IconEdit,
  IconEye,
  IconKey,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
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
  value?: string | number | null;
}) {
  const displayValue =
    value === undefined || value === null || value === "" ? "-" : value;

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-0 p-md">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-xs text-body text-text-primary">{displayValue}</p>
    </div>
  );
}

function DateCell({ value }: { value?: string | null }) {
  return (
    <span className="inline-flex min-w-[108px] items-center justify-center rounded-xl border border-border-subtle bg-surface-1 px-sm py-xs text-caption text-text-secondary shadow-sm">
      {formatDate(value)}
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
  onSelectLicense,
  onEditLicense,
  onDeleteLicense,
  onRestoreLicense,
}: {
  userCanManage: boolean;
  isSubmitting: boolean;
  onSelectLicense: (license: LicenseSubscription) => void;
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
        <div className={license.is_deleted ? "opacity-70" : undefined}>
          <p className="text-text-primary">{license.name}</p>
          <p className="text-caption text-text-secondary">
            {license.tracking_code ?? "Takip kodu yok"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      label: "Tip",
      sortable: true,
      sortKey: "type",
      render: (license) =>
        license.type_label ??
        (license.type === "license" ? "Lisans" : "Abonelik"),
    },
    {
      key: "vendor",
      label: "Tedarikçi",
      sortable: true,
      sortKey: "vendor",
      render: (license) => license.vendor || "-",
    },
    {
      key: "license_key_masked",
      label: "Anahtar",
      render: (license) => license.license_key_masked || "-",
    },
    {
      key: "seat_count",
      label: "Koltuk",
      sortable: true,
      sortKey: "seat_count",
      render: (license) => license.seat_count,
    },
    {
      key: "assigned_asset",
      label: "Bağlı Varlık",
      sortable: true,
      sortKey: "assigned_asset__name",
      render: (license) =>
        license.assigned_asset_name ? (
          <div>
            <p className="text-body text-text-primary">
              {license.assigned_asset_name}
            </p>
            <p className="text-caption text-text-secondary">
              {license.assigned_asset_inventory_code ?? "-"}
            </p>
          </div>
        ) : (
          "-"
        ),
    },
    {
      key: "end_date",
      label: "Bitiş",
      sortable: true,
      sortKey: "end_date",
      render: (license) => <DateCell value={license.end_date} />,
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
      label: "İşlem",
      className: "text-right",
      render: (license) => (
        <div className="flex justify-end gap-sm">
          <GlowButton
            variant="ghost"
            onClick={() => onSelectLicense(license)}
            icon={<IconEye size={16} aria-hidden={true} />}
          >
            Detay
          </GlowButton>

          {userCanManage ? (
            license.is_deleted ? (
              <GlowButton
                variant="ghost"
                onClick={() => onRestoreLicense(license)}
                disabled={isSubmitting}
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                Geri Yükle
              </GlowButton>
            ) : (
              <>
                <GlowButton
                  variant="ghost"
                  onClick={() => onEditLicense(license)}
                  icon={<IconEdit size={16} aria-hidden={true} />}
                >
                  Düzenle
                </GlowButton>

                <GlowButton
                  variant="ghost"
                  onClick={() => onDeleteLicense(license)}
                  disabled={isSubmitting}
                  icon={<IconTrash size={16} aria-hidden={true} />}
                >
                  Sil
                </GlowButton>
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
        onSelectLicense: setSelectedLicense,
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

        <section className="mt-lg flex flex-wrap gap-sm">
          <MiniMetricCard
            label="Listelenen lisans"
            value={licenseTableData?.count ?? licenses.length}
            icon={<IconKey size={15} aria-hidden={true} />}
            tone="accent"
          />

          <MiniMetricCard
            label="Aktif lisans sayısı"
            value={summary?.active ?? 0}
            icon={<IconKey size={15} aria-hidden={true} />}
            tone="success"
          />

          <MiniMetricCard
            label="Toplam kullanıcı sayısı"
            value={summary?.total_seats ?? 0}
            icon={<IconUsers size={15} aria-hidden={true} />}
            tone="success"
          />

          <MiniMetricCard
            label="30 gün içinde bitecek"
            value={summary?.upcoming_30_days ?? 0}
            icon={<IconCalendar size={15} aria-hidden={true} />}
            tone="warning"
          />

          <MiniMetricCard
            label="Süresi dolan"
            value={summary?.expired ?? 0}
            icon={<IconKey size={15} aria-hidden={true} />}
            tone="danger"
          />
        </section>

        <section className="mt-lg rounded-panel border border-border-subtle bg-surface-1 p-md shadow-panel">
          <div className="grid gap-md xl:grid-cols-[1fr_220px_220px_220px_auto]">
            <label className="flex items-center gap-sm rounded-2xl border border-border bg-surface-0 px-md py-sm shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <IconSearch
                size={18}
                className="text-text-secondary"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="Lisans adı, takip kodu, tedarikçi ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="rounded-2xl border border-border bg-surface-0 px-md py-sm text-body text-text-primary shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={selectedType}
              onChange={(event) => setFilter("type", event.target.value || null)}
              aria-label="Tip filtresi"
            >
              <option value="">Tüm tipler</option>
              <option value="subscription">Abonelik</option>
              <option value="license">Lisans</option>
            </select>

            <select
              className="rounded-2xl border border-border bg-surface-0 px-md py-sm text-body text-text-primary shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
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

            <label className="flex items-center gap-sm rounded-2xl border border-border bg-surface-0 px-md py-sm text-body text-text-primary shadow-sm">
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
              className="inline-flex items-center justify-center rounded-2xl border border-border bg-surface-1 px-md py-sm text-body font-medium text-text-primary shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            >
              Temizle
            </button>
          </div>
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
              <div className="flex items-center justify-between gap-md rounded-panel border border-border-subtle bg-surface-0 p-md shadow-panel">
                <div>
                  <p className="text-caption text-text-secondary">Durum</p>
                  <StatusBadge
                    variant={getLicenseStatusVariant(selectedLicense)}
                  >
                    {getLicenseStatusLabel(selectedLicense)}
                  </StatusBadge>
                </div>

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

              <div className="grid gap-md sm:grid-cols-2">
                <DetailRow
                  label="Takip kodu"
                  value={selectedLicense.tracking_code}
                />

                <DetailRow
                  label="Tip"
                  value={
                    selectedLicense.type_label ??
                    (selectedLicense.type === "license"
                      ? "Lisans"
                      : "Abonelik")
                  }
                />

                <DetailRow label="Tedarikçi" value={selectedLicense.vendor} />

                <DetailRow
                  label="Maskeli lisans anahtarı"
                  value={selectedLicense.license_key_masked}
                />

                <DetailRow
                  label="Koltuk sayısı"
                  value={selectedLicense.seat_count}
                />

                <DetailRow
                  label="Bağlı varlık"
                  value={
                    selectedLicense.assigned_asset_name
                      ? `${selectedLicense.assigned_asset_inventory_code ?? ""} ${selectedLicense.assigned_asset_name}`
                      : null
                  }
                />

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
                  label="Yenileme maliyeti"
                  value={formatCurrency(selectedLicense.renewal_cost)}
                />

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
                  label="Silinme tarihi"
                  value={
                    selectedLicense.is_deleted
                      ? formatDate(selectedLicense.deleted_at)
                      : null
                  }
                />
              </div>

              <DetailRow label="Notlar" value={selectedLicense.notes} />
            </div>
          )}
        </SlideOverPanel>

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