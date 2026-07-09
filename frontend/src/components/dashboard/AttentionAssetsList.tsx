import { EmptyState } from "../common/EmptyState";
import { badgeClass, daysLabel } from "../../lib/urgency";
import type { AttentionAssetDto } from "../../types/dashboard";

interface AttentionAssetsListProps {
  assets: AttentionAssetDto[];
}

export function AttentionAssetsList({ assets }: AttentionAssetsListProps) {
  return (
    <div className="panel">
      <p className="mb-md text-h3">Dikkat gerektiren varlıklar</p>

      {!assets.length ? (
        <EmptyState message="Dikkat gerektiren varlık yok." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-body">
            <thead>
              <tr className="border-b border-border text-caption text-text-secondary">
                <th className="py-sm font-normal">Cihaz</th>
                <th className="py-sm font-normal">Kategori</th>
                <th className="py-sm font-normal">Durum</th>
                <th className="py-sm text-right font-normal">Kalan</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset, index) => (
                <tr
                  key={`${asset.id}-${asset.flag_type}-${index}`}
                  className="border-b border-border"
                >
                  <td className="py-md">
                    <p className="text-text-primary">{asset.name}</p>
                    <p className="text-caption text-text-secondary">
                      {asset.inventory_code ?? "Kod yok"}
                    </p>
                  </td>
                  <td className="py-md text-text-secondary">
                    {asset.category ?? "-"}
                  </td>
                  <td className="py-md">
                    <span className={`badge ${badgeClass[asset.flag_level]}`}>
                      {asset.flag_label}
                    </span>
                  </td>
                  <td className="py-md text-right text-text-secondary">
                    {daysLabel(asset.days_remaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}