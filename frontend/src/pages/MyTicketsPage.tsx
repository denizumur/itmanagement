import {
  IconAlertTriangle,
  IconClipboardList,
  IconMessageCircle,
  IconRefresh,
} from "@tabler/icons-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "../components/common/DataTable";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { Skeleton } from "../components/common/Skeleton";
import { TablePagination } from "../components/common/TablePagination";
import { SimplePortalShell } from "../components/layout/SimplePortalShell";
import { TicketChatPanel } from "../components/tickets/TicketChatPanel";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  useCreateTicket,
  useTicketSummary,
  useTicketsTable,
} from "../hooks/useTickets";
import { useTableQueryState } from "../hooks/useTableQueryState";
import type {
  Ticket,
  TicketApprovalStatus,
  TicketCategory,
  TicketCreatePayload,
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

const categoryOptions: Array<{ value: TicketCategory; label: string }> = [
  { value: "hardware", label: "Donanım" },
  { value: "software", label: "Yazılım" },
  { value: "access", label: "Erişim / Yetki" },
  { value: "network", label: "Ağ / İnternet" },
  { value: "other", label: "Diğer" },
];

const priorityOptions: Array<{ value: TicketPriority; label: string }> = [
  { value: "low", label: "Düşük" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Yüksek" },
  { value: "urgent", label: "Acil" },
];

const statusFilterOptions = [
  { value: "", label: "Tüm durumlar" },
  { value: "open", label: "Açık" },
  { value: "in_progress", label: "İşlemde" },
  { value: "resolved", label: "Çözüldü" },
  { value: "closed", label: "Kapandı" },
];

const approvalFilterOptions = [
  { value: "", label: "Tüm onaylar" },
  { value: "pending", label: "Onay bekliyor" },
  { value: "approved", label: "Onaylandı" },
  { value: "rejected", label: "Reddedildi" },
  { value: "not_required", label: "Onay gerekmiyor" },
];

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildMyTicketColumns({
  selectedTicketId,
  onSelectTicket,
}: {
  selectedTicketId?: number | null;
  onSelectTicket: (ticket: Ticket) => void;
}): DataTableColumn<Ticket>[] {
  return [
    {
      key: "title",
      label: "Başlık",
      sortable: true,
      sortKey: "title",
      render: (ticket) => (
        <div>
          <p className="font-semibold text-text-primary">
            #{ticket.id} {ticket.title}
          </p>
          <p className="mt-xs max-w-md truncate text-caption text-text-secondary">
            {ticket.description}
          </p>

          {ticket.approval_status === "pending" &&
          ticket.pending_approver_name ? (
            <p className="mt-xs text-caption text-text-secondary">
              Onaycı: {ticket.pending_approver_name}
            </p>
          ) : null}
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
      render: (ticket) => (
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
      key: "category",
      label: "Kategori",
      sortable: true,
      sortKey: "category",
      render: (ticket) => (
        <span className="text-text-secondary">{ticket.category_label}</span>
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

export function MyTicketsPage() {
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
    pageSize: 10,
    ordering: "-created_at",
  });

  const ticketsQuery = useTicketsTable(state);
  const summaryQuery = useTicketSummary();
  const createTicketMutation = useCreateTicket();

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<TicketCreatePayload>({
    title: "",
    description: "",
    category: "other",
    priority: "normal",
  });

  const tableData = ticketsQuery.data;
  const tickets = tableData?.results ?? [];
  const summary = summaryQuery.data;

  const selectedStatus =
    typeof state.filters.status === "string" ? state.filters.status : "";
  const selectedApproval =
    typeof state.filters.approval_status === "string"
      ? state.filters.approval_status
      : "";

  const columns = useMemo(
    () =>
      buildMyTicketColumns({
        selectedTicketId: selectedTicket?.id,
        onSelectTicket: setSelectedTicket,
      }),
    [selectedTicket?.id]
  );

  async function refetchAll() {
    await Promise.all([ticketsQuery.refetch(), summaryQuery.refetch()]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);

    try {
      await createTicketMutation.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
      });

      setForm({
        title: "",
        description: "",
        category: "other",
        priority: "normal",
      });

      await refetchAll();
    } catch (createError) {
      setError(getErrorMessage(createError));
    }
  }

  const isInitialLoading = ticketsQuery.isLoading || summaryQuery.isLoading;

  return (
    <SimplePortalShell
      badge="Requester Portalı"
      title="Benim Ticketlarım"
      subtitle="IT taleplerini buradan oluşturabilir, onay/çözüm durumunu takip edebilir ve IT ekibiyle ticket üzerinden konuşabilirsin."
    >
      {isInitialLoading ? (
        <div>
          <div className="flex flex-wrap gap-sm">
            <Skeleton className="h-14 w-36 rounded-full" />
            <Skeleton className="h-14 w-36 rounded-full" />
            <Skeleton className="h-14 w-36 rounded-full" />
          </div>

          <div className="mt-lg">
            <Skeleton className="h-[520px]" />
          </div>
        </div>
      ) : (
        <div className="grid gap-lg 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-panel border border-border bg-surface-1 p-lg shadow-panel">
            <h2 className="text-h3 text-text-primary">Yeni Ticket Oluştur</h2>
            <p className="mt-sm text-body text-text-secondary">
              Talebin departman yöneticisi onayı gerektiriyorsa önce onay kuyruğuna
              düşer. Onaylanınca IT kuyruğuna aktarılır.
            </p>

            <form className="mt-lg space-y-md" onSubmit={handleSubmit}>
              <div>
                <label className="text-caption text-text-secondary">Başlık</label>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="mt-xs w-full rounded-app border border-border bg-surface-0 px-md py-sm text-body outline-none transition focus:border-accent"
                  placeholder="Örn. Laptop açılmıyor"
                  required
                />
              </div>

              <div className="grid gap-md sm:grid-cols-2">
                <div>
                  <label className="text-caption text-text-secondary">
                    Kategori
                  </label>
                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value as TicketCategory,
                      }))
                    }
                    className="mt-xs w-full rounded-app border border-border bg-surface-0 px-md py-sm text-body outline-none transition focus:border-accent"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-caption text-text-secondary">
                    Öncelik
                  </label>
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: event.target.value as TicketPriority,
                      }))
                    }
                    className="mt-xs w-full rounded-app border border-border bg-surface-0 px-md py-sm text-body outline-none transition focus:border-accent"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-caption text-text-secondary">
                  Açıklama
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="mt-xs min-h-[120px] w-full rounded-app border border-border bg-surface-0 px-md py-sm text-body outline-none transition focus:border-accent"
                  placeholder="Sorunu, ne zaman başladığını ve etkisini yaz."
                  required
                />
              </div>

              {error ? (
                <div className="rounded-app border border-danger/30 bg-danger-bg px-md py-sm text-body text-danger">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={createTicketMutation.isPending}
                className="w-full rounded-app bg-accent px-md py-sm text-body font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createTicketMutation.isPending
                  ? "Oluşturuluyor..."
                  : "Ticket Oluştur"}
              </button>
            </form>
          </section>

          <section className="min-w-0">
            <div className="flex flex-wrap gap-sm">
              <MiniMetricCard
                label="Gösterilen ticket"
                value={tableData?.count ?? tickets.length}
                icon={<IconClipboardList size={15} aria-hidden={true} />}
                tone="accent"
              />

              <MiniMetricCard
                label="Açık talepler"
                value={summary?.open ?? 0}
                icon={<IconClipboardList size={15} aria-hidden={true} />}
                tone="accent"
              />

              <MiniMetricCard
                label="Onay bekleyen"
                value={summary?.pending_approval ?? 0}
                icon={<IconAlertTriangle size={15} aria-hidden={true} />}
                tone="warning"
              />

              <MiniMetricCard
                label="Tamamlanan"
                value={(summary?.resolved ?? 0) + (summary?.closed ?? 0)}
                icon={<IconClipboardList size={15} aria-hidden={true} />}
                tone="success"
              />
            </div>

            <section className="mt-lg rounded-panel border border-border bg-surface-1 p-md shadow-panel">
              <div className="grid gap-md xl:grid-cols-[1fr_200px_220px_auto]">
                <input
                  className="rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary placeholder:text-text-secondary shadow-panel focus:outline-none"
                  placeholder="Başlık veya açıklama ara..."
                  value={state.search}
                  onChange={(event) => setSearch(event.target.value)}
                />

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
                  value={selectedApproval}
                  onChange={(event) =>
                    setFilter("approval_status", event.target.value || null)
                  }
                  aria-label="Onay durumu filtresi"
                >
                  {approvalFilterOptions.map((option) => (
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
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={refetchAll}
                    className="inline-flex items-center gap-xs rounded-app border border-border px-md py-sm text-body text-text-secondary transition hover:border-accent hover:text-accent"
                  >
                    <IconRefresh size={16} aria-hidden={true} />
                    Yenile
                  </button>
                </div>

                <DataTable
                  columns={columns}
                  data={tickets}
                  getRowKey={(ticket) => ticket.id}
                  ordering={state.ordering}
                  onSortChange={setSort}
                  isLoading={ticketsQuery.isLoading}
                  emptyMessage="Henüz ticket oluşturmadın."
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
                canUseInternalNotes={false}
                onClose={() => setSelectedTicket(null)}
                onCommentCreated={refetchAll}
              />
            </section>
          </section>
        </div>
      )}
    </SimplePortalShell>
  );
}