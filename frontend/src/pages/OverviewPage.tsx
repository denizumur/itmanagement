import { AttentionAssetsList } from "../components/dashboard/AttentionAssetsList";
import { CategoryDoughnutChart } from "../components/dashboard/CategoryDoughnutChart";
import { MetricCard } from "../components/dashboard/MetricCard";
import { UpcomingLicensesPanel } from "../components/dashboard/UpcomingLicensesPanel";
import { ErrorState } from "../components/common/ErrorState";
import { Skeleton } from "../components/common/Skeleton";
import { AppShell } from "../components/layout/AppShell";
import { useDashboardOverview } from "../hooks/useDashboardOverview";

export function OverviewPage() {
  const { data, isLoading, isError } = useDashboardOverview();

  if (isLoading) {
    return (
      <AppShell>
        <div className="grid gap-md md:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>

        <div className="mt-lg grid gap-lg xl:grid-cols-[1.3fr_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </AppShell>
    );
  }

  if (isError || !data) {
    return (
      <AppShell>
        <ErrorState message="Dashboard verisi alınamadı." />
      </AppShell>
    );
  }

  return (
    <AppShell reminderCount={data.metrics.visible_pending_reminders}>
      <div className="mb-lg">
        <h1 className="text-display">Genel bakış</h1>
        <p className="mt-sm text-text-secondary">
          Bugün dikkat gerektiren envanter, lisans ve bakım durumları.
        </p>
      </div>

      <section className="grid gap-md md:grid-cols-2 xl:grid-cols-4">
        {data.metric_cards.map((card) => (
          <MetricCard key={card.key} card={card} />
        ))}
      </section>

      <section className="mt-lg grid gap-lg xl:grid-cols-[1.3fr_1fr]">
        <CategoryDoughnutChart
          labels={data.asset_category_distribution.labels}
          counts={data.asset_category_distribution.counts}
        />

        <UpcomingLicensesPanel licenses={data.upcoming_license_list} />
      </section>

      <section className="mt-lg">
        <AttentionAssetsList assets={data.attention.assets} />
      </section>
    </AppShell>
  );
}