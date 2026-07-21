import { useEffect, useMemo, useState, type FormEvent } from "react";
import { GlowButton } from "../ui/GlowButton";
import { getAssetPrimaryCode } from "../../lib/inventory";
import {
  getEmployeeDepartmentName,
  getEmployeeJobTitleName,
  getEmployeeName,
} from "../../lib/employees";
import type { Asset } from "../../types/inventory";
import type { Employee } from "../../types/employees";
import type { AssignmentCreatePayload } from "../../types/assignments";

interface AssignmentFormProps {
  assets: Asset[];
  employees: Employee[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (payload: AssignmentCreatePayload) => void;
}

export function AssignmentForm({
  assets,
  employees,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: AssignmentFormProps) {
  const initialState = useMemo<AssignmentCreatePayload>(
    () => ({
      asset: 0,
      employee: 0,
      assigned_at: new Date().toISOString().slice(0, 10),
      notes: "",
    }),
    []
  );

  const [form, setForm] = useState<AssignmentCreatePayload>(initialState);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initialState);
    setError("");
  }, [initialState]);

  function updateField<K extends keyof AssignmentCreatePayload>(
    key: K,
    value: AssignmentCreatePayload[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.asset) {
      setError("Varlık seçimi zorunludur.");
      return;
    }

    if (!form.employee) {
      setError("Personel seçimi zorunludur.");
      return;
    }

    setError("");

    onSubmit({
      asset: Number(form.asset),
      employee: Number(form.employee),
      assigned_at: form.assigned_at || null,
      notes: form.notes?.trim() || null,
    });
  }

  const fieldClassName =
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
            <option value="">Zimmetlenecek varlık seç</option>

            {assets.map((asset) => (
              <option key={asset.id} value={String(asset.id)}>
                {asset.name} — {getAssetPrimaryCode(asset)}
              </option>
            ))}
          </select>

          {!assets.length ? (
            <p className="rounded-xl border border-warning/20 bg-warning-bg px-sm py-xs text-caption text-warning">
              Zimmetlenebilir aktif/depoda varlık bulunamadı.
            </p>
          ) : null}
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Personel *</span>
          <select
            className={fieldClassName}
            value={form.employee ? String(form.employee) : ""}
            onChange={(event) =>
              updateField(
                "employee",
                event.target.value ? Number(event.target.value) : 0
              )
            }
          >
            <option value="">Personel seç</option>

            {employees.map((employee) => {
              const departmentName = getEmployeeDepartmentName(employee);
              const jobTitleName = getEmployeeJobTitleName(employee);

              return (
                <option key={employee.id} value={String(employee.id)}>
                  {getEmployeeName(employee)}
                  {departmentName ? ` — ${departmentName}` : ""}
                  {jobTitleName ? ` / ${jobTitleName}` : ""}
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
          <span className={labelClassName}>Zimmet tarihi</span>
          <input
            type="date"
            className={fieldClassName}
            value={form.assigned_at ?? ""}
            onChange={(event) => updateField("assigned_at", event.target.value)}
          />
        </label>

        <label className="space-y-xs">
          <span className={labelClassName}>Notlar</span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
            value={form.notes ?? ""}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Zimmet teslim notu, cihaz durumu, aksesuar bilgisi..."
          />
        </label>
      </div>

      <div className="flex justify-end gap-sm border-t border-border-subtle pt-md">
        <GlowButton type="button" variant="ghost" onClick={onCancel}>
          Vazgeç
        </GlowButton>

        <GlowButton type="submit" disabled={isSubmitting || !assets.length}>
          {isSubmitting ? "Kaydediliyor" : "Zimmet oluştur"}
        </GlowButton>
      </div>
    </form>
  );
}