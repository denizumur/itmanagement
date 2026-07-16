import {
  IconAlertTriangle,
  IconChevronRight,
  IconClipboardList,
  IconClock,
  IconMessageCircle,
  IconRefresh,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { Skeleton } from "../components/common/Skeleton";
import { TablePagination } from "../components/common/TablePagination";
import { SimplePortalShell } from "../components/layout/SimplePortalShell";
import { RequesterTicketForm } from "../components/tickets/RequesterTicketForm";
import { TicketChatPanel } from "../components/tickets/TicketChatPanel";
import { TicketProgressStepper } from "../components/tickets/TicketProgressStepper";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  useRequesterContext,
  useTicketSummary,
  useTicketsTable,
} from "../hooks/useTickets";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { cn } from "../lib/cn";
import {
  getTicketApprovalMeta,
  getTicketPriorityMeta,
  getTicketStatusMeta,
} from "../lib/ticketLabels";
import type {
  Ticket,
  TicketApprovalStatus,
  TicketStatus,
} from "../types/tickets";

const statusFilterOptions: Array<{ value: "" | TicketStatus; label: string }> = [
  { value: "", label: "Tüm durumlar" },
  { value: "open", label: "Gönderildi" },
  { value: "in_progress", label: "IT inceliyor" },
  { value: "resolved", label: "Çözüldü" },
  { value: "closed", label: "Kapandı" },
];

const approvalFilterOptions: Array<{
  value: "" | TicketApprovalStatus;
  label: string;
}> = [
  { value: "", label: "Tüm onaylar" },
  { value: "pending", label: "Yönetici onayı bekliyor" },
  { value: "approved", label: "Onaylandı" },
  { value: "rejected", label: "Onaylanmadı" },
  { value: "not_required", label: "IT ekibine iletildi" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getNextActionText(ticket: Ticket) {
  if (ticket.approval_status === "rejected") {
    return "Bu talep yönetici tarafından onaylanmadı. Detayı açıp yazışmaları kontrol edebilirsin.";
  }

  if (ticket.approval_status === "pending") {
    return `Şu an ${ticket.pending_approver_name ?? "yöneticin"} onayı bekleniyor. Onaylanınca IT ekibine düşecek.`;
  }

  if (ticket.status === "open") {
    return "Talebin IT ekibine iletildi. İlk inceleme için sırada bekliyor.";
  }

  if (ticket.status === "in_progress") {
    return "IT ekibi talebini inceliyor. Gelişme olursa mesajlardan takip edebilirsin.";
  }

  if (ticket.status === "resolved" || ticket.status === "closed") {
    return "Bu talep tamamlandı. Gerekirse mesajlardan geçmişi inceleyebilirsin.";
  }

  return "Talebinin durumunu buradan takip edebilirsin.";
}

function TicketCard({
  ticket,
  selected,
  onSelect,
}: {
  ticket: Ticket;
  selected: boolean;
  onSelect: (ticket: Ticket) => void;
}) {
  const statusMeta = getTicketStatusMeta(ticket.status);
  const priorityMeta = getTicketPriorityMeta(ticket.priority);
  const approvalMeta = getTicketApprovalMeta(ticket.approval_status);

  return (
    <article
      className={cn(
        "rounded-panel border bg-surface-1 p-lg shadow-panel transition hover:border-accent/60 hover:bg-surface-2/40",
        selected ? "border-accent bg-accent/5" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(ticket)}
        className="w-full text-left"
      >
        <div className="flex flex-col gap-md lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-xs">
              <span className="rounded-full border border-border bg-surface-2 px-sm py-1 text-caption text-text-secondary">
                #{ticket.id}
              </span>

              <StatusBadge variant={approvalMeta.variant}>
                {approvalMeta.requesterLabel}
              </StatusBadge>

              <StatusBadge variant={statusMeta.variant}>
                {statusMeta.label}
              </StatusBadge>

              <StatusBadge variant={priorityMeta.variant}>
                {priorityMeta.requesterLabel}
              </StatusBadge>
            </div>

            <h3 className="mt-sm text-h3 text-text-primary">{ticket.title}</h3>

            <p className="mt-xs line-clamp-2 max-w-3xl text-body text-text-secondary">
              {ticket.description}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-xs whitespace-nowrap text-caption text-text-secondary">
            <IconClock size={14} aria-hidden={true} />
            {formatDate(ticket.created_at)}
          </div>
        </div>

        <TicketProgressStepper ticket={ticket} compact />

        <div className="mt-md rounded-2xl border border-border bg-surface-2 p-md">
          <p className="text-caption font-semibold text-text-secondary">
            Şu anda ne oluyor?
          </p>
          <p className="mt-xs text-body text-text-primary">
            {getNextActionText(ticket)}
          </p>
        </div>

        <div className="mt-md flex flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-xs text-caption text-text-secondary">
            <span className="rounded-full bg-surface-2 px-sm py-1">
              {ticket.category_label}
            </span>

            {ticket.asset_label ? (
              <span className="rounded-full bg-surface-2 px-sm py-1">
                Cihaz: {ticket.asset_label}
              </span>
            ) : (
              <span className="rounded-full bg-surface-2 px-sm py-1">
                Cihaz seçilmedi
              </span>
            )}

            <span className="rounded-full bg-surface-2 px-sm py-1">
              {ticket.comments_count} mesaj
            </span>

            {ticket.attachments_count > 0 ? (
              <span className="rounded-full bg-surface-2 px-sm py-1">
                {ticket.attachments_count} dosya
              </span>
            ) : null}
          </div>

          <span
            className={cn(
              "inline-flex items-center justify-center gap-xs rounded-app border px-md py-sm text-body transition",
              selected
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-text-primary"
            )}
          >
            <IconMessageCircle size={16} aria-hidden={true} />
            Mesajları aç
            <IconChevronRight size={16} aria-hidden={true} />
          </span>
        </div>
      </button>
    </article>
  );
}

function TicketChatDrawer({
  ticket,
  onClose,
  onCommentCreated,
}: {
  ticket: Ticket | null;
  onClose: () => void;
  onCommentCreated: () => void;
}) {
  if (!ticket) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-[520px] flex-col bg-surface-0 shadow-panel">
        <div className="flex items-center justify-between border-b border-border bg-surface-1 p-md">
          <div>
            <p className="text-caption text-text-secondary">Talep detayı</p>
            <h2 className="text-h3 text-text-primary">#{ticket.id} Mesajlar</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-secondary transition hover:border-accent hover:text-accent"
            aria-label="Mesaj panelini kapat"
          >
            <IconX size={18} aria-hidden={true} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-md">
          <TicketChatPanel
            ticket={ticket}
            open={Boolean(ticket)}
            canUseInternalNotes={false}
            onClose={onClose}
            onCommentCreated={onCommentCreated}
          />
        </div>
      </div>
    </div>
  );
}

export function MyTicketsPage() {
  const {
    state,
    setSearch,
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
  const requesterContextQuery = useRequesterContext();

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const tableData = ticketsQuery.data;
  const tickets = tableData?.results ?? [];
  const summary = summaryQuery.data;

  const selectedStatus =
    typeof state.filters.status === "string" ? state.filters.status : "";
  const selectedApproval =
    typeof state.filters.approval_status === "string"
      ? state.filters.approval_status
      : "";

  const visibleTickets = useMemo(() => tickets, [tickets]);

  async function refetchAll() {
    await Promise.all([
      ticketsQuery.refetch(),
      summaryQuery.refetch(),
      requesterContextQuery.refetch(),
    ]);
  }

  async function handleTicketCreated(ticket: Ticket) {
    setSelectedTicket(ticket);
    await refetchAll();
  }

  const isInitialLoading = ticketsQuery.isLoading || summaryQuery.isLoading;

  return (
    <SimplePortalShell
      badge="Çalışan Portalı"
      title="Yardım Merkezi"
      subtitle="Yeni bir sorun mu var ya da bir şeye mi ihtiyacın var? Buradan kolayca yardım isteyebilir, durumunu takip edebilir ve IT ekibiyle yazışabilirsin."
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
        <div className="grid gap-lg 2xl:grid-cols-[520px_minmax(0,1fr)]">
          <RequesterTicketForm
            requesterContext={requesterContextQuery.data}
            isContextLoading={requesterContextQuery.isLoading}
            isContextError={requesterContextQuery.isError}
            onRefreshContext={() => requesterContextQuery.refetch()}
            onCreated={handleTicketCreated}
          />

          <section className="min-w-0">
            <div className="rounded-panel border border-border bg-surface-1 p-lg shadow-panel">
              <div className="flex flex-col gap-md lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-caption font-semibold uppercase tracking-wide text-accent">
                    Taleplerim
                  </p>
                  <h2 className="mt-xs text-h2 text-text-primary">
                    Yardım isteklerini buradan takip et
                  </h2>
                  <p className="mt-sm max-w-2xl text-body text-text-secondary">
                    Her talepte şu an hangi aşamada olduğunu, kimin onayında
                    beklediğini ve IT ekibinden gelen mesajları tek yerden
                    görebilirsin.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={refetchAll}
                  className="inline-flex items-center justify-center gap-xs rounded-app border border-border px-md py-sm text-body text-text-secondary transition hover:border-accent hover:text-accent"
                >
                  <IconRefresh size={16} aria-hidden={true} />
                  Yenile
                </button>
              </div>

              <div className="mt-lg grid gap-sm sm:grid-cols-2 xl:grid-cols-4">
                <MiniMetricCard
                  label="Gösterilen talep"
                  value={tableData?.count ?? tickets.length}
                  icon={<IconClipboardList size={15} aria-hidden={true} />}
                  tone="accent"
                  className="w-full"
                />

                <MiniMetricCard
                  label="Açık talepler"
                  value={summary?.open ?? 0}
                  icon={<IconClipboardList size={15} aria-hidden={true} />}
                  tone="accent"
                  className="w-full"
                />

                <MiniMetricCard
                  label="Onay bekleyen"
                  value={summary?.pending_approval ?? 0}
                  icon={<IconAlertTriangle size={15} aria-hidden={true} />}
                  tone="warning"
                  className="w-full"
                />

                <MiniMetricCard
                  label="Tamamlanan"
                  value={(summary?.resolved ?? 0) + (summary?.closed ?? 0)}
                  icon={<IconClipboardList size={15} aria-hidden={true} />}
                  tone="success"
                  className="w-full"
                />
              </div>

              <section className="mt-lg rounded-2xl border border-border bg-surface-2 p-md">
                <div className="grid gap-md md:grid-cols-2">
                  <label className="flex h-12 min-w-0 items-center gap-xs rounded-app border border-border bg-surface-1 px-md md:col-span-2">
                    <IconSearch size={16} className="shrink-0 text-text-secondary" />
                    <input
                      className="w-full min-w-0 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                      placeholder="Konu veya açıklama ara..."
                      value={state.search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>

                  <select
                    className="h-12 w-full min-w-0 rounded-app border border-border bg-surface-1 px-md text-body text-text-primary focus:outline-none"
                    value={selectedStatus}
                    onChange={(event) =>
                      setFilter("status", event.target.value || null)
                    }
                    aria-label="Talep durum filtresi"
                  >
                    {statusFilterOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="h-12 w-full min-w-0 rounded-app border border-border bg-surface-1 px-md text-body text-text-primary focus:outline-none"
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

                  <div className="flex justify-end md:col-span-2">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="h-11 w-full rounded-app border border-border px-md text-body text-text-primary transition hover:border-accent hover:text-accent sm:w-auto"
                    >
                      Temizle
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <section className="mt-lg flex min-w-0 flex-col gap-md">
              {ticketsQuery.isFetching ? (
                <div className="rounded-panel border border-border bg-surface-1 p-md text-body text-text-secondary">
                  Talepler güncelleniyor...
                </div>
              ) : null}

              {visibleTickets.length === 0 ? (
                <div className="rounded-panel border border-border bg-surface-1 p-lg text-center shadow-panel">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-secondary">
                    <IconClipboardList size={22} aria-hidden={true} />
                  </div>
                  <h3 className="mt-md text-h3 text-text-primary">
                    Henüz yardım isteği yok
                  </h3>
                  <p className="mt-sm text-body text-text-secondary">
                    Sol taraftaki formdan ilk yardım isteğini oluşturabilirsin.
                  </p>
                </div>
              ) : (
                visibleTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    selected={selectedTicket?.id === ticket.id}
                    onSelect={setSelectedTicket}
                  />
                ))
              )}

              <TablePagination
                page={state.page}
                pageSize={state.pageSize}
                totalCount={tableData?.count ?? 0}
                hasNext={Boolean(tableData?.next)}
                hasPrevious={Boolean(tableData?.previous)}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </section>
          </section>

          <TicketChatDrawer
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onCommentCreated={refetchAll}
          />
        </div>
      )}
    </SimplePortalShell>
  );
}