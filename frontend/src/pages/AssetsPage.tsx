import {
  IconDeviceDesktop,
  IconEdit,
  IconEye,
  IconPlus,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { ErrorState } from "../components/common/ErrorState";
import { Skeleton } from "../components/common/Skeleton";
import { AppShell } from "../components/layout/AppShell";
import { DataCard } from "../components/ui/DataCard";
import { DataTable } from "../components/ui/DataTable";
import { GlowButton } from "../components/ui/GlowButton";
import { PageHeader } from "../components/ui/PageHeader";
import { PageTransition } from "../components/ui/PageTransition";
import { SlideOverPanel } from "../components/ui/SlideOverPanel";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useActiveAssignments } from "../hooks/useAssignments";
import {
  useAssetCategories,
  useAssets,
  useAssetSummary,
} from "../hooks/useInventory";
import {
  buildActiveAssignmentMap,
  getAssignmentDepartmentName,
  getAssignmentEmployeeName,
} from "../lib/assignments";
import {
  countAssetsByStatus,
  getAssetCategoryName,
  getAssetPrimaryCode,
  getAssetStatusLabel,
  getAssetStatusVariant,
  getSummaryStatusCount,
  getSummaryTotal,
} from "../lib/inventory";
import { canManage } from "../lib/rbac";
import type { Asset, AssetFilters } from "../types/inventory";

const statusOptions = [
  { value: "", label: "Tüm durumlar" },
  { value: "active", label: "Aktif" },
  { value: "assigned", label: "Zimmetli kayıtlar" },
  { value: "in_stock", label: "Depoda" },
  { value: "in_repair", label: "Bakımda" },
  { value: "faulty", label: "Arızalı" },
  { value: "disposed", label: "İmha edildi" },
  { value: "lost", label: "Kayıp" },
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

function formatDateTime(value?: string | null) {
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getOperationalStatusLabel(status: string) {
  if (status === "assigned") {
    return "Aktif";
  }

  return getAssetStatusLabel(status);
}

function getOperationalStatusVariant(status: string) {
  if (status === "assigned") {
    return "success";
  }

  return getAssetStatusVariant(status);
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

function DateCell({ value }: { value?: string | null }) {
  return (
    <span className="inline-flex min-w-[108px] items-center justify-center rounded-app border border-border bg-surface-1 px-sm py-xs text-caption text-text-secondary shadow-panel">
      {formatDate(value)}
    </span>
  );
}

export function AssetsPage() {
  const { user } = useAuth();
  const userCanManage = canManage(user?.role);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const filters: AssetFilters = useMemo(
    () => ({
      search,
      status,
      category,
    }),
    [search, status, category]
  );

  const assetsQuery = useAssets(filters);
  const summaryQuery = useAssetSummary();
  const categoriesQuery = useAssetCategories();
  const activeAssignmentsQuery = useActiveAssignments();

  const assets = assetsQuery.data ?? [];
  const summary = summaryQuery.data;
  const categories = categoriesQuery.data ?? [];
  const activeAssignments = activeAssignmentsQuery.data ?? [];

  const activeAssignmentMap = useMemo(
    () => buildActiveAssignmentMap(activeAssignments),
    [activeAssignments]
  );

  const totalAssets = getSummaryTotal(summary, assets.length);

  const activeAssets =
    getSummaryStatusCount(summary, "active") +
      countAssetsByStatus(assets, ["assigned", "zimmetli"]) ||
    countAssetsByStatus(assets, ["active", "aktif", "assigned", "zimmetli"]);

  const assignedAssets =
    activeAssignments.length ||
    getSummaryStatusCount(summary, "assigned") ||
    countAssetsByStatus(assets, ["assigned", "zimmetli"]);

  const inRepairAssets =
    getSummaryStatusCount(summary, "in_repair") ||
    countAssetsByStatus(assets, [
      "in_repair",
      "repair",
      "bakımda",
      "bakimda",
      "bakımda_onarımda",
      "bakimda_onarimda",
    ]);

  const faultyAssets =
    getSummaryStatusCount(summary, "faulty") ||
    countAssetsByStatus(assets, ["faulty", "arızalı", "arizali"]);

  const isInitialLoading =
    assetsQuery.isLoading ||
    summaryQuery.isLoading ||
    categoriesQuery.isLoading ||
    activeAssignmentsQuery.isLoading;

  const hasError =
    assetsQuery.isError ||
    summaryQuery.isError ||
    categoriesQuery.isError ||
    activeAssignmentsQuery.isError;

  function refetchAll() {
    assetsQuery.refetch();
    summaryQuery.refetch();
    categoriesQuery.refetch();
    activeAssignmentsQuery.refetch();
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
        <ErrorState message="Envanter veya aktif zimmet verisi alınamadı. API endpointlerini ve yetki durumunu kontrol et." />
      </AppShell>
    );
  }

  const selectedAssetAssignment = selectedAsset
    ? activeAssignmentMap.get(selectedAsset.id)
    : null;

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          eyebrow="Envanter Yönetimi"
          title="Envanter"
          description="Şirket içindeki cihazları, zimmet durumlarını, garanti ve bakım risklerini tek ekrandan takip et."
          actions={
            <>
              <GlowButton
                variant="ghost"
                onClick={refetchAll}
                disabled={assetsQuery.isFetching || activeAssignmentsQuery.isFetching}
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                {assetsQuery.isFetching || activeAssignmentsQuery.isFetching
                  ? "Yenileniyor"
                  : "Veriyi yenile"}
              </GlowButton>

              {userCanManage && (
                <GlowButton
                  icon={<IconPlus size={16} aria-hidden={true} />}
                  onClick={() => {
                    alert("Yeni Varlık formu sonraki fazda bağlanacak.");
                  }}
                >
                  Yeni Varlık
                </GlowButton>
              )}
            </>
          }
        />

        <section className="grid gap-md md:grid-cols-2 xl:grid-cols-4">
          <DataCard className="metric-card-accent p-lg">
            <IconDeviceDesktop size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {totalAssets}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Toplam varlık
            </p>
          </DataCard>

          <DataCard className="metric-card-success p-lg">
            <IconDeviceDesktop size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {activeAssets}
            </p>
            <p className="mt-sm text-caption text-text-secondary">Aktif</p>
          </DataCard>

          <DataCard className="metric-card-warning p-lg">
            <IconDeviceDesktop size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {assignedAssets}
            </p>
            <p className="mt-sm text-caption text-text-secondary">Zimmetli</p>
          </DataCard>

          <DataCard className="metric-card-danger p-lg">
            <IconDeviceDesktop size={22} aria-hidden={true} />
            <p className="mt-md text-[30px] font-medium leading-none">
              {inRepairAssets + faultyAssets}
            </p>
            <p className="mt-sm text-caption text-text-secondary">
              Bakım / arıza
            </p>
          </DataCard>
        </section>

        <DataCard className="mt-lg p-lg">
          <div className="grid gap-md lg:grid-cols-[1fr_220px_220px]">
            <label className="flex items-center gap-sm rounded-app border border-border bg-surface-1 px-md py-sm shadow-panel">
              <IconSearch
                size={18}
                className="text-text-secondary"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                placeholder="Varlık adı, envanter kodu, seri no ara..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Durum filtresi"
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Kategori filtresi"
            >
              <option value="">Tüm kategoriler</option>

              {categories.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </DataCard>

        <section className="mt-lg">
          <DataTable
            title="Varlık listesi"
            description={`${assets.length} kayıt görüntüleniyor.`}
          >
            {!assets.length ? (
              <div className="rounded-app border border-border bg-surface-1 p-lg text-center text-text-secondary">
                Filtrelere uygun varlık bulunamadı.
              </div>
            ) : (
              <table className="w-full min-w-[1360px] border-separate border-spacing-0 text-left text-body">
                <thead>
                  <tr className="text-caption text-text-secondary">
                    <th className="border-b border-border px-md py-sm font-normal">
                      Varlık
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Kategori
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Marka / Model
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Durum
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Zimmetli Kişi
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Konum
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Garanti
                    </th>
                    <th className="border-b border-border px-md py-sm font-normal">
                      Sonraki Bakım
                    </th>
                    <th className="border-b border-border px-md py-sm text-right font-normal">
                      İşlem
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {assets.map((asset) => {
                    const activeAssignment = activeAssignmentMap.get(asset.id);
                    const employeeName = activeAssignment
                      ? getAssignmentEmployeeName(activeAssignment)
                      : "Boşta";
                    const departmentName = activeAssignment
                      ? getAssignmentDepartmentName(activeAssignment)
                      : null;

                    return (
                      <tr
                        key={asset.id}
                        className="transition hover:bg-surface-1"
                      >
                        <td className="border-b border-border px-md py-md">
                          <p className="text-text-primary">{asset.name}</p>
                          <p className="text-caption text-text-secondary">
                            {getAssetPrimaryCode(asset)}
                          </p>
                        </td>

                        <td className="border-b border-border px-md py-md text-text-secondary">
                          {getAssetCategoryName(asset, categories)}
                        </td>

                        <td className="border-b border-border px-md py-md text-text-secondary">
                          {[asset.brand, asset.model].filter(Boolean).join(" / ") ||
                            "-"}
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <StatusBadge
                            variant={getOperationalStatusVariant(asset.status)}
                          >
                            {getOperationalStatusLabel(asset.status)}
                          </StatusBadge>
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <div>
                            <p className="text-body text-text-primary">
                              {employeeName}
                            </p>
                            {departmentName && (
                              <p className="text-caption text-text-secondary">
                                {departmentName}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="border-b border-border px-md py-md text-text-secondary">
                          {asset.location ?? "-"}
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <DateCell value={asset.warranty_end_date} />
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <DateCell value={asset.next_maintenance_due_date} />
                        </td>

                        <td className="border-b border-border px-md py-md">
                          <div className="flex justify-end gap-sm">
                            <GlowButton
                              variant="ghost"
                              onClick={() => setSelectedAsset(asset)}
                              icon={<IconEye size={16} aria-hidden={true} />}
                            >
                              Detay
                            </GlowButton>

                            {userCanManage && (
                              <GlowButton
                                variant="ghost"
                                onClick={() => {
                                  alert(
                                    "Düzenleme formu sonraki fazda bağlanacak."
                                  );
                                }}
                                icon={<IconEdit size={16} aria-hidden={true} />}
                              >
                                Düzenle
                              </GlowButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </DataTable>
        </section>

        <SlideOverPanel
          open={Boolean(selectedAsset)}
          title={selectedAsset?.name ?? "Varlık detayı"}
          description={
            selectedAsset ? getAssetPrimaryCode(selectedAsset) : undefined
          }
          onClose={() => setSelectedAsset(null)}
        >
          {selectedAsset && (
            <div className="space-y-md">
              <div className="flex items-center justify-between gap-md rounded-panel border border-border bg-surface-1 p-md shadow-panel">
                <div>
                  <p className="text-caption text-text-secondary">Durum</p>

                  <StatusBadge
                    variant={getOperationalStatusVariant(selectedAsset.status)}
                  >
                    {getOperationalStatusLabel(selectedAsset.status)}
                  </StatusBadge>
                </div>

                {userCanManage && (
                  <GlowButton
                    variant="ghost"
                    icon={<IconEdit size={16} aria-hidden={true} />}
                    onClick={() => {
                      alert(
                        "Detay panelinden düzenleme sonraki fazda bağlanacak."
                      );
                    }}
                  >
                    Düzenle
                  </GlowButton>
                )}
              </div>

              <div className="grid gap-md sm:grid-cols-2">
                <DetailRow
                  label="Envanter kodu"
                  value={selectedAsset.inventory_code}
                />

                <DetailRow
                  label="Seri numarası"
                  value={selectedAsset.serial_number}
                />

                <DetailRow
                  label="Kategori"
                  value={getAssetCategoryName(selectedAsset, categories)}
                />

                <DetailRow
                  label="Durum"
                  value={getOperationalStatusLabel(selectedAsset.status)}
                />

                <DetailRow
                  label="Aktif zimmet"
                  value={
                    selectedAssetAssignment
                      ? getAssignmentEmployeeName(selectedAssetAssignment)
                      : "Boşta"
                  }
                />

                <DetailRow
                  label="Zimmet departmanı"
                  value={
                    selectedAssetAssignment
                      ? getAssignmentDepartmentName(selectedAssetAssignment)
                      : null
                  }
                />

                <DetailRow label="Marka" value={selectedAsset.brand} />
                <DetailRow label="Model" value={selectedAsset.model} />
                <DetailRow label="Konum" value={selectedAsset.location} />

                <DetailRow
                  label="Satın alma tarihi"
                  value={formatDate(selectedAsset.purchase_date)}
                />

                <DetailRow
                  label="Garanti bitiş tarihi"
                  value={formatDate(selectedAsset.warranty_end_date)}
                />

                <DetailRow
                  label="Sonraki bakım tarihi"
                  value={formatDate(selectedAsset.next_maintenance_due_date)}
                />

                <DetailRow
                  label="Oluşturulma tarihi"
                  value={formatDateTime(selectedAsset.created_at)}
                />

                <DetailRow
                  label="Güncellenme tarihi"
                  value={formatDateTime(selectedAsset.updated_at)}
                />
              </div>

              <DetailRow label="Notlar" value={selectedAsset.notes} />
            </div>
          )}
        </SlideOverPanel>
      </PageTransition>
    </AppShell>
  );
}