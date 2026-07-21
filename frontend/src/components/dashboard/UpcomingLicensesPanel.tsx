import { EmptyState } from "../common/EmptyState";
import { badgeClass, daysLabel } from "../../lib/urgency";
import type { UpcomingLicenseDto } from "../../types/dashboard";
import { DataCard } from "../ui/DataCard";

interface UpcomingLicensesPanelProps {
  licenses: UpcomingLicenseDto[];
}

export function UpcomingLicensesPanel({
  licenses,
}: UpcomingLicensesPanelProps) {
  return (
    <DataCard
      title="Yaklaşan lisanslar"
      description="30 gün içinde yenilenmesi gereken abonelikler."
    >
      {!licenses.length ? (
        <EmptyState message="30 gün içinde bitecek lisans yok." />
      ) : (
        <div className="space-y-sm">
          {licenses.map((license) => (
            <div
              key={license.id}
              className="flex items-center justify-between gap-md rounded-2xl border border-border-subtle bg-surface-0 p-md transition duration-150 hover:border-accent/30 hover:bg-surface-2 motion-reduce:transition-none"
            >
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-text-primary">
                  {license.name}
                </p>
                <p className="mt-xs text-caption text-text-secondary">
                  {license.vendor} · {license.end_date}
                </p>
              </div>

              <span className={`badge shrink-0 ${badgeClass[license.urgency]}`}>
                {daysLabel(license.days_left)}
              </span>
            </div>
          ))}
        </div>
      )}
    </DataCard>
  );
}