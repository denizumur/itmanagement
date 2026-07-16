import {
  IconAlertTriangle,
  IconClipboardList,
  IconMessageCircle,
  IconRefresh,
  IconSearch,
  IconTool,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { Skeleton } from "../components/common/Skeleton";
import { TablePagination } from "../components/common/TablePagination";
import { AppShell } from "../components/layout/AppShell";
import { TicketChatPanel } from "../components/tickets/TicketChatPanel";
import { GlowButton } from "../components/ui/GlowButton";
import { PageHeader } from "../components/ui/PageHeader";
import { PageTransition } from "../components/ui/PageTransition";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  useTicketSummary,
  useTicketsTable,
  useUpdateTicketStatus,
} from "../hooks/useTickets";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { canManage } from "../lib/rbac";
import type {
  Ticket,
  TicketApprovalStatus,
  TicketPriority,
  TicketStatus,
} from "../types/tickets";

const statusMeta: Record<
  TicketStatus,
  {
    label: string;
    variant: "accent" | "success" | "warning" | "danger" | "neutral";
  }
> = {
  open: { label: "Açık", variant: "accent" },
  in_progress: { label: "İşlemde", variant: "warning" },
  resolved: { label: "Çözüldü", variant: "success" },
  closed: { label: "Kapandı", variant: "neutral" },
};

const priorityMeta: Record<
  TicketPriority,
  {
    label: string;
    variant: "accent" | "success" | "warning" | "danger" | "neutral";
  }
> = {
  low: { label: "Düşük", variant: "neutral" },
  normal: { label: "Normal", variant: "accent" },
  high: { label: "Yüksek", variant: "warning" },
  urgent: { label: "Acil", variant: "danger" },
};

const approvalMeta: Record<
  TicketApprovalStatus,
  {
    label: string;
    variant: "accent" | "success" | "warning" | "danger" | "neutral";
  }
> = {
  not_required: { label: "Onay gerekmiyor", variant: "neutral" },
  pending: { label: "Onay bekliyor", variant: "warning" },
  approved: { label: "Onaylandı", variant: "success" },
  rejected: { label: "Reddedildi", variant: "danger" },
};

const statusOptions: Array<{ value: TicketStatus; label: string }> = [
  { value: "open", label: "Açık" },
  { value: "in_progress", label: "İşlemde" },
  { value: "resolved", label: "Çözüldü" },
  { value: "closed", label: "Kapandı" },
];

const statusFilterOptions = [
  { value: "", label: "Tüm durumlar" },
  { value: "open", label: "Açık" },
  { value: "in_progress", label: "İşlemde" },
  { value: "resolved", label: "Çözüldü" },
];

const priorityFilterOptions = [
  { value: "", label: "Tüm öncelikler" },
  { value: "urgent", label: "Acil" },
  { value: "high", label: "Yüksek" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Düşük" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return "İşlem sırasında bir hata oluştu.";
  }

  const response = (
    error as {
      response?: {
        data?: unknown;
      };
    }
  ).response;

  const data = response?.data;

  if (!data) {
    return "İşlem sırasında bir hata oluştu.";
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object" && "detail" in data) {
    const detail = (data as { detail?: unknown }).detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  if (typeof data === "object") {
    const firstEntry = Object.entries(data as Record<string, unknown>)[0];

    if (firstEntry) {
      const [, value] = firstEntry;

      if (Array.isArray(value)) {
        return value.join(", ");
      }

      if (typeof value === "string") {
        return value;
      }
    }
  }

  return "İşlem sırasında bir hata oluştu.";
}

function buildTicketColumns({
  canEditTickets,
  isUpdatingStatus,
  selectedTicketId,
  onStatusChange,
  onSelectTicket,
}: {
  canEditTickets: boolean;
  isUpdatingStatus: boolean;
  selectedTicketId?: number | null;
  onStatusChange: (ticket: Ticket, status: TicketStatus) => void;
  onSelectTicket: (ticket: Ticket) => void;
}): DataTableColumn<Ticket>[] {
  return [
    {
      key: "title",
      label: "Ticket",
      sortable: true,
      sortKey: "title",
      render: (ticket) => (
        <div>
          <p className="font-semibold text-text-primary">
            #{ticket.id} {ticket.title}
          </p>
          <p className="mt-xs max-w-sm truncate text-caption text-text-secondary">
            {ticket.description}
          </p>
        </div>
      ),
    },
    {
      key: "employee",
      label: "Requester",
      sortable: true,
      sortKey: "employee__full_name",
      render: (ticket) => (
        <div className="text-text-secondary">
          <p>{ticket.employee_name}</p>
          <p className="text-caption">{ticket.employee_email}</p>
        </div>
      ),
    },
    {
      key: "approval_status",
      label: "Onay",
      sortable: true,
      sortKey: "approval_status",
      render: (ticket) => (
        <StatusBadge variant={approvalMeta[ticket.approval_status].variant}>
          {approvalMeta[ticket.approval_status].label}
        </StatusBadge>
      ),
    },
    {
      key: "status",
      label: "Durum",
      sortable: true,
      sortKey: "status",
      render: (ticket) =>
        canEditTickets ? (
          <select
            value={ticket.status}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) =>
              onStatusChange(ticket, event.target.value as TicketStatus)
            }
            disabled={isUpdatingStatus}
            className="rounded-app border border-border bg-surface-0 px-sm py-xs text-caption outline-none transition focus:border-accent disabled:opacity-60"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge variant={statusMeta[ticket.status].variant}>
            {statusMeta[ticket.status].label}
          </StatusBadge>
        ),
    },
    {
      key: "priority",
      label: "Öncelik",
      sortable: true,
      sortKey: "priority",
      render: (ticket) => (
        <StatusBadge variant={priorityMeta[ticket.priority].variant}>
          {priorityMeta[ticket.priority].label}
        </StatusBadge>
      ),
    },
    {
      key: "created_at",
      label: "Tarih",
      sortable: true,
      sortKey: "created_at",
      render: (ticket) => (
        <span className="text-text-secondary">{formatDate(ticket.created_at)}</span>
      ),
    },
    {
      key: "actions",
      label: "Chat",
      className: "text-right",
      render: (ticket) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelectTicket(ticket);
          }}
          className={`inline-flex items-center gap-xs rounded-app border px-sm py-xs text-caption transition ${
            selectedTicketId === ticket.id
              ? "border-accent text-accent"
              : "border-border text-text-secondary hover:border-accent hover:text-accent"
          }`}
        >
          <IconMessageCircle size={14} aria-hidden={true} />
          Detay
        </button>
      ),
    },
  ];
}

export function TicketsQueuePage() {
  const { user } = useAuth();
  const canEditTickets = canManage(user?.role);

  const {
    state,
    setSearch,
    setSort,
    setPage,
    setPageSize,
    setFilter,
    resetFilters,
  } = useTableQueryState({
    page: 1,
    pageSize: 25,
    ordering: "-created_at",
  });

  const ticketsQuery = useTicketsTable(state);
  const summaryQuery = useTicketSummary();
  const updateStatusMutation = useUpdateTicketStatus();

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tableData = ticketsQuery.data;
  const tickets = tableData?.results ?? [];
  const summary = summaryQuery.data;

  const selectedStatus =
    typeof state.filters.status === "string" ? state.filters.status : "";
  const selectedPriority =
    typeof state.filters.priority === "string" ? state.filters.priority : "";

  const columns = useMemo(
    () =>
      buildTicketColumns({
        canEditTickets,
        isUpdatingStatus: updateStatusMutation.isPending,
        selectedTicketId: selectedTicket?.id,
        onStatusChange: handleStatusChange,
        onSelectTicket: setSelectedTicket,
      }),
    [canEditTickets, updateStatusMutation.isPending, selectedTicket?.id]
  );

  async function refetchAll() {
    await Promise.all([ticketsQuery.refetch(), summaryQuery.refetch()]);
  }

  async function handleStatusChange(ticket: Ticket, status: TicketStatus) {
    setError(null);

    try {
      const updated = await updateStatusMutation.mutateAsync({
        ticketId: ticket.id,
        status,
      });

      if (selectedTicket?.id === updated.id) {
        setSelectedTicket(updated);
      }

      await refetchAll();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    }
  }

  const isInitialLoading = ticketsQuery.isLoading || summaryQuery.isLoading;
  const hasError = ticketsQuery.isError || summaryQuery.isError;

  if (isInitialLoading) {
    return (
      <AppShell>
        <div className="flex flex-wrap gap-sm">
          <Skeleton className="h-14 w-36 rounded-full" />
          <Skeleton className="h-14 w-36 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
          <Skeleton className="h-14 w-32 rounded-full" />
        </div>

        <div className="mt-lg">
          <Skeleton className="h-[520px]" />
        </div>
      </AppShell>
    );
  }

  if (hasError) {
    return (
      <AppShell>
        <div className="rounded-panel border border-danger/30 bg-danger-bg p-lg text-danger">
          Ticket verisi alınamadı. Ticket endpointlerini ve yetki durumunu kontrol et.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <PageHeader
          eyebrow="IT Operasyon Kuyruğu"
          title="Ticket Kuyruğu"
          description="Onaylanmış veya onay gerektirmeyen ticketları yönet; requester ile aynı chat paneli üzerinden konuş."
          actions={
            <GlowButton
              variant="ghost"
              onClick={refetchAll}
              disabled={
                ticketsQuery.isFetching ||
                summaryQuery.isFetching ||
                updateStatusMutation.isPending
              }
              icon={<IconRefresh size={16} aria-hidden={true} />}
            >
              {ticketsQuery.isFetching || summaryQuery.isFetching
                ? "Yenileniyor"
                : "Veriyi yenile"}
            </GlowButton>
          }
        />

        <section className="mt-lg flex flex-wrap gap-sm">
          <MiniMetricCard
            label="Gösterilen ticket"
            value={tableData?.count ?? tickets.length}
            icon={<IconClipboardList size={15} aria-hidden={true} />}
            tone="accent"
          />

          <MiniMetricCard
            label="Açık"
            value={summary?.open ?? 0}
            icon={<IconClipboardList size={15} aria-hidden={true} />}
            tone="accent"
          />

          <MiniMetricCard
            label="İşlemde"
            value={summary?.in_progress ?? 0}
            icon={<IconTool size={15} aria-hidden={true} />}
            tone="warning"
          />

          <MiniMetricCard
            label="Acil"
            value={summary?.urgent ?? 0}
            icon={<IconAlertTriangle size={15} aria-hidden={true} />}
            tone="danger"
          />

          <MiniMetricCard
            label="Yüksek/Acil"
            value={summary?.high_or_urgent ?? 0}
            icon={<IconAlertTriangle size={15} aria-hidden={true} />}
            tone="warning"
          />
        </section>

        {error ? (
          <div className="mt-lg rounded-app border border-danger/30 bg-danger-bg px-md py-sm text-body text-danger">
            {error}
          </div>
        ) : null}

        <section className="mt-lg rounded-panel border border-border bg-surface-1 p-md shadow-panel">
          <div className="grid gap-md xl:grid-cols-[1fr_200px_200px_auto]">
            <label className="flex items-center gap-sm rounded-app border border-border bg-surface-2 px-md py-sm shadow-panel">
              <IconSearch
                size={18}
                className="text-text-secondary"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                placeholder="Başlık, açıklama, requester, varlık veya atanan kişi ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
              value={selectedStatus}
              onChange={(event) => setFilter("status", event.target.value || null)}
              aria-label="Ticket durum filtresi"
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary shadow-panel focus:outline-none"
              value={selectedPriority}
              onChange={(event) => setFilter("priority", event.target.value || null)}
              aria-label="Ticket öncelik filtresi"
            >
              {priorityFilterOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
            >
              Temizle
            </button>
          </div>
        </section>

        <section className="mt-lg grid gap-lg xl:grid-cols-[minmax(0,1fr)_480px]">
          <div className="flex min-w-0 flex-col gap-md">
            <DataTable
              columns={columns}
              data={tickets}
              getRowKey={(ticket) => ticket.id}
              ordering={state.ordering}
              onSortChange={setSort}
              isLoading={ticketsQuery.isLoading}
              emptyMessage="Kuyrukta aktif ticket yok."
              onRowClick={setSelectedTicket}
              getRowClassName={(ticket) =>
                selectedTicket?.id === ticket.id ? "bg-accent/10" : ""
              }
            />

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

          <TicketChatPanel
            ticket={selectedTicket}
            open={Boolean(selectedTicket)}
            canUseInternalNotes={canEditTickets}
            onClose={() => setSelectedTicket(null)}
            onCommentCreated={refetchAll}
          />
        </section>
      </PageTransition>
    </AppShell>
  );
}