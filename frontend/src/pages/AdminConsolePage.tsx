import {
  IconAlertTriangle,
  IconBriefcase,
  IconChecklist,
  IconClock,
  IconDatabase,
  IconExternalLink,
  IconFileAnalytics,
  IconHistory,
  IconRefresh,
  IconServerCog,
  IconShieldCheck,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ErrorState } from "../components/common/ErrorState";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { Skeleton } from "../components/common/Skeleton";
import { AppShell } from "../components/layout/AppShell";
import { GlowButton } from "../components/ui/GlowButton";
import { PageHeader } from "../components/ui/PageHeader";
import { PageTransition } from "../components/ui/PageTransition";
import { useAdminConsoleOverview } from "../hooks/useAdminConsole";
import { cn } from "../lib/cn";
import type { HealthStatus } from "../types/adminConsole";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(value?: number | null) {
  if (!value) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getStatusTone(status: HealthStatus | string | null | undefined) {
  if (status === "healthy" || status === "success" || status === "ok") {
    return "success";
  }

  if (status === "critical" || status === "failed" || status === "error") {
    return "danger";
  }

  if (status === "warning" || status === "partial" || status === "not_configured") {
    return "warning";
  }

  return "default";
}

function getStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    healthy: "Sağlıklı",
    warning: "Uyarı",
    critical: "Kritik",
    unknown: "Bilinmiyor",
    success: "Başarılı",
    partial: "Kısmi",
    failed: "Başarısız",
    ok: "OK",
    error: "Hata",
    not_configured: "Yerel",
    dry_run: "Dry-run",
    committed: "Committed",
  };

  return status ? labels[status] ?? status : "-";
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const tone = getStatusTone(status);

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-sm py-xs text-[11px] font-semibold",
        tone === "success" && "border-success/25 bg-success-bg text-success",
        tone === "warning" && "border-warning/25 bg-warning-bg text-warning",
        tone === "danger" && "border-danger/25 bg-danger-bg text-danger",
        tone === "default" && "border-border bg-surface-2 text-text-secondary"
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function ConsolePanel({
  title,
  description,
  icon,
  children,
  testId,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-panel border border-border bg-surface-1/85 p-lg shadow-panel backdrop-blur"
    >
      <div className="mb-md flex items-start gap-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-bg text-accent">
          {icon}
        </span>
        <div>
          <h2 className="text-h3 text-text-primary">{title}</h2>
          {description ? (
            <p className="mt-xs text-body text-text-secondary">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-md border-b border-border/70 py-sm last:border-0">
      <span className="text-caption text-text-secondary">{label}</span>
      <span className="text-right text-body font-semibold text-text-primary">
        {value}
      </span>
    </div>
  );
}

function CommandLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-xs rounded-lg border border-border bg-surface-2 px-sm py-xs text-caption font-semibold text-text-secondary transition duration-150 hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none"
    >
      {children}
      <IconExternalLink size={14} aria-hidden={true} />
    </Link>
  );
}

export function AdminConsolePage() {
  const { data, isLoading, isError, refetch, isFetching } =
    useAdminConsoleOverview();

  if (isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-36" />
        <div className="mt-lg grid gap-md md:grid-cols-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </AppShell>
    );
  }

  if (isError || !data) {
    return (
      <AppShell>
        <ErrorState message="Sistem yönetimi özeti alınamadı." />
      </AppShell>
    );
  }

  const latestBackup = data.backup.latest_manifest;
  const checklist = [
    {
      label: "Backup verify son 24 saat içinde sağlıklı",
      ok: data.backup.status === "healthy",
    },
    {
      label: "Restore drill ve production runbook dokümanları mevcut",
      ok: true,
    },
    {
      label: "Süresi dolan davetler temiz",
      ok: data.accounts.expired_invitations === 0,
    },
    {
      label: "DEBUG/security uyarısı yok",
      ok: !data.system.debug && data.system.security.warnings.length === 0,
    },
  ];

  return (
    <AppShell>
      <PageTransition>
        <div data-testid="admin-console-page">
          <PageHeader
            title="Sistem Yönetimi"
            description="Backup, kullanıcı aktivasyonu, güvenlik ve operasyon durumunu tek yerden izleyin."
            actions={
              <GlowButton
                variant="ghost"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="admin-console-refresh"
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                {isFetching ? "Yenileniyor" : "Yenile"}
              </GlowButton>
            }
          />

          <div className="mt-sm text-caption text-text-secondary">
            Son güncelleme: {formatDateTime(data.generated_at)}
          </div>

          <section className="mt-lg grid gap-sm md:grid-cols-2 xl:grid-cols-5">
            <div data-testid="admin-console-system-status">
              <MiniMetricCard
                label="Genel durum"
                value={getStatusLabel(data.system.status)}
                tone={getStatusTone(data.system.status)}
                icon={<IconShieldCheck size={16} aria-hidden={true} />}
              />
            </div>
            <MiniMetricCard
              label="Database"
              value={getStatusLabel(data.system.database.status)}
              tone={getStatusTone(data.system.database.status)}
              icon={<IconDatabase size={16} aria-hidden={true} />}
            />
            <MiniMetricCard
              label="Redis/Cache"
              value={getStatusLabel(data.system.cache.status)}
              tone={getStatusTone(data.system.cache.status)}
              icon={<IconServerCog size={16} aria-hidden={true} />}
            />
            <MiniMetricCard
              label="Environment"
              value={data.system.environment}
              tone={data.system.debug ? "warning" : "accent"}
              icon={<IconBriefcase size={16} aria-hidden={true} />}
            />
            <MiniMetricCard
              label="Security"
              value={data.system.debug ? "DEBUG açık" : "Kontrollü"}
              tone={data.system.debug ? "warning" : "success"}
              icon={<IconAlertTriangle size={16} aria-hidden={true} />}
            />
          </section>

          <div className="mt-lg grid gap-lg xl:grid-cols-[1.15fr_0.85fr]">
            <ConsolePanel
              title="Backup Health"
              description="Son scheduled backup manifesti ve retention durumunu gösterir."
              icon={<IconFileAnalytics size={18} aria-hidden={true} />}
              testId="admin-console-backup-status"
            >
              <div className="mb-md flex flex-wrap items-center gap-sm">
                <StatusPill status={data.backup.status} />
                {data.backup.warnings.map((warning) => (
                  <span
                    key={warning}
                    className="rounded-full border border-warning/25 bg-warning-bg px-sm py-xs text-caption font-semibold text-warning"
                  >
                    {warning}
                  </span>
                ))}
              </div>

              {latestBackup ? (
                <div className="grid gap-md md:grid-cols-2">
                  <div>
                    <InfoRow label="Son durum" value={<StatusPill status={latestBackup.status} />} />
                    <InfoRow label="Son çalışma" value={formatDateTime(latestBackup.finished_at)} />
                    <InfoRow label="Backup yaşı" value={latestBackup.age_hours === null ? "-" : `${latestBackup.age_hours} saat`} />
                    <InfoRow label="PostgreSQL" value={formatBytes(latestBackup.postgres_backup_size_bytes)} />
                    <InfoRow label="Media" value={formatBytes(latestBackup.media_backup_size_bytes)} />
                  </div>
                  <div>
                    <InfoRow label="Retention" value={latestBackup.retention_applied ? "Uygulandı" : "Uygulanmadı"} />
                    <InfoRow label="Silinen dosya" value={latestBackup.deleted_files_count} />
                    <InfoRow label="Uyarı / hata" value={`${latestBackup.warnings_count} / ${latestBackup.errors_count}`} />
                    <InfoRow label="Manifest sayısı" value={data.backup.manifest_count} />
                    <InfoRow label="Run ID" value={latestBackup.run_id ?? "-"} />
                  </div>
                </div>
              ) : (
                <p className="text-body text-text-secondary">
                  Henüz backup manifesti bulunamadı.
                </p>
              )}

              <div className="mt-md flex flex-wrap gap-sm text-caption text-text-secondary">
                <span>Runbook: {data.links.backup_docs}</span>
                <span>Scheduled jobs: {data.links.scheduled_jobs_docs}</span>
              </div>
            </ConsolePanel>

            <ConsolePanel
              title="Davet ve Aktivasyon"
              description="Pasif hesaplar ve davet kuyruğu için hızlı operasyon özeti."
              icon={<IconUserCheck size={18} aria-hidden={true} />}
              testId="admin-console-invitations"
            >
              <div className="grid gap-sm sm:grid-cols-2">
                <MiniMetricCard label="Bekleyen" value={data.accounts.pending_invitations} tone="accent" />
                <MiniMetricCard label="Süresi dolan" value={data.accounts.expired_invitations} tone={data.accounts.expired_invitations ? "warning" : "success"} />
                <MiniMetricCard label="Pasif kullanıcı" value={data.accounts.inactive_users} tone="warning" />
                <MiniMetricCard label="Aktivasyon bekleyen" value={data.accounts.users_without_usable_credential} tone="warning" />
              </div>
              <p className="mt-md text-body text-text-secondary">
                Pasif kullanıcıları personel detayından davet edin; kabul ve revoke akışı mevcut güvenlik kapılarıyla çalışır.
              </p>
              <div className="mt-md">
                <CommandLink to={data.links.personnel}>Personel sayfasına git</CommandLink>
              </div>
            </ConsolePanel>
          </div>

          <div className="mt-lg grid gap-lg xl:grid-cols-3">
            <ConsolePanel
              title="Personel Import"
              description="Son HR/Excel import işinin PII içermeyen özeti."
              icon={<IconUsers size={18} aria-hidden={true} />}
              testId="admin-console-import-summary"
            >
              {data.employees.latest_import ? (
                <>
                  <InfoRow label="Status" value={<StatusPill status={data.employees.latest_import.status} />} />
                  <InfoRow label="Oluşturulan" value={data.employees.latest_import.created_count} />
                  <InfoRow label="Hata / uyarı" value={`${data.employees.latest_import.error_count} / ${data.employees.latest_import.warning_count}`} />
                  <InfoRow label="Commit zamanı" value={formatDateTime(data.employees.latest_import.committed_at)} />
                </>
              ) : (
                <p className="text-body text-text-secondary">Henüz import kaydı yok.</p>
              )}
              <div className="mt-md">
                <CommandLink to={data.links.personnel}>Personel import paneline git</CommandLink>
              </div>
            </ConsolePanel>

            <ConsolePanel
              title="Operasyon ve Audit"
              description="Son 24 saatlik güvenlik ve iş yükü sinyalleri."
              icon={<IconHistory size={18} aria-hidden={true} />}
              testId="admin-console-operations"
            >
              <InfoRow label="Audit log 24s" value={data.operations.audit_logs_24h} />
              <InfoRow label="Kritik audit 24s" value={data.operations.critical_audit_logs_24h} />
              <InfoRow label="Açık ticket" value={data.operations.open_tickets} />
              <InfoRow label="Acil ticket" value={data.operations.urgent_tickets} />
              <InfoRow label="Geciken hatırlatıcı" value={data.operations.overdue_reminders} />
              <div className="mt-md flex flex-wrap gap-sm">
                <CommandLink to={data.links.audit}>Audit</CommandLink>
                <CommandLink to={data.links.tickets}>Tickets</CommandLink>
                <CommandLink to={data.links.reminders}>Reminders</CommandLink>
              </div>
            </ConsolePanel>

            <ConsolePanel
              title="Operasyon Checklist"
              description="Admin için günlük hızlı kontrol listesi."
              icon={<IconChecklist size={18} aria-hidden={true} />}
            >
              <div className="space-y-sm">
                {checklist.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-sm rounded-xl border border-border bg-surface-2 p-sm"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        item.ok ? "bg-success-bg text-success" : "bg-warning-bg text-warning"
                      )}
                    >
                      {item.ok ? (
                        <IconShieldCheck size={14} aria-hidden={true} />
                      ) : (
                        <IconClock size={14} aria-hidden={true} />
                      )}
                    </span>
                    <span className="text-body text-text-secondary">{item.label}</span>
                  </div>
                ))}
              </div>
            </ConsolePanel>
          </div>

          <section className="mt-lg rounded-panel border border-border bg-surface-1/75 p-md text-caption text-text-secondary">
            Bu ekran secret, raw token, token hash, DB bağlantısı, tam backup path'i,
            e-posta/telefon listeleri veya import row data göstermez.
          </section>
        </div>
      </PageTransition>
    </AppShell>
  );
}
