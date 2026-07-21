import { useEffect, useMemo, useState, type FormEvent } from "react";
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

interface AssetFormEmployee {
  id: number;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
  employee_code?: string | null;

  department?: number | string | { id?: number; name?: string | null } | null;
  department_name?: string | null;

  job_title?: number | string | { id?: number; name?: string | null } | null;
  job_title_name?: string | null;
}

export interface AssetFormSubmitPayload {
  asset: AssetFormPayload;
  assignment?: {
    employee: number;
    assigned_at: string;
    notes?: string | null;
  } | null;
}

interface AssetFormProps {
  mode: "create" | "edit";
  asset?: Asset | null;
  categories: AssetCategory[];
  employees?: AssetFormEmployee[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (payload: AssetFormSubmitPayload) => void;
}

function normalizeEditStatus(status?: string | null) {
  if (status === "assigned") {
    return "active";
  }

  return status || "in_stock";
}

function todayAsInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getEmployeeDisplayName(employee: AssetFormEmployee) {
  return (
    employee.full_name ||
    employee.name ||
    employee.employee_code ||
    `Personel #${employee.id}`
  );
}

function getEmployeeSubLabel(employee: AssetFormEmployee) {
  const departmentName =
    typeof employee.department === "object"
      ? employee.department?.name
      : employee.department;

  const jobTitleName =
    typeof employee.job_title === "object"
      ? employee.job_title?.name
      : employee.job_title;

  return (
    employee.department_name ||
    employee.job_title_name ||
    departmentName ||
    jobTitleName ||
    employee.employee_code ||
    ""
  );
}

export function AssetForm({
  mode,
  asset,
  categories,
  employees = [],
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
  const [assignAfterCreate, setAssignAfterCreate] = useState(false);
  const [assignmentEmployee, setAssignmentEmployee] = useState("");
  const [assignedAt, setAssignedAt] = useState(todayAsInputValue());
  const [assignmentNotes, setAssignmentNotes] = useState("");

  useEffect(() => {
    setForm(initialState);
    setError("");
    setAssignAfterCreate(false);
    setAssignmentEmployee("");
    setAssignedAt(todayAsInputValue());
    setAssignmentNotes("");
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Varlık adı zorunludur.");
      return;
    }

    if (!form.status) {
      setError("Durum seçimi zorunludur.");
      return;
    }

    if (mode === "create" && assignAfterCreate) {
      if (!assignmentEmployee) {
        setError("Kaydet ve zimmetle için personel seçimi zorunludur.");
        return;
      }

      if (!assignedAt) {
        setError("Zimmet tarihi zorunludur.");
        return;
      }
    }

    setError("");

    const assetPayload: AssetFormPayload = {
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

    onSubmit({
      asset: assetPayload,
      assignment:
        mode === "create" && assignAfterCreate
          ? {
              employee: Number(assignmentEmployee),
              assigned_at: assignedAt,
              notes: assignmentNotes.trim() || null,
            }
          : null,
    });
  }

  const showAssignmentSection = mode === "create";

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

      <div className="grid gap-md sm:grid-cols-2">
        <label className="space-y-xs sm:col-span-2">
          <span className={labelClassName}>Varlık adı *</span>
          <input
            className={fieldClassName}
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Örn. Bilgi İşlem Laptop 01"
          />
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Envanter kodu</span>
          <input
            className={fieldClassName}
            value={form.inventory_code ?? ""}
            onChange={(event) =>
              updateField("inventory_code", event.target.value)
            }
            placeholder="ENV-0001"
          />
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Seri numarası</span>
          <input
            className={fieldClassName}
            value={form.serial_number ?? ""}
            onChange={(event) =>
              updateField("serial_number", event.target.value)
            }
            placeholder="SN123456"
          />
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Kategori</span>
          <select
            className={fieldClassName}
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
          <span className={labelClassName}>Durum *</span>
          <select
            className={fieldClassName}
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
          <span className={labelClassName}>Marka</span>
          <input
            className={fieldClassName}
            value={form.brand ?? ""}
            onChange={(event) => updateField("brand", event.target.value)}
            placeholder="Dell, HP, Lenovo..."
          />
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Model</span>
          <input
            className={fieldClassName}
            value={form.model ?? ""}
            onChange={(event) => updateField("model", event.target.value)}
            placeholder="Latitude 5420"
          />
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Konum</span>
          <input
            className={fieldClassName}
            value={form.location ?? ""}
            onChange={(event) => updateField("location", event.target.value)}
            placeholder="Bilgi İşlem, Sistem Odası..."
          />
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Satın alma tarihi</span>
          <input
            type="date"
            className={fieldClassName}
            value={form.purchase_date ?? ""}
            onChange={(event) =>
              updateField("purchase_date", event.target.value)
            }
          />
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Garanti bitiş tarihi</span>
          <input
            type="date"
            className={fieldClassName}
            value={form.warranty_end_date ?? ""}
            onChange={(event) =>
              updateField("warranty_end_date", event.target.value)
            }
          />
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Sonraki bakım tarihi</span>
          <input
            type="date"
            className={fieldClassName}
            value={form.next_maintenance_due_date ?? ""}
            onChange={(event) =>
              updateField("next_maintenance_due_date", event.target.value)
            }
          />
        </label>

        <label className="space-y-xs sm:col-span-2">
          <span className={labelClassName}>Notlar</span>
          <textarea
            className={`${textareaClassName} min-h-28`}
            value={form.notes ?? ""}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Cihazla ilgili operasyonel notlar..."
          />
        </label>

        {showAssignmentSection ? (
          <div className="space-y-md rounded-panel border border-border-subtle bg-surface-0 p-md sm:col-span-2">
            <label className="flex items-start gap-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent/20"
                checked={assignAfterCreate}
                onChange={(event) => setAssignAfterCreate(event.target.checked)}
              />

              <span>
                <span className="block text-body font-semibold text-text-primary">
                  Kaydettikten sonra zimmetle
                </span>
                <span className="mt-xs block text-caption text-text-secondary">
                  Önce varlık oluşturulur, ardından seçilen personel için gerçek
                  zimmet kaydı açılır.
                </span>
              </span>
            </label>

            {assignAfterCreate ? (
              <div className="grid gap-md border-t border-border-subtle pt-md sm:grid-cols-2">
                <label className="space-y-xs">
                  <span className={labelClassName}>Personel *</span>
                  <select
                    className={fieldClassName}
                    value={assignmentEmployee}
                    onChange={(event) =>
                      setAssignmentEmployee(event.target.value)
                    }
                  >
                    <option value="">Personel seç</option>
                    {employees.map((employee) => {
                      const subLabel = getEmployeeSubLabel(employee);

                      return (
                        <option key={employee.id} value={String(employee.id)}>
                          {getEmployeeDisplayName(employee)}
                          {subLabel ? ` — ${subLabel}` : ""}
                        </option>
                      );
                    })}
                  </select>

                  {!employees.length ? (
                    <p className="rounded-xl border border-warning/20 bg-warning-bg px-sm py-xs text-caption text-warning">
                      Personel listesi alınamadı veya kayıtlı personel yok.
                    </p>
                  ) : null}
                </label>

                <label className="space-y-xs">
                  <span className={labelClassName}>Zimmet tarihi *</span>
                  <input
                    type="date"
                    className={fieldClassName}
                    value={assignedAt}
                    onChange={(event) => setAssignedAt(event.target.value)}
                  />
                </label>

                <label className="space-y-xs sm:col-span-2">
                  <span className={labelClassName}>Zimmet notu</span>
                  <textarea
                    className={`${textareaClassName} min-h-24`}
                    value={assignmentNotes}
                    onChange={(event) => setAssignmentNotes(event.target.value)}
                    placeholder="Teslim notu, ekipman durumu, aksesuar bilgisi..."
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-sm border-t border-border-subtle pt-md">
        <GlowButton type="button" variant="ghost" onClick={onCancel}>
          Vazgeç
        </GlowButton>

        <GlowButton type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Kaydediliyor"
            : mode === "create" && assignAfterCreate
              ? "Varlık oluştur ve zimmetle"
              : mode === "create"
                ? "Varlık oluştur"
                : "Değişiklikleri kaydet"}
        </GlowButton>
      </div>
    </form>
  );
}