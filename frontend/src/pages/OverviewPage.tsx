import { IconRefresh } from "@tabler/icons-react";
import { AttentionAssetsList } from "../components/dashboard/AttentionAssetsList";
import { CategoryDoughnutChart } from "../components/dashboard/CategoryDoughnutChart";
import { MetricCard } from "../components/dashboard/MetricCard";
import { UpcomingLicensesPanel } from "../components/dashboard/UpcomingLicensesPanel";
import { ErrorState } from "../components/common/ErrorState";
import { Skeleton } from "../components/common/Skeleton";
import { AppShell } from "../components/layout/AppShell";
import { GlowButton } from "../components/ui/GlowButton";
import { PageHeader } from "../components/ui/PageHeader";
import { PageTransition } from "../components/ui/PageTransition";
import { useDashboardOverview } from "../hooks/useDashboardOverview";

export function OverviewPage() {
  const { data, isLoading, isError, refetch, isFetching } =
    useDashboardOverview();

  if (isLoading) {
    return (
      <AppShell>
        <div className="grid gap-md md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
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
      <PageTransition>
        <PageHeader
          title="Genel bakış"
          description="Bugün dikkat gerektiren envanter, lisans, bakım ve hatırlatıcı durumlarını tek ekranda izle."
          actions={
            <GlowButton
              variant="ghost"
              onClick={() => refetch()}
              disabled={isFetching}
              icon={<IconRefresh size={16} aria-hidden="true" />}
            >
              {isFetching ? "Yenileniyor" : "Veriyi yenile"}
            </GlowButton>
          }
        />

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
      </PageTransition>
    </AppShell>
  );
}