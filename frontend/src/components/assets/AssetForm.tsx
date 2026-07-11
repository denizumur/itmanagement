import { useEffect, useMemo, useState } from "react";
import { GlowButton } from "../ui/GlowButton";
import type {
  Asset,
  AssetCategory,
  AssetFormPayload,
} from "../../types/inventory";

const operationalStatusOptions = [
  { value: "active", label: "Aktif" },
  { value: "in_stock", label: "Depoda" },
  { value: "in_repair", label: "Bakımda" },
  { value: "faulty", label: "Arızalı" },
  { value: "disposed", label: "İmha edildi" },
  { value: "lost", label: "Kayıp" },
];

interface AssetFormProps {
  mode: "create" | "edit";
  asset?: Asset | null;
  categories: AssetCategory[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (payload: AssetFormPayload) => void;
}

function normalizeEditStatus(status?: string | null) {
  if (status === "assigned") {
    return "active";
  }

  return status || "in_stock";
}

export function AssetForm({
  mode,
  asset,
  categories,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: AssetFormProps) {
  const initialState = useMemo<AssetFormPayload>(
    () => ({
      name: asset?.name ?? "",
      inventory_code: asset?.inventory_code ?? "",
      serial_number: asset?.serial_number ?? "",
      brand: asset?.brand ?? "",
      model: asset?.model ?? "",
      category:
        typeof asset?.category === "number"
          ? asset.category
          : asset?.category_id ?? null,
      status: normalizeEditStatus(asset?.status),
      purchase_date: asset?.purchase_date ?? "",
      warranty_end_date: asset?.warranty_end_date ?? "",
      next_maintenance_due_date: asset?.next_maintenance_due_date ?? "",
      location: asset?.location ?? "",
      notes: asset?.notes ?? "",
    }),
    [asset]
  );

  const [form, setForm] = useState<AssetFormPayload>(initialState);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialState);
    setError("");
  }, [initialState]);

  function updateField<K extends keyof AssetFormPayload>(
    key: K,
    value: AssetFormPayload[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Varlık adı zorunludur.");
      return;
    }

    if (!form.status) {
      setError("Durum seçimi zorunludur.");
      return;
    }

    setError("");

    const payload: AssetFormPayload = {
      ...form,
      name: form.name.trim(),
      inventory_code: form.inventory_code?.trim() || null,
      serial_number: form.serial_number?.trim() || null,
      brand: form.brand?.trim() || null,
      model: form.model?.trim() || null,
      location: form.location?.trim() || null,
      notes: form.notes?.trim() || null,
      category: form.category ? Number(form.category) : null,
    };

    onSubmit(payload);
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
          <span className="text-caption text-text-secondary">Varlık adı *</span>
          <input
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Örn. Bilgi İşlem Laptop 01"
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Envanter kodu</span>
          <input
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.inventory_code ?? ""}
            onChange={(event) =>
              updateField("inventory_code", event.target.value)
            }
            placeholder="ENV-0001"
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Seri numarası</span>
          <input
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.serial_number ?? ""}
            onChange={(event) =>
              updateField("serial_number", event.target.value)
            }
            placeholder="SN123456"
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Kategori</span>
          <select
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.category ? String(form.category) : ""}
            onChange={(event) =>
              updateField(
                "category",
                event.target.value ? Number(event.target.value) : null
              )
            }
          >
            <option value="">Kategori seç</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Durum *</span>
          <select
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.status ?? "in_stock"}
            onChange={(event) => updateField("status", event.target.value)}
          >
            {operationalStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Marka</span>
          <input
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.brand ?? ""}
            onChange={(event) => updateField("brand", event.target.value)}
            placeholder="Dell, HP, Lenovo..."
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Model</span>
          <input
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.model ?? ""}
            onChange={(event) => updateField("model", event.target.value)}
            placeholder="Latitude 5420"
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Konum</span>
          <input
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.location ?? ""}
            onChange={(event) => updateField("location", event.target.value)}
            placeholder="Bilgi İşlem, Sistem Odası..."
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">
            Satın alma tarihi
          </span>
          <input
            type="date"
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.purchase_date ?? ""}
            onChange={(event) =>
              updateField("purchase_date", event.target.value)
            }
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">
            Garanti bitiş tarihi
          </span>
          <input
            type="date"
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.warranty_end_date ?? ""}
            onChange={(event) =>
              updateField("warranty_end_date", event.target.value)
            }
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">
            Sonraki bakım tarihi
          </span>
          <input
            type="date"
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.next_maintenance_due_date ?? ""}
            onChange={(event) =>
              updateField("next_maintenance_due_date", event.target.value)
            }
          />
        </label>

        <label className="space-y-xs sm:col-span-2">
          <span className="text-caption text-text-secondary">Notlar</span>
          <textarea
            className="min-h-28 w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.notes ?? ""}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Cihazla ilgili operasyonel notlar..."
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
              ? "Varlık oluştur"
              : "Değişiklikleri kaydet"}
        </GlowButton>
      </div>
    </form>
  );
}