import {
  IconAlertTriangle,
  IconClipboardList,
  IconClock,
  IconDatabase,
  IconDeviceLaptop,
  IconDownload,
  IconFilter,
  IconFileSearch,
  IconHistory,
  IconLicense,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconTicket,
  IconTool,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { TablePagination } from "../components/common/TablePagination";
import { AppShell } from "../components/layout/AppShell";
import { GlowButton } from "../components/ui/GlowButton";
import { PageTransition } from "../components/ui/PageTransition";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  useAuditLogDetail,
  useAuditLogsTable,
  useAuditLogSummary,
} from "../hooks/useAuditLogs";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { cn } from "../lib/cn";
import type {
  AuditAction,
  AuditEntitySummary,
  AuditLogDetail,
  AuditLogListItem,
} from "../types/audit";
import type { TableQueryState } from "../types/table";

type AuditFilterUpdates = Record<string, string | string[] | null>;

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRelativeDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return formatLocalDate(date);
}

function getStringFilter(
  filters: Record<string, string | string[]>,
  key: string
) {
  const value = filters[key];

  if (typeof value === "string") {
    return value;
  }

  return "";
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Evet" : "Hayır";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getActionVariant(action: AuditAction) {
  const variants: Record<string, "success" | "danger" | "warning" | "accent" | "neutral"> = {
    create: "success",
    update: "accent",
    delete: "danger",
    restore: "warning",
    export: "warning",
    dispose: "danger",
    assign: "accent",
    return: "warning",
    status_change: "accent",
    login: "neutral",
    logout: "neutral",
    other: "neutral",
  };

  return variants[action] ?? "neutral";
}

function getActionLabel(auditLog: AuditLogListItem | AuditLogDetail) {
  if (auditLog.operation) {
    const operationLabels: Record<string, string> = {
      employee_export: "Personel export",
      ticket_approval_approved: "Ticket onaylandı",
      ticket_approval_rejected: "Ticket reddedildi",
      ticket_status_changed: "Ticket durumu değişti",
      ticket_assigned_changed: "Ticket ataması değişti",
      ticket_comment_created: "Ticket yorumu",
      ticket_attachment_uploaded: "Ticket eki",
    };

    return operationLabels[auditLog.operation] ?? auditLog.action_label;
  }

  return auditLog.action_label || auditLog.action;
}

function getEntityIcon(entityType?: string | null) {
  if (!entityType) {
    return <IconDatabase size={16} aria-hidden={true} />;
  }

  if (entityType.includes("Asset")) {
    return <IconDeviceLaptop size={16} aria-hidden={true} />;
  }

  if (entityType.includes("Assignment")) {
    return <IconClipboardList size={16} aria-hidden={true} />;
  }

  if (entityType.includes("Maintenance")) {
    return <IconTool size={16} aria-hidden={true} />;
  }

  if (entityType.includes("License")) {
    return <IconLicense size={16} aria-hidden={true} />;
  }

  if (entityType.includes("Ticket")) {
    return <IconTicket size={16} aria-hidden={true} />;
  }

  if (entityType.includes("Employee")) {
    return <IconUser size={16} aria-hidden={true} />;
  }

  return <IconDatabase size={16} aria-hidden={true} />;
}

function AuditActionBadge({ auditLog }: { auditLog: AuditLogListItem }) {
  return (
    <StatusBadge variant={getActionVariant(auditLog.action)}>
      {getActionLabel(auditLog)}
    </StatusBadge>
  );
}

function DetailSection({
  title,
  icon,
  tone = "accent",
  children,
}: {
  title: string;
  icon: ReactNode;
  tone?: "accent" | "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}) {
  const toneClasses = {
    accent: "border-accent/20 bg-accent-bg text-accent",
    success: "border-success/20 bg-success-bg text-success",
    warning: "border-warning/25 bg-warning-bg text-warning",
    danger: "border-danger/25 bg-danger-bg text-danger",
    neutral: "border-border-subtle bg-surface-2 text-text-secondary",
  };

  return (
    <section className="rounded-panel border border-border-subtle bg-surface-1/80 p-md shadow-panel">
      <div className="mb-md flex items-center gap-sm">
        <span
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-2xl border shadow-sm",
            toneClasses[tone]
          )}
        >
          {icon}
        </span>
        <h3 className="text-body font-semibold text-text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  const displayValue =
    value === undefined || value === null || value === "" ? "-" : value;

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-0/85 p-md shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {label}
      </p>
      <div className="mt-xs break-words text-body font-medium text-text-primary">
        {displayValue}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-xs rounded-full border border-accent/25 bg-accent-bg px-sm py-xs text-caption font-semibold text-accent shadow-sm">
      <span>
        {label}: {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 transition hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none"
        aria-label={`${label} filtresini kaldır`}
        title={`${label} filtresini kaldır`}
      >
        <IconX size={13} aria-hidden={true} />
      </button>
    </span>
  );
}

function ActorMark({ auditLog }: { auditLog: AuditLogListItem }) {
  const actorName = auditLog.actor_name || auditLog.actor_username || "system";
  const initials = actorName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-w-[170px] items-center gap-sm">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent-bg text-xs font-bold text-accent shadow-sm">
        {initials || "SY"}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-text-primary">{actorName}</p>
        <p className="truncate text-caption text-text-secondary">
          {auditLog.actor_username || "system"} · {auditLog.ip_address || "IP yok"}
        </p>
      </div>
    </div>
  );
}

function AuditFilterButton({
  active,
  label,
  count,
  icon,
  tone = "neutral",
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: ReactNode;
  tone?: "neutral" | "danger" | "warning" | "accent";
  onClick: () => void;
}) {
  const activeClassName = {
    neutral: "border-accent bg-accent-bg text-accent",
    danger: "border-danger/40 bg-danger/10 text-danger",
    warning: "border-warning/40 bg-warning/10 text-warning",
    accent: "border-accent bg-accent-bg text-accent",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-sm rounded-2xl border px-sm py-xs text-left text-caption shadow-sm transition focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none",
        active
          ? activeClassName
          : "border-border-subtle bg-surface-0/85 text-text-secondary hover:border-accent hover:text-accent"
      )}
    >
      <span className="flex min-w-0 items-center gap-xs">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </span>

      <span className="shrink-0 rounded-full border border-border-subtle bg-surface-1 px-xs text-[10px] text-text-secondary">
        {count}
      </span>
    </button>
  );
}

function AuditSummaryPanel({
  total,
  entityTypes,
  selectedEntityType,
  selectedAction,
  selectedCritical,
  criticalDeleteCount,
  criticalExportCount,
  criticalTotal,
  onEntityTypeSelect,
  onCriticalSelect,
  onDeleteSelect,
  onExportSelect,
  onClear,
}: {
  total: number;
  entityTypes: AuditEntitySummary[];
  selectedEntityType: string;
  selectedAction: string;
  selectedCritical: string;
  criticalDeleteCount: number;
  criticalExportCount: number;
  criticalTotal: number;
  onEntityTypeSelect: (entityType: string) => void;
  onCriticalSelect: () => void;
  onDeleteSelect: () => void;
  onExportSelect: () => void;
  onClear: () => void;
}) {
  return (
    <aside className="flex flex-col gap-md rounded-panel border border-border-subtle bg-surface-1/80 p-md shadow-panel backdrop-blur-sm">
      <div>
        <p className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
          Module lens
        </p>

        <div className="mt-sm">
          <AuditFilterButton
            active={!selectedEntityType && !selectedAction && !selectedCritical}
            label="Tüm kayıtlar"
            count={total}
            icon={<IconHistory size={15} aria-hidden={true} />}
            tone="accent"
            onClick={onClear}
          />
        </div>
      </div>

      <div>
        <p className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
          Türe göre
        </p>

        <div className="mt-sm flex flex-col gap-xs">
          {entityTypes.map((item) => (
            <AuditFilterButton
              key={item.entity_type}
              active={selectedEntityType === item.entity_type}
              label={item.label}
              count={item.count}
              icon={getEntityIcon(item.entity_type)}
              onClick={() => onEntityTypeSelect(item.entity_type)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
          Kritik
        </p>

        <div className="mt-sm flex flex-col gap-xs">
          <AuditFilterButton
            active={selectedCritical === "true"}
            label="Tüm kritikler"
            count={criticalTotal}
            icon={<IconAlertTriangle size={15} aria-hidden={true} />}
            tone="warning"
            onClick={onCriticalSelect}
          />

          <AuditFilterButton
            active={selectedAction === "delete,dispose"}
            label="Silme / İmha"
            count={criticalDeleteCount}
            icon={<IconAlertTriangle size={15} aria-hidden={true} />}
            tone="danger"
            onClick={onDeleteSelect}
          />

          <AuditFilterButton
            active={selectedAction === "export"}
            label="Export"
            count={criticalExportCount}
            icon={<IconDownload size={15} aria-hidden={true} />}
            tone="warning"
            onClick={onExportSelect}
          />
        </div>
      </div>
    </aside>
  );
}

function AuditDetailPanel({
  detail,
  isLoading,
  isError,
  onClose,
}: {
  detail?: AuditLogDetail;
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
}) {
  const changes = detail?.changes ?? {};
  const changeEntries = Object.entries(changes);

  if (isLoading) {
    return (
      <aside className="rounded-panel border border-border-subtle bg-surface-1/85 p-lg text-body text-text-secondary shadow-panel backdrop-blur-sm">
        Değişiklik detayı yükleniyor...
      </aside>
    );
  }

  if (isError) {
    return (
      <aside className="rounded-panel border border-danger/30 bg-danger/10 p-lg text-body text-danger shadow-panel">
        Değişiklik detayı alınamadı.
      </aside>
    );
  }

  if (!detail) {
    return (
      <aside className="rounded-panel border border-dashed border-border-strong bg-surface-1/70 p-lg text-body text-text-secondary shadow-panel backdrop-blur-sm">
        Sticky göz ikonundan bir audit kaydı seçince evidence dossier burada görünür.
      </aside>
    );
  }

  return (
    <aside className="rounded-panel border border-border-strong/60 bg-surface-1/90 shadow-panel backdrop-blur-sm">
      <header className="flex items-start justify-between gap-sm border-b border-border-subtle p-md">
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-accent">
            Audit Evidence Dossier
          </p>
          <h2 className="mt-xs truncate text-h3 text-text-primary">
            {detail.entity_repr || `${detail.entity_type}:${detail.entity_id}`}
          </h2>
          <p className="mt-xs text-caption text-text-secondary">
            {detail.entity_type_label} · #{detail.entity_id || "-"}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border-subtle bg-surface-0/80 text-text-secondary shadow-sm transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none"
          aria-label="Audit detayını kapat"
          title="Audit detayını kapat"
        >
          <IconX size={16} aria-hidden={true} />
        </button>
      </header>

      <div className="flex max-h-[calc(100vh-220px)] flex-col gap-lg overflow-y-auto p-md">
        <section className="overflow-hidden rounded-panel border border-accent/20 bg-surface-0 shadow-panel">
          <div className={cn(
            "h-1",
            detail.is_critical ? "bg-warning" : "bg-accent"
          )} />
          <div className="p-md">
            <div className="flex flex-wrap gap-xs">
              <StatusBadge variant={getActionVariant(detail.action)}>
                {getActionLabel(detail)}
              </StatusBadge>
              {detail.is_critical ? (
                <StatusBadge variant="warning">Kritik iz</StatusBadge>
              ) : (
                <StatusBadge variant="neutral">Standart iz</StatusBadge>
              )}
            </div>
            <div className="mt-sm grid gap-sm sm:grid-cols-2">
              <DetailRow label="Aktör" value={detail.actor_name || detail.actor_username || "system"} />
              <DetailRow label="Zaman" value={formatDateTime(detail.created_at)} />
              <DetailRow label="Aksiyon" value={getActionLabel(detail)} />
              <DetailRow label="Değişen alan" value={`${detail.changes_count} alan`} />
            </div>
          </div>
        </section>

        <DetailSection title="İşlem Özeti" icon={<IconFileSearch size={17} aria-hidden={true} />} tone={detail.is_critical ? "warning" : "accent"}>
          <div className="grid gap-md sm:grid-cols-2">
            <DetailRow label="Operasyon" value={detail.operation || detail.action} />
            <DetailRow label="HTTP method" value={detail.request_method} />
            <DetailRow label="Request path" value={detail.request_path} />
            <DetailRow label="Kritik mi" value={detail.is_critical ? "Evet" : "Hayır"} />
          </div>
        </DetailSection>

        <DetailSection title="Aktör" icon={<IconUser size={17} aria-hidden={true} />} tone="success">
          <div className="grid gap-md sm:grid-cols-2">
            <DetailRow label="Kullanıcı" value={detail.actor_name} />
            <DetailRow label="Username" value={detail.actor_username || "system"} />
            <DetailRow label="IP adresi" value={detail.ip_address} />
            <DetailRow label="User agent" value={detail.user_agent} />
          </div>
        </DetailSection>

        <DetailSection title="Entity" icon={getEntityIcon(detail.entity_type)} tone="accent">
          <div className="grid gap-md sm:grid-cols-2">
            <DetailRow label="Entity türü" value={detail.entity_type_label || detail.entity_type} />
            <DetailRow label="Entity ID" value={detail.entity_id} />
            <DetailRow label="Kayıt" value={detail.entity_repr} />
            <DetailRow label="Modül" value={detail.module} />
          </div>
        </DetailSection>

        <DetailSection title="Değişiklikler" icon={<IconHistory size={17} aria-hidden={true} />} tone="warning">
          <div className="flex flex-col gap-sm">
            {changeEntries.length === 0 ? (
              <div className="rounded-2xl border border-border-subtle bg-surface-0/85 p-md text-body text-text-secondary shadow-sm">
                Bu kayıtta alan bazlı değişiklik bulunmuyor.
              </div>
            ) : (
              changeEntries.map(([fieldName, change]) => (
                <div key={fieldName} className="rounded-2xl border border-border-subtle bg-surface-0/90 p-md shadow-sm">
                  <p className="text-caption font-semibold uppercase tracking-[0.08em] text-text-muted">
                    {fieldName}
                  </p>
                  <div className="mt-sm grid gap-sm md:grid-cols-2">
                    <div className="rounded-2xl border border-danger/15 bg-danger/5 p-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-danger">
                        Önce
                      </p>
                      <p className="mt-xs break-words text-caption text-text-primary">
                        {formatValue(change.before)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-success/15 bg-success/5 p-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-success">
                        Sonra
                      </p>
                      <p className="mt-xs break-words text-caption text-text-primary">
                        {formatValue(change.after)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DetailSection>

        <DetailSection title="Önce / Sonra" icon={<IconDatabase size={17} aria-hidden={true} />} tone="neutral">
          <div className="grid gap-md md:grid-cols-2">
            <pre className="max-h-56 overflow-auto rounded-2xl border border-border-subtle bg-surface-0/90 p-sm text-[11px] text-text-secondary shadow-sm">
              {JSON.stringify(detail.before ?? {}, null, 2)}
            </pre>
            <pre className="max-h-56 overflow-auto rounded-2xl border border-border-subtle bg-surface-0/90 p-sm text-[11px] text-text-secondary shadow-sm">
              {JSON.stringify(detail.after ?? {}, null, 2)}
            </pre>
          </div>
        </DetailSection>

        {detail.metadata && Object.keys(detail.metadata).length > 0 ? (
          <DetailSection title="Metadata" icon={<IconDatabase size={17} aria-hidden={true} />} tone="neutral">
            <pre className="max-h-48 overflow-auto rounded-2xl border border-border-subtle bg-surface-0/90 p-sm text-[11px] text-text-secondary shadow-sm">
              {JSON.stringify(detail.metadata, null, 2)}
            </pre>
          </DetailSection>
        ) : null}

        <DetailSection title="Sistem bilgisi" icon={<IconClock size={17} aria-hidden={true} />} tone="success">
          <div className="grid gap-md sm:grid-cols-2">
            <DetailRow label="Audit ID" value={detail.id} />
            <DetailRow label="Oluşturulma" value={formatDateTime(detail.created_at)} />
          </div>
        </DetailSection>
      </div>
    </aside>
  );
}
const columns: DataTableColumn<AuditLogListItem>[] = [
  {
    key: "created_at",
    label: "Zaman",
    sortable: true,
    sortKey: "created_at",
    render: (auditLog) => (
      <div className="min-w-[170px]">
        <p className="font-semibold text-text-primary">
          {formatDateTime(auditLog.created_at)}
        </p>
        <div className="mt-xs flex flex-wrap gap-xs">
          <span className="rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-caption text-text-secondary shadow-sm">
            {auditLog.request_method || "method yok"}
          </span>
          {auditLog.is_critical ? (
            <span className="rounded-full border border-warning/25 bg-warning-bg px-sm py-[2px] text-caption font-semibold text-warning shadow-sm">
              Kritik
            </span>
          ) : null}
        </div>
      </div>
    ),
  },
  {
    key: "actor",
    label: "Aktör",
    sortable: true,
    sortKey: "actor__username",
    render: (auditLog) => <ActorMark auditLog={auditLog} />,
  },
  {
    key: "action",
    label: "Aksiyon",
    sortable: true,
    sortKey: "action",
    render: (auditLog) => (
      <div className="flex min-w-[150px] flex-col items-start gap-xs">
        <AuditActionBadge auditLog={auditLog} />
        <span className="rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-caption text-text-secondary shadow-sm">
          {auditLog.operation || auditLog.action}
        </span>
      </div>
    ),
  },
  {
    key: "entity_repr",
    label: "Entity",
    render: (auditLog) => (
      <div className="flex min-w-[260px] items-start gap-sm">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent-bg text-accent shadow-sm">
          {getEntityIcon(auditLog.entity_type)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-text-primary">
            {auditLog.entity_repr || `${auditLog.entity_type}:${auditLog.entity_id}`}
          </p>
          <div className="mt-xs flex flex-wrap gap-xs">
            <span className="rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-caption text-text-secondary shadow-sm">
              {auditLog.entity_type_label}
            </span>
            <span className="rounded-full border border-border-subtle bg-surface-0 px-sm py-[2px] text-caption text-text-secondary shadow-sm">
              #{auditLog.entity_id || "-"}
            </span>
            {auditLog.module ? (
              <span className="rounded-full border border-accent/20 bg-accent-bg px-sm py-[2px] text-caption font-semibold text-accent shadow-sm">
                {auditLog.module}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "changes_count",
    label: "Kanıt",
    render: (auditLog) => (
      <div className="flex min-w-[120px] flex-col items-start gap-xs">
        <span className="rounded-full border border-border-subtle bg-surface-0 px-sm py-1 text-caption font-semibold text-text-secondary shadow-sm">
          {auditLog.changes_count} alan
        </span>
        <span className="text-caption text-text-muted">
          {auditLog.has_changes ? "Before/after var" : "Alan farkı yok"}
        </span>
      </div>
    ),
  },
];
export function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAuditLogId, setSelectedAuditLogId] = useState<number | null>(null);

  const {
    state,
    setSearch,
    setSort,
    setPage,
    setPageSize,
  } = useTableQueryState({
    page: 1,
    pageSize: 25,
    ordering: "-created_at",
  });

  const rawEntityType = searchParams.get("entity_type") || "";
  const rawEntityId = searchParams.get("entity_id") || "";

  const effectiveFilters = useMemo(() => {
    const filters = { ...state.filters };

    if (!filters.entity_type && rawEntityType) {
      filters.entity_type = rawEntityType;
    }

    if (!filters.entity_id && rawEntityId) {
      filters.entity_id = rawEntityId;
    }

    return filters;
  }, [state.filters, rawEntityType, rawEntityId]);

  const effectiveState = useMemo<TableQueryState>(() => {
    return {
      ...state,
      filters: effectiveFilters,
    };
  }, [state, effectiveFilters]);

  const auditLogsQuery = useAuditLogsTable(effectiveState);
  const auditSummaryQuery = useAuditLogSummary();
  const auditDetailQuery = useAuditLogDetail(selectedAuditLogId);

  const tableData = auditLogsQuery.data;
  const auditLogs = tableData?.results ?? [];
  const summary = auditSummaryQuery.data;

  const selectedEntityType = getStringFilter(effectiveFilters, "entity_type");
  const selectedEntityId = getStringFilter(effectiveFilters, "entity_id");
  const selectedAction = getStringFilter(effectiveFilters, "action");
  const selectedCritical = getStringFilter(effectiveFilters, "critical");
  const selectedDateFrom = getStringFilter(effectiveFilters, "date_from");
  const selectedDateTo = getStringFilter(effectiveFilters, "date_to");

  const datePreset = useMemo(() => {
    if (!selectedDateFrom && !selectedDateTo) {
      return "all";
    }

    const today = getRelativeDate(0);

    if (selectedDateFrom === today && selectedDateTo === today) {
      return "today";
    }

    if (selectedDateFrom === getRelativeDate(6) && selectedDateTo === today) {
      return "last7";
    }

    if (selectedDateFrom === getRelativeDate(29) && selectedDateTo === today) {
      return "last30";
    }

    return "custom";
  }, [selectedDateFrom, selectedDateTo]);

  function updateAuditFilters(updates: AuditFilterUpdates) {
    const next = new URLSearchParams(searchParams);

    next.delete("entity_type");
    next.delete("entity_id");

    Object.entries(updates).forEach(([key, value]) => {
      const paramKey = `filter_${key}`;

      next.delete(paramKey);

      if (Array.isArray(value)) {
        value.filter(Boolean).forEach((item) => next.append(paramKey, item));
      } else if (value) {
        next.set(paramKey, value);
      }
    });

    next.set("page", "1");

    setSearchParams(next);
  }

  function resetAuditFilters() {
    const next = new URLSearchParams(searchParams);

    Array.from(next.keys()).forEach((key) => {
      if (
        key.startsWith("filter_") ||
        key === "search" ||
        key === "ordering" ||
        key === "entity_type" ||
        key === "entity_id"
      ) {
        next.delete(key);
      }
    });

    next.set("page", "1");
    setSearchParams(next);
    setSelectedAuditLogId(null);
  }

  function handleEntityTypeSelect(entityType: string) {
    updateAuditFilters({
      entity_type: entityType,
      entity_id: null,
      action: null,
      critical: null,
    });
    setSelectedAuditLogId(null);
  }

  function handleDatePresetChange(value: string) {
    if (value === "all") {
      updateAuditFilters({
        date_from: null,
        date_to: null,
      });
      return;
    }

    const today = getRelativeDate(0);

    if (value === "today") {
      updateAuditFilters({
        date_from: today,
        date_to: today,
      });
      return;
    }

    if (value === "last7") {
      updateAuditFilters({
        date_from: getRelativeDate(6),
        date_to: today,
      });
      return;
    }

    if (value === "last30") {
      updateAuditFilters({
        date_from: getRelativeDate(29),
        date_to: today,
      });
    }
  }

  function refetchAll() {
    auditLogsQuery.refetch();
    auditSummaryQuery.refetch();

    if (selectedAuditLogId) {
      auditDetailQuery.refetch();
    }
  }

  const criticalDeleteCount =
    (summary?.critical.delete ?? 0) + (summary?.critical.dispose ?? 0);

  const criticalExportCount = summary?.critical.export ?? 0;
  const affectedEntityCount = summary?.by_entity_type.length ?? 0;
  const selectedEntityTypeLabel =
    summary?.by_entity_type.find((item) => item.entity_type === selectedEntityType)
      ?.label ?? selectedEntityType;
  const selectedActionLabel =
    selectedAction === "delete,dispose"
      ? "Silme / İmha"
      : selectedAction === "export"
        ? "Export"
        : selectedAction;
  const hasActiveFilters = Boolean(
    state.search ||
      selectedEntityType ||
      selectedEntityId ||
      selectedAction ||
      selectedCritical ||
      selectedDateFrom ||
      selectedDateTo
  );

  return (
    <AppShell>
      <PageTransition>
        <section className="relative overflow-hidden rounded-panel border border-border-strong/60 bg-surface-1/85 shadow-panel backdrop-blur-sm">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_12%_18%,rgba(79,70,229,0.18),transparent_28%),radial-gradient(circle_at_88%_8%,rgba(14,165,233,0.14),transparent_24%)]" />
          <div className="relative flex flex-col gap-lg p-lg">
            <div className="flex flex-col gap-md xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-xs rounded-full border border-accent/25 bg-accent-bg px-sm py-xs text-caption font-semibold text-accent shadow-sm">
                  <IconSparkles size={14} aria-hidden={true} />
                  Audit Command Center
                </div>
                <h1 className="mt-sm text-h1 text-text-primary">
                  Audit Komuta Merkezi
                </h1>
                <p className="mt-xs max-w-2xl text-body text-text-secondary">
                  Kullanıcı işlemlerini, entity değişikliklerini ve kritik denetim izlerini tek ekrandan takip et.
                </p>
              </div>

              <GlowButton
                variant="ghost"
                onClick={refetchAll}
                disabled={auditLogsQuery.isFetching || auditSummaryQuery.isFetching}
                icon={<IconRefresh size={16} aria-hidden={true} />}
              >
                {auditLogsQuery.isFetching || auditSummaryQuery.isFetching
                  ? "Yenileniyor"
                  : "Veriyi yenile"}
              </GlowButton>
            </div>

            <div className="grid gap-sm sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetricCard
                label="Toplam log"
                value={summary?.total ?? tableData?.count ?? 0}
                icon={<IconFileSearch size={15} aria-hidden={true} />}
                tone="accent"
              />
              <MiniMetricCard
                label="Kritik işlem"
                value={summary?.critical.total ?? 0}
                icon={<IconAlertTriangle size={15} aria-hidden={true} />}
                tone="warning"
              />
              <MiniMetricCard
                label="Gösterilen kayıt"
                value={tableData?.count ?? 0}
                icon={<IconDatabase size={15} aria-hidden={true} />}
                tone="accent"
              />
              <MiniMetricCard
                label="Etkilenen entity"
                value={affectedEntityCount}
                icon={<IconShieldCheck size={15} aria-hidden={true} />}
                tone="success"
              />
            </div>
          </div>
        </section>

        {selectedEntityId ? (
          <div className="mt-lg rounded-2xl border border-accent/30 bg-accent-bg px-md py-sm text-body font-medium text-accent shadow-sm">
            Derin link filtresi aktif: {selectedEntityType || "entity"} #{selectedEntityId}
          </div>
        ) : null}

        <section className="mt-lg grid gap-lg xl:grid-cols-[230px_minmax(0,1fr)] 2xl:grid-cols-[220px_minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <AuditSummaryPanel
              total={summary?.total ?? 0}
              entityTypes={summary?.by_entity_type ?? []}
              selectedEntityType={selectedEntityType}
              selectedAction={selectedAction}
              selectedCritical={selectedCritical}
              criticalDeleteCount={criticalDeleteCount}
              criticalExportCount={criticalExportCount}
              criticalTotal={summary?.critical.total ?? 0}
              onEntityTypeSelect={handleEntityTypeSelect}
              onCriticalSelect={() => {
                updateAuditFilters({
                  critical: "true",
                  action: null,
                  entity_type: null,
                  entity_id: null,
                });
                setSelectedAuditLogId(null);
              }}
              onDeleteSelect={() => {
                updateAuditFilters({
                  action: "delete,dispose",
                  critical: null,
                  entity_type: null,
                  entity_id: null,
                });
                setSelectedAuditLogId(null);
              }}
              onExportSelect={() => {
                updateAuditFilters({
                  action: "export",
                  critical: null,
                  entity_type: null,
                  entity_id: null,
                });
                setSelectedAuditLogId(null);
              }}
              onClear={resetAuditFilters}
            />
          </div>

          <div className="min-w-0">
            <section className="mb-md rounded-panel border border-border-subtle bg-surface-1/80 p-md shadow-panel backdrop-blur-sm">
              <div className="mb-sm flex items-center gap-xs text-caption font-semibold uppercase tracking-[0.08em] text-text-muted">
                <IconFilter size={14} aria-hidden={true} />
                Audit command bar
              </div>

              <div className="grid gap-sm xl:grid-cols-[minmax(260px,1fr)_180px_160px_160px_auto]">
                <label className="flex h-11 min-w-0 items-center gap-sm rounded-2xl border border-border-subtle bg-surface-0/90 px-md shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 motion-reduce:transition-none">
                  <IconSearch size={18} className="shrink-0 text-text-secondary" aria-hidden={true} />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                    placeholder="Kayıt, kullanıcı, path veya entity ara..."
                    value={state.search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>

                <select
                  value={datePreset}
                  onChange={(event) => handleDatePresetChange(event.target.value)}
                  className="h-11 rounded-2xl border border-border-subtle bg-surface-0/90 px-md text-body text-text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
                  aria-label="Tarih aralığı"
                >
                  <option value="all">Tüm zamanlar</option>
                  <option value="today">Bugün</option>
                  <option value="last7">Son 7 gün</option>
                  <option value="last30">Son 30 gün</option>
                  <option value="custom">Özel aralık</option>
                </select>

                <input
                  type="date"
                  value={selectedDateFrom}
                  onChange={(event) => updateAuditFilters({ date_from: event.target.value || null })}
                  className="h-11 rounded-2xl border border-border-subtle bg-surface-0/90 px-md text-body text-text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
                  aria-label="Başlangıç tarihi"
                />

                <input
                  type="date"
                  value={selectedDateTo}
                  onChange={(event) => updateAuditFilters({ date_to: event.target.value || null })}
                  className="h-11 rounded-2xl border border-border-subtle bg-surface-0/90 px-md text-body text-text-primary shadow-sm transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 motion-reduce:transition-none"
                  aria-label="Bitiş tarihi"
                />

                <button
                  type="button"
                  onClick={resetAuditFilters}
                  className="h-11 rounded-2xl border border-border-subtle bg-surface-0/80 px-md text-body font-semibold text-text-secondary shadow-sm transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none"
                >
                  Temizle
                </button>
              </div>

              {hasActiveFilters ? (
                <div className="mt-md flex flex-wrap gap-xs">
                  {state.search ? (
                    <FilterChip label="Arama" value={state.search} onRemove={() => setSearch("")} />
                  ) : null}
                  {selectedEntityType ? (
                    <FilterChip label="Entity" value={selectedEntityTypeLabel} onRemove={() => updateAuditFilters({ entity_type: null, entity_id: null })} />
                  ) : null}
                  {selectedEntityId ? (
                    <FilterChip label="Entity ID" value={selectedEntityId} onRemove={() => updateAuditFilters({ entity_id: null })} />
                  ) : null}
                  {selectedAction ? (
                    <FilterChip label="Aksiyon" value={selectedActionLabel} onRemove={() => updateAuditFilters({ action: null })} />
                  ) : null}
                  {selectedCritical ? (
                    <FilterChip label="Kritik" value="Evet" onRemove={() => updateAuditFilters({ critical: null })} />
                  ) : null}
                  {selectedDateFrom || selectedDateTo ? (
                    <FilterChip label="Tarih" value={`${selectedDateFrom || "..."} / ${selectedDateTo || "..."}`} onRemove={() => updateAuditFilters({ date_from: null, date_to: null })} />
                  ) : null}
                </div>
              ) : null}
            </section>

            {auditLogsQuery.isError ? (
              <div className="mb-md rounded-panel border border-danger/30 bg-danger/10 p-md text-body text-danger">
                Audit log tablosu yüklenemedi.
              </div>
            ) : null}

            <DataTable
              columns={columns}
              data={auditLogs}
              getRowKey={(auditLog) => auditLog.id}
              ordering={state.ordering}
              onSortChange={setSort}
              isLoading={auditLogsQuery.isLoading}
              emptyMessage="Audit kaydı bulunamadı."
              onViewDetails={(auditLog) => setSelectedAuditLogId(auditLog.id)}
              viewDetailsLabel="Audit detayını gör"
              getRowClassName={(auditLog) =>
                selectedAuditLogId === auditLog.id ? "bg-surface-2" : ""
              }
            />

            <div className="mt-md">
              <TablePagination
                page={state.page}
                pageSize={state.pageSize}
                totalCount={tableData?.count ?? 0}
                hasNext={Boolean(tableData?.next)}
                hasPrevious={Boolean(tableData?.previous)}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>

          <div className="min-w-0 2xl:sticky 2xl:top-lg 2xl:self-start">
            <AuditDetailPanel
              detail={auditDetailQuery.data}
              isLoading={auditDetailQuery.isLoading}
              isError={auditDetailQuery.isError}
              onClose={() => setSelectedAuditLogId(null)}
            />
          </div>
        </section>

        <section className="mt-lg rounded-panel border border-border-subtle bg-surface-1/80 p-md shadow-panel backdrop-blur-sm">
          <div className="flex items-start gap-sm">
            <IconShieldCheck size={18} className="mt-1 shrink-0 text-accent" aria-hidden={true} />
            <div>
              <h2 className="text-h3 text-text-primary">Erişim notu</h2>
              <p className="mt-xs text-body text-text-secondary">
                Bu sayfa yalnızca Admin rolüne açıktır. Teknisyen, İzleyici, Onaycı ve Talep sahibi rolleri backend tarafında da 403 alır.
              </p>
            </div>
          </div>
        </section>
      </PageTransition>
    </AppShell>
  );
}
