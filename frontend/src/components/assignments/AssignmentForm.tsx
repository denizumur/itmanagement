import { useEffect, useMemo, useState } from "react";
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

  return (
    <form className="space-y-md" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-app border border-danger bg-danger-bg px-md py-sm text-body text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-md">
        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Varlık *</span>
          <select
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.asset ? String(form.asset) : ""}
            onChange={(event) =>
              updateField("asset", event.target.value ? Number(event.target.value) : 0)
            }
          >
            <option value="">Zimmetlenecek varlık seç</option>

            {assets.map((asset) => (
              <option key={asset.id} value={String(asset.id)}>
                {asset.name} — {getAssetPrimaryCode(asset)}
              </option>
            ))}
          </select>

          {!assets.length && (
            <p className="text-caption text-warning">
              Zimmetlenebilir aktif/depoda varlık bulunamadı.
            </p>
          )}
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Personel *</span>
          <select
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
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
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">
            Zimmet tarihi
          </span>
          <input
            type="date"
            className="w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.assigned_at ?? ""}
            onChange={(event) => updateField("assigned_at", event.target.value)}
          />
        </label>

        <label className="space-y-xs">
          <span className="text-caption text-text-secondary">Notlar</span>
          <textarea
            className="min-h-28 w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary focus:outline-none"
            value={form.notes ?? ""}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Zimmet teslim notu, cihaz durumu, aksesuar bilgisi..."
          />
        </label>
      </div>

      <div className="flex justify-end gap-sm border-t border-border pt-md">
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