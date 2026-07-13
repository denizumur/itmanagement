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
import { ErrorState } from "../components/common/ErrorState";
import { Skeleton } from "../components/common/Skeleton";
import { AppShell } from "../components/layout/AppShell";
import { AppToast } from "../components/ui/AppToast";
import { DataCard } from "../components/ui/DataCard";
import { DataTable } from "../components/ui/DataTable";
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
  useLicenseSubscriptions,
  useRestoreLicenseSubscription,
  useUpdateLicenseSubscription,
} from "../hooks/useLicensing";
import { canManage } from "../lib/rbac";
import type { Asset } from "../types/inventory";
import type {
  LicenseBillingCycle,
  LicenseSubscription,
  LicenseSubscriptionFilters,
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
    <div className="rounded-app border border-border bg-surface-1 p-md">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-xs text-body text-text-primary">{displayValue}</p>
    </div>
  );
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

  return (
    <form className="space-y-md" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-app border border-danger bg-danger-bg px-md py-sm text-body text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-md sm:grid-cols-2">
        <label className="space-y-xs sm:col-span-2">
          <span className="text-caption text-text-secondary">
            Lisans / abonelik adı *
          </span>
          <input
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Microsoft 365 Business Premium"
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Takip kodu</span>
          <input
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.tracking_code ?? ""}
            onChange={(event) =>
              updateField("tracking_code", event.target.value)
            }
            placeholder="LIC-M365-001"
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Tip</span>
          <select
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
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
          <span className="text-caption text-text-secondary">Tedarikçi</span>
          <input
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.vendor ?? ""}
            onChange={(event) => updateField("vendor", event.target.value)}
            placeholder="Microsoft, Adobe, ESET..."
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">
            Maskeli lisans anahtarı
          </span>
          <input
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.license_key_masked ?? ""}
            onChange={(event) =>
              updateField("license_key_masked", event.target.value)
            }
            placeholder="XXXX-XXXX-1234"
          />
          <p className="text-caption text-text-secondary">
            Tam anahtar girme. Sadece maskeli değer saklanır.
          </p>
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">
            Kullanıcı / koltuk sayısı *
          </span>
          <input
            type="number"
            min={1}
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.seat_count}
            onChange={(event) =>
              updateField("seat_count", Number(event.target.value))
            }
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Bağlı varlık</span>
          <select
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
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
          <span className="text-caption text-text-secondary">
            Faturalama döngüsü
          </span>
          <select
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
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
          <span className="text-caption text-text-secondary">
            Başlangıç tarihi
          </span>
          <input
            type="date"
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.start_date ?? ""}
            onChange={(event) => updateField("start_date", event.target.value)}
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">
            Bitiş / yenileme tarihi
          </span>
          <input
            type="date"
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.end_date ?? ""}
            onChange={(event) => updateField("end_date", event.target.value)}
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">
            Yenileme maliyeti
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.renewal_cost ?? ""}
            onChange={(event) =>
              updateField("renewal_cost", event.target.value)
            }
            placeholder="12000"
          />
        </label>

        <div className="space-y-sm rounded-app border border-border bg-surface-1 p-md">
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
          <span className="text-caption text-text-secondary">Notlar</span>
          <textarea
            className="min-h-28 w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.notes ?? ""}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Satın alma, yenileme, kullanıcı dağılımı veya operasyonel notlar..."
          />
        </label>
      </div>

      <div className="flex justify-end gap-sm border-t border-border pt-md">
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

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedLicense, setSelectedLicense] =
    useState<LicenseSubscription | null>(null);
  const [formMode, setFormMode] = useState<LicenseFormMode | null>(null);
  const [editingLicense, setEditingLicense] =
    useState<LicenseSubscription | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const filters: LicenseSubscriptionFilters = useMemo(() => {
    const nextFilters: LicenseSubscriptionFilters = {
      search,
      type,
    };

    if (showDeleted) {
      nextFilters.deleted = "true";
    }

    if (!showDeleted && statusFilter === "active") {
      nextFilters.is_active = "true";
    }

    if (!showDeleted && statusFilter === "inactive") {
      nextFilters.is_active = "false";
    }

    if (!showDeleted && statusFilter === "expired") {
      nextFilters.expired = "true";
    }

    if (!showDeleted && statusFilter === "upcoming") {
      nextFilters.upcoming = "true";
    }

    return nextFilters;
  }, [search, type, statusFilter, showDeleted]);

  const licensesQuery = useLicenseSubscriptions(filters);
  const summaryQuery = useLicenseSubscriptionSummary();
  const assetsQuery = useAssets({});

  const createMutation = useCreateLicenseSubscription();
  const updateMutation = useUpdateLicenseSubscription();
  const deleteMutation = useDeleteLicenseSubscription();
  const restoreMutation = useRestoreLicenseSubscription();

  const licenses = licensesQuery.data ?? [];
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

  if (isInitialLoading) {
    return (
      <AppShell>
        <div className="grid gap-md md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
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

        <section className="grid gap-md md:grid-cols-2 xl:grid-cols-4">
          <DataCard className="metric-card-accent p-lg">
            <IconKey size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {summary?.total ?? licenses.length}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Toplam kayıt
            </p>
          </DataCard>

          <DataCard className="metric-card-success p-lg">
            <IconUsers size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {summary?.total_seats ?? 0}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Aktif koltuk
            </p>
          </DataCard>

          <DataCard className="metric-card-warning p-lg">
            <IconCalendar size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {summary?.upcoming_30_days ?? 0}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              30 gün içinde yenilenecek
            </p>
          </DataCard>

          <DataCard className="metric-card-danger p-lg">
            <IconKey size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {summary?.expired ?? 0}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Süresi dolan
            </p>
          </DataCard>
        </section>

        <DataCard className="mt-lg p-lg">
          <div className="grid gap-md xl:grid-cols-[1fr_220px_220px_220px_260px]">
            <label className="flex items-center gap-sm rounded-app border border-border bg-surface-1 px-md py-sm shadow-panel">
              <IconSearch
                size={18}
                className="text-text-secondary"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                placeholder="Lisans adı, takip kodu, tedarikçi ara..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-label="Tip filtresi"
            >
              <option value="">Tüm tipler</option>
              <option value="subscription">Abonelik</option>
              <option value="license">Lisans</option>
            </select>

            <select
              className="rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none disabled:opacity-60"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Durum filtresi"
              disabled={showDeleted}
            >
              <option value="">Tüm durumlar</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
              <option value="upcoming">30 gün içinde yenilenecek</option>
              <option value="expired">Süresi dolan</option>
            </select>

            <label className="flex items-center gap-sm rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary shadow-panel">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(event) => {
                  setShowDeleted(event.target.checked);

                  if (event.target.checked) {
                    setStatusFilter("");
                  }
                }}
              />
              <span>Silinenleri göster</span>
            </label>

            <div className="rounded-app border border-border bg-surface-1 px-md py-sm text-caption text-text-secondary shadow-panel">
              30 gün yenileme maliyeti:
              <span className="ml-xs text-body text-text-primary">
                {formatCurrency(summary?.upcoming_30_days_renewal_cost)}
              </span>
            </div>
          </div>
        </DataCard>

        <section className="mt-lg">
          <DataTable
            title={
              showDeleted
                ? "Silinen lisans ve abonelikler"
                : "Lisans ve abonelik listesi"
            }
            description={`${licenses.length} kayıt görüntüleniyor.`}
          >
            {!licenses.length ? (
              <div className="rounded-app border border-border bg-surface-1 p-lg text-center text-text-secondary">
                {showDeleted
                  ? "Silinen lisans veya abonelik bulunamadı."
                  : "Filtrelere uygun lisans veya abonelik bulunamadı."}
              </div>
            ) : (
              <table className="w-full min-w-[1360px] border-separate border-spacing-0 text-left text-body">
                <thead>
                  <tr className="text-caption text-text-secondary">
                    <th className="border-b border-border px-md py-sm font-normal">
                      Lisans / Abonelik
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Tip
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Tedarikçi
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Anahtar
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Koltuk
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Bağlı Varlık
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Bitiş
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Durum
                    </th>
                    <th className="border-b border-border px-md py-sm text-right font-normal">
                      İşlem
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {licenses.map((license) => (
                    <tr
                      key={license.id}
                      className={`transition hover:bg-surface-1 ${
                        license.is_deleted ? "opacity-70" : ""
                      }`}
                    >
                      <td className="border-b border-border px-md py-md">
                        <p className="text-text-primary">{license.name}</p>
                        <p className="text-caption text-text-secondary">
                          {license.tracking_code ?? "Takip kodu yok"}
                        </p>
                      </td>

                      <td className="border-b border-border px-md py-md text-text-secondary">
                        {license.type_label ??
                          (license.type === "license" ? "Lisans" : "Abonelik")}
                      </td>

                      <td className="border-b border-border px-md py-md text-text-secondary">
                        {license.vendor || "-"}
                      </td>

                      <td className="border-b border-border px-md py-md text-text-secondary">
                        {license.license_key_masked || "-"}
                      </td>

                      <td className="border-b border-border px-md py-md text-text-secondary">
                        {license.seat_count}
                      </td>

                      <td className="border-b border-border px-md py-md text-text-secondary">
                        {license.assigned_asset_name ? (
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
                        )}
                      </td>

                      <td className="border-b border-border px-md py-md text-text-secondary">
                        {formatDate(license.end_date)}
                      </td>

                      <td className="border-b border-border px-md py-md">
                        <StatusBadge variant={getLicenseStatusVariant(license)}>
                          {getLicenseStatusLabel(license)}
                        </StatusBadge>
                      </td>

                      <td className="border-b border-border px-md py-md">
                        <div className="flex justify-end gap-sm">
                          <GlowButton
                            variant="ghost"
                            onClick={() => setSelectedLicense(license)}
                            icon={<IconEye size={16} aria-hidden={true} />}
                          >
                            Detay
                          </GlowButton>

                          {userCanManage && (
                            <>
                              {license.is_deleted ? (
                                <GlowButton
                                  variant="ghost"
                                  onClick={() => handleRestore(license)}
                                  disabled={isSubmitting}
                                  icon={
                                    <IconRefresh
                                      size={16}
                                      aria-hidden={true}
                                    />
                                  }
                                >
                                  Geri Yükle
                                </GlowButton>
                              ) : (
                                <>
                                  <GlowButton
                                    variant="ghost"
                                    onClick={() => openEditForm(license)}
                                    icon={
                                      <IconEdit size={16} aria-hidden={true} />
                                    }
                                  >
                                    Düzenle
                                  </GlowButton>

                                  <GlowButton
                                    variant="ghost"
                                    onClick={() => handleDelete(license)}
                                    disabled={isSubmitting}
                                    icon={
                                      <IconTrash
                                        size={16}
                                        aria-hidden={true}
                                      />
                                    }
                                  >
                                    Sil
                                  </GlowButton>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataTable>
        </section>

        <SlideOverPanel
          open={Boolean(selectedLicense)}
          title={selectedLicense?.name ?? "Lisans detayı"}
          description={selectedLicense?.tracking_code ?? undefined}
          onClose={() => setSelectedLicense(null)}
        >
          {selectedLicense && (
            <div className="space-y-md">
              <div className="flex items-center justify-between gap-md rounded-panel border border-border bg-surface-1 p-md shadow-panel">
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