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
import { CopyCommand } from "../components/common/CopyCommand";
import { ErrorState } from "../components/common/ErrorState";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { Skeleton } from "../components/common/Skeleton";
import { AppShell } from "../components/layout/AppShell";
import { GlowButton } from "../components/ui/GlowButton";
import { PageHeader } from "../components/ui/PageHeader";
import { PageTransition } from "../components/ui/PageTransition";
import { useAdminConsoleOverview } from "../hooks/useAdminConsole";
import { cn } from "../lib/cn";
import type { AdminConsoleOverview, HealthStatus } from "../types/adminConsole";

const COMMANDS = {
  dockerPs: "docker compose ps",
  backendLogs: "docker compose logs backend --tail=100",
  dbLogs: "docker compose logs db --tail=100",
  redisLogs: "docker compose logs redis --tail=100",
  runBackup:
    "powershell.exe -ExecutionPolicy Bypass -File .\\scripts\\backup\\run_scheduled_backup.ps1 -Environment production -RetentionDays 30 -RetentionMinCount 10",
  verifyBackup:
    "powershell.exe -ExecutionPolicy Bypass -File .\\scripts\\backup\\verify_latest_backup.ps1 -MaxAgeHours 24 -FailIfOlderThanMaxAge",
  cleanupDryRun:
    "powershell.exe -ExecutionPolicy Bypass -File .\\scripts\\backup\\cleanup_old_backups.ps1 -RetentionDays 14 -RetentionMinCount 5 -DryRun",
} as const;

type GuidanceSeverity = "info" | "healthy" | "warning" | "critical";
type ChecklistStatus = "pass" | "attention" | "fail" | "unknown";

interface GuidanceItem {
  id: string;
  severity: GuidanceSeverity;
  title: string;
  description: string;
}

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

function GuidanceBox({
  item,
  testId,
}: {
  item: GuidanceItem;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "rounded-xl border p-sm",
        item.severity === "healthy" && "border-success/25 bg-success-bg/60",
        item.severity === "info" && "border-accent/20 bg-accent-bg/60",
        item.severity === "warning" && "border-warning/25 bg-warning-bg/60",
        item.severity === "critical" && "border-danger/25 bg-danger-bg/60"
      )}
    >
      <p className="text-body font-semibold text-text-primary">{item.title}</p>
      <p className="mt-xs text-caption text-text-secondary">{item.description}</p>
    </div>
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

function getBackupGuidance(status: HealthStatus): GuidanceItem {
  if (status === "healthy") {
    return {
      id: "backup-healthy",
      severity: "healthy",
      title: "Son backup sağlıklı görünüyor.",
      description:
        "Scheduled backup manifesti başarılı. Verify komutunu periyodik monitoring içinde tutun.",
    };
  }

  if (status === "unknown") {
    return {
      id: "backup-unknown",
      severity: "warning",
      title: "Henüz backup manifesti bulunamadı.",
      description:
        "İlk scheduled backup'ı çalıştırın, ardından verify script'i ile sonucu kontrol edin.",
    };
  }

  if (status === "critical") {
    return {
      id: "backup-critical",
      severity: "critical",
      title: "Son backup sağlıklı değil.",
      description:
        "Önce Docker servislerini ve backup üretimini düzeltin. Restore değil, yeni sağlıklı backup üretimi öncelikli.",
    };
  }

  return {
    id: "backup-warning",
    severity: "warning",
    title: "Son backup eski veya uyarılı görünüyor.",
    description:
      "Scheduled job çalışıyor mu kontrol edin; verify, runner ve cleanup dry-run komutlarıyla durumu netleştirin.",
  };
}

function getSystemGuidance(system: AdminConsoleOverview["system"]): GuidanceItem {
  if (system.database.status === "error") {
    return {
      id: "system-db-error",
      severity: "critical",
      title: "Database bağlantısı hata veriyor.",
      description: "Docker servis durumunu ve backend/db loglarını kontrol edin.",
    };
  }

  if (system.cache.status !== "ok") {
    return {
      id: "system-cache-warning",
      severity: "warning",
      title: "Redis/cache üretim için dikkat istiyor.",
      description:
        "Local/dev ortamda yerel cache kabul edilebilir; production'da Redis servis ve REDIS_URL kontrol edilmeli.",
    };
  }

  if (system.debug || system.security.warnings.length > 0) {
    return {
      id: "system-security-warning",
      severity: "warning",
      title: "Security ayarlarında uyarı var.",
      description:
        "Production readiness dokümanındaki DEBUG, secure cookie ve Origin ayarlarını kontrol edin.",
    };
  }

  return {
    id: "system-healthy",
    severity: "healthy",
    title: "Sistem kontrolleri sakin.",
    description: "Database, cache ve temel security sinyalleri sağlıklı görünüyor.",
  };
}

function getInvitationGuidance(accounts: AdminConsoleOverview["accounts"]) {
  if (accounts.expired_invitations > 0) {
    return {
      id: "invitations-expired",
      severity: "warning" as const,
      title: "Süresi dolmuş davetler var.",
      description:
        "Admin Console otomatik cleanup yapmaz. Personel detayından yeni davet linki üretmeniz gerekebilir.",
    };
  }

  if (
    accounts.pending_invitations > 0 ||
    accounts.inactive_users > 0 ||
    accounts.users_without_usable_credential > 0
  ) {
    return {
      id: "invitations-pending",
      severity: "info" as const,
      title: "Aktivasyon bekleyen kayıtlar var.",
      description:
        "Personel detayından davet durumunu kontrol edin; create/revoke akışı yine personel ekranından yürür.",
    };
  }

  return {
    id: "invitations-clean",
    severity: "healthy" as const,
    title: "Aktivasyon bekleyen kritik kayıt görünmüyor.",
    description: "Davet kuyruğu günlük kontrol için sağlıklı görünüyor.",
  };
}

function getImportGuidance(latestImport: AdminConsoleOverview["employees"]["latest_import"]) {
  if (!latestImport) {
    return {
      id: "import-empty",
      severity: "info" as const,
      title: "Henüz import geçmişi yok.",
      description: "İlk HR/Excel import akışını Personel sayfasından başlatın.",
    };
  }

  if (latestImport.error_count > 0 || latestImport.status === "failed") {
    return {
      id: "import-errors",
      severity: "critical" as const,
      title: "Son import hata içeriyor.",
      description:
        "Import geçmişi ve error report'u Personel sayfasından kontrol edin; row data burada gösterilmez.",
    };
  }

  if (latestImport.warning_count > 0 || latestImport.status !== "committed") {
    return {
      id: "import-warnings",
      severity: "warning" as const,
      title: "Son import uyarılar veya tamamlanmamış durum içeriyor.",
      description:
        "Import geçmişini kontrol edin; gerekirse dry-run/commit akışını Personel panelinden tamamlayın.",
    };
  }

  return {
    id: "import-healthy",
    severity: "healthy" as const,
    title: "Son import başarılı.",
    description: "Son import hata içermiyor.",
  };
}

function getOperationsGuidance(operations: AdminConsoleOverview["operations"]) {
  if (operations.urgent_tickets > 0) {
    return {
      id: "operations-urgent-tickets",
      severity: "critical" as const,
      title: "Acil ticketlar var.",
      description: "Tickets kuyruğunda acil öncelikli kayıtları öne alın.",
    };
  }

  if (operations.overdue_reminders > 0) {
    return {
      id: "operations-overdue-reminders",
      severity: "warning" as const,
      title: "Geciken hatırlatıcılar var.",
      description: "Reminders sayfasında geciken kayıtları kapatın veya erteleyin.",
    };
  }

  if (operations.critical_audit_logs_24h > 0) {
    return {
      id: "operations-critical-audit",
      severity: "warning" as const,
      title: "Son 24 saatte kritik audit kayıtları var.",
      description: "Audit sayfasından delete/restore/dispose gibi kayıtları inceleyin.",
    };
  }

  if (operations.open_tickets > 0) {
    return {
      id: "operations-open-tickets",
      severity: "info" as const,
      title: "Açık ticketlar takipte.",
      description: "Acil kayıt yok; açık işler düzenli operasyon kuyruğunda izlenebilir.",
    };
  }

  return {
    id: "operations-healthy",
    severity: "healthy" as const,
    title: "Operasyon sinyalleri sakin.",
    description: "Acil ticket, geciken reminder veya kritik audit sinyali görünmüyor.",
  };
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
  const backupGuidance = getBackupGuidance(data.backup.status);
  const systemGuidance = getSystemGuidance(data.system);
  const invitationGuidance = getInvitationGuidance(data.accounts);
  const importGuidance = getImportGuidance(data.employees.latest_import);
  const operationsGuidance = getOperationsGuidance(data.operations);
  const checklist: Array<{
    label: string;
    status: ChecklistStatus;
    nextStep: string;
  }> = [
    {
      label: "Son backup 24 saat içinde sağlıklı mı?",
      status: data.backup.status === "healthy" ? "pass" : "fail",
      nextStep:
        data.backup.status === "healthy"
          ? "Verify komutunu scheduled monitoring içinde tutun."
          : "Backup guidance içindeki verify/run komutlarını uygulayın.",
    },
    {
      label: "Verify script ve scheduled job kurulu mu?",
      status: "unknown",
      nextStep: "Host scheduler kurulumunu scheduled jobs dokümanıyla doğrulayın.",
    },
    {
      label: "Süresi dolan davetler kontrol altında mı?",
      status: data.accounts.expired_invitations === 0 ? "pass" : "attention",
      nextStep:
        data.accounts.expired_invitations === 0
          ? "Davet kuyruğu günlük kontrol için sakin."
          : "Personel detayından yeni davet linki üretin.",
    },
    {
      label: "Import sonrasında hata/uyarı var mı?",
      status:
        !data.employees.latest_import ||
        data.employees.latest_import.error_count > 0 ||
        data.employees.latest_import.warning_count > 0
          ? "attention"
          : "pass",
      nextStep: "Personel import geçmişini gerektiğinde kontrol edin.",
    },
    {
      label: "Acil ticket veya geciken reminder var mı?",
      status:
        data.operations.urgent_tickets > 0 || data.operations.overdue_reminders > 0
          ? "attention"
          : "pass",
      nextStep: "Tickets ve Reminders sayfalarında açık işleri takip edin.",
    },
    {
      label: "DEBUG/security warning var mı?",
      status:
        !data.system.debug && data.system.security.warnings.length === 0
          ? "pass"
          : "attention",
      nextStep: "Production readiness dokümanındaki güvenlik ayarlarını kontrol edin.",
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

          <section
            data-testid="admin-console-system-guidance"
            className="mt-lg grid gap-md xl:grid-cols-[1fr_1fr]"
          >
            <GuidanceBox item={systemGuidance} />
            <div className="grid gap-sm md:grid-cols-2">
              <CopyCommand
                label="Docker servisleri"
                command={COMMANDS.dockerPs}
                testId="copy-docker-ps-command"
              />
              <CopyCommand
                label="Backend logları"
                command={COMMANDS.backendLogs}
                testId="copy-backend-logs-command"
              />
              <CopyCommand label="DB logları" command={COMMANDS.dbLogs} />
              <CopyCommand label="Redis logları" command={COMMANDS.redisLogs} />
            </div>
          </section>

          <div className="mt-lg grid gap-lg xl:grid-cols-[1.15fr_0.85fr]">
            <ConsolePanel
              title="Backup Health"
              description="Son scheduled backup manifesti, retention ve önerilen komutlar."
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

              <GuidanceBox
                item={backupGuidance}
                testId="admin-console-backup-guidance"
              />

              {latestBackup ? (
                <div className="mt-md grid gap-md md:grid-cols-2">
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
                <p className="mt-md text-body text-text-secondary">
                  Henüz backup manifesti bulunamadı.
                </p>
              )}

              <div className="mt-md grid gap-sm">
                <CopyCommand
                  label="Verify latest backup"
                  command={COMMANDS.verifyBackup}
                  testId="copy-backup-verify-command"
                />
                {data.backup.status !== "healthy" ? (
                  <>
                    <CopyCommand
                      label="Scheduled backup runner"
                      command={COMMANDS.runBackup}
                      testId="copy-backup-run-command"
                    />
                    <CopyCommand
                      label="Cleanup dry-run"
                      command={COMMANDS.cleanupDryRun}
                      testId="copy-backup-cleanup-command"
                    />
                  </>
                ) : null}
              </div>

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
              <div className="mt-md" data-testid="admin-console-invitation-guidance">
                <GuidanceBox item={invitationGuidance} />
              </div>
              <p className="mt-md text-body text-text-secondary">
                Admin Console davet oluşturmaz veya revoke etmez; güvenli akış Personel detayında kalır.
              </p>
              <div className="mt-md" data-testid="admin-console-go-personnel">
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
              <div className="mt-md" data-testid="admin-console-import-guidance">
                <GuidanceBox item={importGuidance} />
              </div>
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
              <div className="mt-md" data-testid="admin-console-operations-guidance">
                <GuidanceBox item={operationsGuidance} />
              </div>
              <div className="mt-md flex flex-wrap gap-sm">
                <span data-testid="admin-console-go-audit">
                  <CommandLink to={data.links.audit}>Audit</CommandLink>
                </span>
                <span data-testid="admin-console-go-tickets">
                  <CommandLink to={data.links.tickets}>Tickets</CommandLink>
                </span>
                <span data-testid="admin-console-go-reminders">
                  <CommandLink to={data.links.reminders}>Reminders</CommandLink>
                </span>
              </div>
            </ConsolePanel>

            <ConsolePanel
              title="Operasyon Checklist"
              description="Admin için günlük hızlı kontrol listesi ve sonraki adımlar."
              icon={<IconChecklist size={18} aria-hidden={true} />}
            >
              <div className="space-y-sm" data-testid="admin-console-checklist">
                {checklist.map((item) => (
                  <div
                    key={item.label}
                    data-testid="admin-console-checklist-item"
                    className="flex items-start gap-sm rounded-xl border border-border bg-surface-2 p-sm"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        item.status === "pass" && "bg-success-bg text-success",
                        item.status === "attention" && "bg-warning-bg text-warning",
                        item.status === "fail" && "bg-danger-bg text-danger",
                        item.status === "unknown" && "bg-accent-bg text-accent"
                      )}
                    >
                      {item.status === "pass" ? (
                        <IconShieldCheck size={14} aria-hidden={true} />
                      ) : (
                        <IconClock size={14} aria-hidden={true} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-body font-semibold text-text-primary">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-caption text-text-secondary">
                        Önerilen sonraki adım: {item.nextStep}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </ConsolePanel>
          </div>

          <section className="mt-lg rounded-panel border border-border bg-surface-1/75 p-md text-caption text-text-secondary">
            Bu ekran secret, raw token, token hash, DB bağlantısı, tam backup path'i,
            e-posta/telefon listeleri veya import row data göstermez. Komutlar sadece
            kopyalanır; tarayıcıdan çalıştırılmaz.
          </section>
        </div>
      </PageTransition>
    </AppShell>
  );
}
