import {
  IconAlertTriangle,
  IconClipboardList,
  IconDatabase,
  IconDeviceLaptop,
  IconDownload,
  IconFileSearch,
  IconHistory,
  IconLicense,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
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
import { PageHeader } from "../components/ui/PageHeader";
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
        "flex w-full items-center justify-between gap-sm rounded-app border px-sm py-xs text-left text-caption transition",
        active
          ? activeClassName
          : "border-border bg-surface-2 text-text-secondary hover:border-accent hover:text-accent"
      )}
    >
      <span className="flex min-w-0 items-center gap-xs">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </span>

      <span className="shrink-0 rounded-full border border-border bg-surface-1 px-xs text-[10px] text-text-secondary">
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
    <aside className="flex flex-col gap-md rounded-panel border border-border bg-surface-1 p-md shadow-panel">
      <div>
        <p className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
          Genel
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
      <aside className="rounded-panel border border-border bg-surface-1 p-md text-body text-text-secondary shadow-panel">
        Değişiklik detayı yükleniyor...
      </aside>
    );
  }

  if (isError) {
    return (
      <aside className="rounded-panel border border-danger/30 bg-danger/10 p-md text-body text-danger shadow-panel">
        Değişiklik detayı alınamadı.
      </aside>
    );
  }

  if (!detail) {
    return (
      <aside className="rounded-panel border border-border bg-surface-1 p-md text-body text-text-secondary shadow-panel">
        Satıra tıklayınca before/after değişiklik detayı burada görünür.
      </aside>
    );
  }

  return (
    <aside className="rounded-panel border border-border bg-surface-1 shadow-panel">
      <header className="flex items-start justify-between gap-sm border-b border-border p-md">
        <div>
          <p className="text-caption font-semibold uppercase tracking-wide text-accent">
            Değişiklik detayı
          </p>
          <h2 className="mt-xs text-h3 text-text-primary">
            {detail.entity_repr || `${detail.entity_type}:${detail.entity_id}`}
          </h2>
          <p className="mt-xs text-caption text-text-secondary">
            {detail.entity_type_label} · #{detail.entity_id || "-"}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary transition hover:border-accent hover:text-accent"
          aria-label="Audit detayını kapat"
        >
          <IconX size={16} aria-hidden={true} />
        </button>
      </header>

      <div className="flex max-h-[calc(100vh-240px)] flex-col gap-md overflow-y-auto p-md">
        <div className="flex flex-wrap gap-xs">
          <StatusBadge variant={getActionVariant(detail.action)}>
            {getActionLabel(detail)}
          </StatusBadge>

          {detail.is_critical ? (
            <StatusBadge variant="warning">Kritik</StatusBadge>
          ) : null}
        </div>

        <div className="rounded-app border border-border bg-surface-2 p-sm">
          <p className="text-caption text-text-secondary">Kim / Ne zaman</p>
          <p className="mt-xs text-body font-semibold text-text-primary">
            {detail.actor_name}
          </p>
          <p className="text-caption text-text-secondary">
            {formatDateTime(detail.created_at)}
          </p>
        </div>

        <section>
          <p className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
            Değişen alanlar
          </p>

          <div className="mt-sm flex flex-col gap-xs">
            {changeEntries.length === 0 ? (
              <div className="rounded-app border border-border bg-surface-2 p-sm text-caption text-text-secondary">
                Bu kayıtta alan bazlı değişiklik bulunmuyor.
              </div>
            ) : (
              changeEntries.map(([fieldName, change]) => (
                <div
                  key={fieldName}
                  className="rounded-app border border-border bg-surface-2 p-sm"
                >
                  <p className="text-caption font-semibold text-text-primary">
                    {fieldName}
                  </p>

                  <div className="mt-xs grid gap-xs text-caption">
                    <div>
                      <p className="text-text-secondary">Eski değer</p>
                      <p className="break-words rounded border border-border bg-surface-1 px-xs py-1 text-text-primary">
                        {formatValue(change.before)}
                      </p>
                    </div>

                    <div>
                      <p className="text-text-secondary">Yeni değer</p>
                      <p className="break-words rounded border border-border bg-surface-1 px-xs py-1 text-text-primary">
                        {formatValue(change.after)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <p className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
            Forensic bilgi
          </p>

          <div className="mt-sm flex flex-col gap-xs text-caption">
            <div className="rounded-app border border-border bg-surface-2 p-sm">
              <p className="text-text-secondary">IP adresi</p>
              <p className="break-words text-text-primary">
                {detail.ip_address || "-"}
              </p>
            </div>

            <div className="rounded-app border border-border bg-surface-2 p-sm">
              <p className="text-text-secondary">Request path</p>
              <p className="break-words text-text-primary">
                {detail.request_path || "-"}
              </p>
            </div>

            <div className="rounded-app border border-border bg-surface-2 p-sm">
              <p className="text-text-secondary">User agent</p>
              <p className="break-words text-text-primary">
                {detail.user_agent || "-"}
              </p>
            </div>
          </div>
        </section>

        {detail.metadata && Object.keys(detail.metadata).length > 0 ? (
          <section>
            <p className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
              Metadata
            </p>

            <pre className="mt-sm max-h-48 overflow-auto rounded-app border border-border bg-surface-2 p-sm text-[11px] text-text-secondary">
              {JSON.stringify(detail.metadata, null, 2)}
            </pre>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

const columns: DataTableColumn<AuditLogListItem>[] = [
  {
    key: "created_at",
    label: "Tarih",
    sortable: true,
    sortKey: "created_at",
    render: (auditLog) => (
      <div>
        <p className="font-semibold text-text-primary">
          {formatDateTime(auditLog.created_at)}
        </p>
        <p className="mt-xs text-caption text-text-secondary">
          {auditLog.request_method || "-"}
        </p>
      </div>
    ),
  },
  {
    key: "actor",
    label: "Kullanıcı",
    sortable: true,
    sortKey: "actor__username",
    render: (auditLog) => (
      <div>
        <p className="font-semibold text-text-primary">{auditLog.actor_name}</p>
        <p className="mt-xs text-caption text-text-secondary">
          {auditLog.actor_username || "system"}
        </p>
      </div>
    ),
  },
  {
    key: "action",
    label: "Aksiyon",
    sortable: true,
    sortKey: "action",
    render: (auditLog) => (
      <div className="flex flex-col items-start gap-xs">
        <AuditActionBadge auditLog={auditLog} />
        {auditLog.is_critical ? (
          <span className="text-caption text-warning">Kritik</span>
        ) : null}
      </div>
    ),
  },
  {
    key: "entity_repr",
    label: "Kayıt",
    render: (auditLog) => (
      <div className="flex min-w-0 items-start gap-sm">
        <span className="mt-1 shrink-0 text-text-secondary">
          {getEntityIcon(auditLog.entity_type)}
        </span>

        <div className="min-w-0">
          <p className="truncate font-semibold text-text-primary">
            {auditLog.entity_repr || `${auditLog.entity_type}:${auditLog.entity_id}`}
          </p>
          <p className="mt-xs truncate text-caption text-text-secondary">
            {auditLog.entity_type_label} · #{auditLog.entity_id || "-"}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "changes_count",
    label: "Değişiklik",
    render: (auditLog) => (
      <span className="rounded-full border border-border bg-surface-2 px-sm py-1 text-caption text-text-secondary">
        {auditLog.changes_count} alan
      </span>
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

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          eyebrow="Merkezi Denetim"
          title="İşlem Geçmişi"
          description="Sistemde yapılan kritik işlemleri, kayıt türüne ve aksiyona göre incele; satır seçerek sadece değişen alanların before/after farkını gör."
          actions={
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
          }
        />

        <section className="mt-lg grid gap-sm sm:grid-cols-2 xl:grid-cols-4">
          <MiniMetricCard
            label="Toplam audit"
            value={summary?.total ?? tableData?.count ?? 0}
            icon={<IconFileSearch size={15} aria-hidden={true} />}
            tone="accent"
          />

          <MiniMetricCard
            label="Gösterilen kayıt"
            value={tableData?.count ?? 0}
            icon={<IconDatabase size={15} aria-hidden={true} />}
            tone="accent"
          />

          <MiniMetricCard
            label="Kritik işlem"
            value={summary?.critical.total ?? 0}
            icon={<IconAlertTriangle size={15} aria-hidden={true} />}
            tone="warning"
          />

          <MiniMetricCard
            label="Export"
            value={criticalExportCount}
            icon={<IconDownload size={15} aria-hidden={true} />}
            tone="warning"
          />
        </section>

        {selectedEntityId ? (
          <div className="mt-lg rounded-app border border-accent/30 bg-accent-bg px-md py-sm text-body text-accent">
            Derin link filtresi aktif: {selectedEntityType || "entity"} #
            {selectedEntityId}
          </div>
        ) : null}

        <section className="mt-lg grid gap-lg xl:grid-cols-[230px_minmax(0,1fr)] 2xl:grid-cols-[220px_minmax(0,1fr)_320px]">
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
            <section className="mb-md rounded-panel border border-border bg-surface-1 p-md shadow-panel">
              <div className="grid gap-md xl:grid-cols-[minmax(0,1fr)_180px_160px_160px_auto]">
                <label className="flex h-11 min-w-0 items-center gap-sm rounded-app border border-border bg-surface-2 px-md">
                  <IconSearch
                    size={18}
                    className="shrink-0 text-text-secondary"
                    aria-hidden={true}
                  />

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
                  className="h-11 rounded-app border border-border bg-surface-2 px-md text-body text-text-primary outline-none focus:border-accent"
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
                  onChange={(event) =>
                    updateAuditFilters({ date_from: event.target.value || null })
                  }
                  className="h-11 rounded-app border border-border bg-surface-2 px-md text-body text-text-primary outline-none focus:border-accent"
                  aria-label="Başlangıç tarihi"
                />

                <input
                  type="date"
                  value={selectedDateTo}
                  onChange={(event) =>
                    updateAuditFilters({ date_to: event.target.value || null })
                  }
                  className="h-11 rounded-app border border-border bg-surface-2 px-md text-body text-text-primary outline-none focus:border-accent"
                  aria-label="Bitiş tarihi"
                />

                <button
                  type="button"
                  onClick={resetAuditFilters}
                  className="h-11 rounded-app border border-border px-md text-body text-text-primary transition hover:border-accent hover:text-accent"
                >
                  Temizle
                </button>
              </div>
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

        <section className="mt-lg rounded-panel border border-border bg-surface-1 p-md shadow-panel">
          <div className="flex items-start gap-sm">
            <IconShieldCheck
              size={18}
              className="mt-1 shrink-0 text-accent"
              aria-hidden={true}
            />
            <div>
              <h2 className="text-h3 text-text-primary">Erişim notu</h2>
              <p className="mt-xs text-body text-text-secondary">
                Bu sayfa yalnızca Admin rolüne açıktır. Technician, Viewer,
                Approver ve Requester rolleri backend tarafında da 403 alır.
              </p>
            </div>
          </div>
        </section>
      </PageTransition>
    </AppShell>
  );
}