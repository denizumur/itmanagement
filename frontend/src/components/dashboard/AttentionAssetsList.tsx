import { EmptyState } from "../common/EmptyState";
import { badgeClass, daysLabel } from "../../lib/urgency";
import type { AttentionAssetDto } from "../../types/dashboard";
import { DataCard } from "../ui/DataCard";

interface AttentionAssetsListProps {
  assets: AttentionAssetDto[];
}

export function AttentionAssetsList({ assets }: AttentionAssetsListProps) {
  return (
    <DataCard
      title="Dikkat gerektiren varlıklar"
      description="Garanti, bakım ve risk bayraklarına göre önceliklendirilmiş liste."
    >
      {!assets.length ? (
        <EmptyState message="Dikkat gerektiren varlık yok." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-subtle">
          <table className="w-full border-separate border-spacing-0 text-left text-body">
            <thead className="bg-surface-2/80">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                <th className="border-b border-border-subtle px-md py-sm">
                  Cihaz
                </th>
                <th className="border-b border-border-subtle px-md py-sm">
                  Kategori
                </th>
                <th className="border-b border-border-subtle px-md py-sm">
                  Durum
                </th>
                <th className="border-b border-border-subtle px-md py-sm text-right">
                  Kalan
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border-subtle bg-surface-1">
              {assets.map((asset, index) => (
                <tr
                  key={`${asset.id}-${asset.flag_type}-${index}`}
                  className="transition duration-150 hover:bg-surface-2/80"
                >
                  <td className="px-md py-md">
                    <p className="font-semibold text-text-primary">
                      {asset.name}
                    </p>
                    <p className="mt-xs text-caption text-text-secondary">
                      {asset.inventory_code ?? "Kod yok"}
                    </p>
                  </td>

                  <td className="px-md py-md text-text-secondary">
                    {asset.category ?? "-"}
                  </td>

                  <td className="px-md py-md">
                    <span className={`badge ${badgeClass[asset.flag_level]}`}>
                      {asset.flag_label}
                    </span>
                  </td>

                  <td className="px-md py-md text-right text-text-secondary">
                    {daysLabel(asset.days_remaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataCard>
  );
}