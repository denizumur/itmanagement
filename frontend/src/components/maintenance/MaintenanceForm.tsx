import { useEffect, useMemo, useState, type FormEvent } from "react";
import { GlowButton } from "../ui/GlowButton";
import { getAssetPrimaryCode } from "../../lib/inventory";
import type { Asset } from "../../types/inventory";
import type { MaintenanceCreatePayload } from "../../types/maintenance";

type MaintenanceFormType = "maintenance" | "repair" | "disposal";

interface MaintenanceFormState {
  asset: number;
  type: MaintenanceFormType;
  performed_at: string;
  next_due_date: string;
  frequency_days: string;
  cost: string;
  performed_by: string;
  description: string;
  asset_status_after: string;
}

interface MaintenanceFormProps {
  assets: Asset[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (payload: MaintenanceCreatePayload) => void;
}

const typeOptions: Array<{
  value: MaintenanceFormType;
  label: string;
  description: string;
}> = [
  {
    value: "maintenance",
    label: "Bakım",
    description: "Periyodik kontrol, temizlik, bakım ve sonraki bakım planı.",
  },
  {
    value: "repair",
    label: "Onarım",
    description: "Arıza giderme, parça değişimi veya servis işlemi.",
  },
  {
    value: "disposal",
    label: "İmha",
    description: "Ekonomik ömrünü tamamlayan veya kullanımdan çıkan varlık.",
  },
];

const assetStatusAfterOptions = [
  { value: "", label: "Durumu değiştirme" },
  { value: "active", label: "Aktif" },
  { value: "in_stock", label: "Depoda" },
  { value: "in_repair", label: "Bakımda / Onarımda" },
  { value: "faulty", label: "Arızalı" },
  { value: "disposed", label: "İmha edildi" },
];

function todayAsInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function MaintenanceForm({
  assets,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: MaintenanceFormProps) {
  const initialState = useMemo<MaintenanceFormState>(
    () => ({
      asset: 0,
      type: "maintenance",
      performed_at: todayAsInputValue(),
      next_due_date: "",
      frequency_days: "",
      cost: "",
      performed_by: "Bilgi İşlem",
      description: "",
      asset_status_after: "",
    }),
    []
  );

  const [form, setForm] = useState<MaintenanceFormState>(initialState);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialState);
    setError("");
  }, [initialState]);

  function updateField<K extends keyof MaintenanceFormState>(
    key: K,
    value: MaintenanceFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleTypeChange(type: MaintenanceFormType) {
    setForm((current) => ({
      ...current,
      type,
      next_due_date: type === "maintenance" ? current.next_due_date : "",
      frequency_days: type === "maintenance" ? current.frequency_days : "",
      asset_status_after:
        type === "disposal"
          ? "disposed"
          : current.asset_status_after === "disposed"
            ? ""
            : current.asset_status_after,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.asset) {
      setError("Varlık seçimi zorunludur.");
      return;
    }

    if (!form.type) {
      setError("Kayıt türü zorunludur.");
      return;
    }

    if (!form.performed_at) {
      setError("İşlem tarihi zorunludur.");
      return;
    }

    if (!form.description.trim()) {
      setError("Açıklama zorunludur.");
      return;
    }

    if (form.cost && Number(form.cost) < 0) {
      setError("Maliyet negatif olamaz.");
      return;
    }

    setError("");

    onSubmit({
      asset: Number(form.asset),
      type: form.type,
      record_type: form.type,
      performed_at: form.performed_at || null,
      next_due_date:
        form.type === "maintenance" && form.next_due_date
          ? form.next_due_date
          : null,
      frequency_days:
        form.type === "maintenance" && form.frequency_days
          ? Number(form.frequency_days)
          : null,
      cost: form.cost === "" ? null : form.cost,
      performed_by: form.performed_by.trim() || null,
      description: form.description.trim(),
      asset_status_after:
        form.type === "disposal"
          ? "disposed"
          : form.asset_status_after || "",
    });
  }

  const fieldClassName =
    "w-full rounded-2xl border border-border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20";

  const textareaClassName =
    "w-full rounded-2xl border border-border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20";

  const labelClassName = "text-caption font-medium text-text-secondary";

  return (
    <form className="space-y-md" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger-bg px-md py-sm text-body font-medium text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-md">
        <div className="space-y-xs">
          <span className={labelClassName}>Kayıt türü *</span>

          <div className="grid gap-sm">
            {typeOptions.map((option) => {
              const selected = form.type === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    "rounded-2xl border px-md py-sm text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-accent/20",
                    selected
                      ? "border-accent bg-accent-bg text-accent"
                      : "border-border-subtle bg-surface-0 text-text-secondary hover:border-accent hover:bg-accent-bg hover:text-text-primary",
                  ].join(" ")}
                  onClick={() => handleTypeChange(option.value)}
                >
                  <p className="text-body font-semibold">{option.label}</p>
                  <p className="mt-xs text-caption">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <label className="space-y-xs">
          <span className={labelClassName}>Varlık *</span>
          <select
            className={fieldClassName}
            value={form.asset ? String(form.asset) : ""}
            onChange={(event) =>
              updateField(
                "asset",
                event.target.value ? Number(event.target.value) : 0
              )
            }
          >
            <option value="">İşlem yapılacak varlığı seç</option>

            {assets.map((asset) => (
              <option key={asset.id} value={String(asset.id)}>
                {asset.name} — {getAssetPrimaryCode(asset)}
              </option>
            ))}
          </select>

          {!assets.length ? (
            <p className="rounded-xl border border-warning/20 bg-warning-bg px-sm py-xs text-caption text-warning">
              İşlem yapılabilir varlık bulunamadı.
            </p>
          ) : null}
        </label>

        <div className="grid gap-md md:grid-cols-2">
          <label className="space-y-xs">
            <span className={labelClassName}>İşlem tarihi *</span>
            <input
              type="date"
              className={fieldClassName}
              value={form.performed_at}
              onChange={(event) =>
                updateField("performed_at", event.target.value)
              }
            />
          </label>

          <label className="space-y-xs">
            <span className={labelClassName}>Maliyet</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className={fieldClassName}
              value={form.cost}
              onChange={(event) => updateField("cost", event.target.value)}
              placeholder="0"
            />
          </label>
        </div>

        {form.type === "maintenance" ? (
          <div className="grid gap-md md:grid-cols-2">
            <label className="space-y-xs">
              <span className={labelClassName}>Sonraki bakım tarihi</span>
              <input
                type="date"
                className={fieldClassName}
                value={form.next_due_date}
                onChange={(event) =>
                  updateField("next_due_date", event.target.value)
                }
              />
            </label>

            <label className="space-y-xs">
              <span className={labelClassName}>Bakım periyodu / gün</span>
              <input
                type="number"
                min="1"
                className={fieldClassName}
                value={form.frequency_days}
                onChange={(event) =>
                  updateField("frequency_days", event.target.value)
                }
                placeholder="Örn. 180"
              />
            </label>
          </div>
        ) : null}

        <label className="space-y-xs">
          <span className={labelClassName}>İşlem sonrası varlık durumu</span>
          <select
            className="w-full rounded-2xl border border-border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-70"
            value={form.asset_status_after}
            disabled={form.type === "disposal"}
            onChange={(event) =>
              updateField("asset_status_after", event.target.value)
            }
          >
            {assetStatusAfterOptions.map((option) => (
              <option key={option.value || "none"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {form.type === "disposal" ? (
            <p className="rounded-xl border border-danger/20 bg-danger-bg px-sm py-xs text-caption text-danger">
              İmha kaydı oluşturulduğunda varlık durumu otomatik olarak “İmha
              edildi” yapılır.
            </p>
          ) : null}
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>İşlem yapan / servis</span>
          <input
            className={fieldClassName}
            value={form.performed_by}
            onChange={(event) =>
              updateField("performed_by", event.target.value)
            }
            placeholder="Bilgi İşlem, Yetkili Servis, DEMO Teknik Servis..."
          />
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Açıklama *</span>
          <textarea
            className={`${textareaClassName} min-h-32`}
            value={form.description}
            onChange={(event) =>
              updateField("description", event.target.value)
            }
            placeholder="Yapılan işlem, arıza açıklaması, parça değişimi, imha gerekçesi..."
          />
        </label>
      </div>

      <div className="flex justify-end gap-sm border-t border-border-subtle pt-md">
        <GlowButton type="button" variant="ghost" onClick={onCancel}>
          Vazgeç
        </GlowButton>

        <GlowButton type="submit" disabled={isSubmitting || !assets.length}>
          {isSubmitting ? "Kaydediliyor" : "Kaydı oluştur"}
        </GlowButton>
      </div>
    </form>
  );
}