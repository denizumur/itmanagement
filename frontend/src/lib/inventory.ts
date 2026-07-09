import type {
  Asset,
  AssetCategory,
  AssetStatus,
  AssetSummary,
} from "../types/inventory";

export const assetStatusLabel: Record<string, string> = {
  active: "Aktif",
  assigned: "Zimmetli",
  in_stock: "Depoda",
  in_repair: "Bakımda",
  faulty: "Arızalı",
  disposed: "İmha edildi",
  lost: "Kayıp",
};

export const assetStatusVariant: Record<
  string,
  "accent" | "success" | "warning" | "danger" | "neutral"
> = {
  active: "success",
  assigned: "accent",
  in_stock: "neutral",
  in_repair: "warning",
  faulty: "danger",
  disposed: "danger",
  lost: "danger",
};

const statusAliases: Record<string, string> = {
  active: "active",
  aktif: "active",

  assigned: "assigned",
  zimmetli: "assigned",

  in_stock: "in_stock",
  stock: "in_stock",
  stok: "in_stock",
  stokta: "in_stock",
  depoda: "in_stock",

  in_repair: "in_repair",
  repair: "in_repair",
  bakımda: "in_repair",
  bakimda: "in_repair",
  bakımda_onarımda: "in_repair",
  bakimda_onarimda: "in_repair",

  faulty: "faulty",
  arızalı: "faulty",
  arizali: "faulty",

  disposed: "disposed",
  imha: "disposed",
  imha_edildi: "disposed",

  lost: "lost",
  kayıp: "lost",
  kayip: "lost",
};

export function normalizeStatus(status: AssetStatus | null | undefined) {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_")
    .replaceAll("/", "_");
}

export function getCanonicalAssetStatus(status: AssetStatus | null | undefined) {
  const normalized = normalizeStatus(status);
  return statusAliases[normalized] ?? normalized;
}

export function getAssetStatusLabel(status: AssetStatus) {
  const canonical = getCanonicalAssetStatus(status);
  return assetStatusLabel[canonical] ?? String(status);
}

export function getAssetStatusVariant(status: AssetStatus) {
  const canonical = getCanonicalAssetStatus(status);
  return assetStatusVariant[canonical] ?? "neutral";
}

export function getAssetCategoryName(
  asset: Asset,
  categories: AssetCategory[] = []
) {
  if (asset.category_name) {
    return asset.category_name;
  }

  if (asset.category_display) {
    return asset.category_display;
  }

  if (asset.category_detail?.name) {
    return asset.category_detail.name;
  }

  if (!asset.category) {
    return "-";
  }

  if (typeof asset.category === "string") {
    return asset.category;
  }

  if (typeof asset.category === "number") {
    return (
      categories.find((category) => category.id === asset.category)?.name ??
      `Kategori #${asset.category}`
    );
  }

  return asset.category.name ?? "-";
}

export function getAssetPrimaryCode(asset: Asset) {
  return asset.inventory_code || asset.serial_number || `#${asset.id}`;
}

function getNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

export function getSummaryTotal(summary: AssetSummary | undefined, fallback = 0) {
  if (!summary) {
    return fallback;
  }

  return (
    getNumber(summary.total_assets) ||
    getNumber(summary.total) ||
    getNumber(summary.count) ||
    fallback
  );
}

export function getSummaryStatusCount(
  summary: AssetSummary | undefined,
  status: string
) {
  if (!summary) {
    return 0;
  }

  const canonical = getCanonicalAssetStatus(status);
  const directKeys = [
    canonical,
    `${canonical}_assets`,
    `${canonical}_count`,
    `total_${canonical}`,
  ];

  for (const key of directKeys) {
    const value = getNumber(summary[key]);

    if (value) {
      return value;
    }
  }

  const byStatus = summary.by_status;

  if (byStatus && typeof byStatus === "object") {
    for (const [key, value] of Object.entries(byStatus)) {
      if (getCanonicalAssetStatus(key) === canonical) {
        return getNumber(value);
      }
    }
  }

  const arrays = [summary.status_counts, summary.asset_status_counts];

  for (const itemArray of arrays) {
    if (!Array.isArray(itemArray)) {
      continue;
    }

    const found = itemArray.find((item) => {
      const itemStatus = getCanonicalAssetStatus(
        item.status ?? item.key ?? item.label
      );

      return itemStatus === canonical;
    });

    if (found) {
      return getNumber(found.count);
    }
  }

  return 0;
}

export function countAssetsByStatus(assets: Asset[], statuses: string[]) {
  const canonicalStatuses = statuses.map((status) =>
    getCanonicalAssetStatus(status)
  );

  return assets.filter((asset) =>
    canonicalStatuses.includes(getCanonicalAssetStatus(asset.status))
  ).length;
}