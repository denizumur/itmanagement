import {
  IconArrowLeft,
  IconChevronRight,
  IconClipboardList,
  IconClock,
  IconFilter,
  IconHistory,
  IconMessageCircle,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Skeleton } from "../components/common/Skeleton";
import { SimplePortalShell } from "../components/layout/SimplePortalShell";
import { PortalActionGrid } from "../components/portal/PortalActionGrid";
import { RequesterTicketForm } from "../components/tickets/RequesterTicketForm";
import { TicketChatPanel } from "../components/tickets/TicketChatPanel";
import { TicketTimelineIndicator } from "../components/tickets/TicketTimelineIndicator";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useMyTickets, useRequesterContext } from "../hooks/useTickets";
import { cn } from "../lib/cn";
import {
  getTicketApprovalMeta,
  getTicketPriorityMeta,
  getTicketStatusMeta,
} from "../lib/ticketLabels";
import type { Ticket } from "../types/tickets";

type MyTicketsView = "home" | "create" | "list" | "history";
type MyTicketsSource = "approvals" | null;
type TicketListFilter =
  | "all"
  | "returned_to_requester"
  | "open"
  | "in_progress"
  | "pending_approval";

const ticketListFilterOptions: Array<{
  value: TicketListFilter;
  label: string;
}> = [
  { value: "all", label: "Tüm aktif talepler" },
  { value: "returned_to_requester", label: "Geri gönderilenler" },
  { value: "open", label: "Açık" },
  { value: "in_progress", label: "İşlemde" },
  { value: "pending_approval", label: "Onay bekleyenler" },
];

function getCurrentView(value: string | null): MyTicketsView {
  if (value === "create" || value === "list" || value === "history") {
    return value;
  }

  return "home";
}

function getViewFromUrl(): MyTicketsView {
  return getCurrentView(new URLSearchParams(window.location.search).get("view"));
}

function getSourceFromUrl(): MyTicketsSource {
  const source = new URLSearchParams(window.location.search).get("from");

  if (source === "approvals") {
    return "approvals";
  }

  return null;
}

function updateViewInUrl(view: MyTicketsView, source: MyTicketsSource) {
  const url = new URL(window.location.href);

  if (view === "home") {
    url.searchParams.delete("view");
  } else {
    url.searchParams.set("view", view);
  }

  if (source === "approvals") {
    url.searchParams.set("from", "approvals");
  } else {
    url.searchParams.delete("from");
  }

  window.history.pushState({}, "", url);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("tr-TR").trim();
}

function isHistoryTicket(ticket: Ticket) {
  return (
    ticket.status === "resolved" ||
    ticket.status === "closed" ||
    ticket.approval_status === "rejected"
  );
}

function isActiveTicket(ticket: Ticket) {
  return !isHistoryTicket(ticket);
}

function isReturnedToRequester(ticket: Ticket) {
  return ticket.status === "returned_to_requester";
}

function matchesSearch(ticket: Ticket, searchTerm: string) {
  const normalizedSearch = normalizeText(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  const haystack = [
    `#${ticket.id}`,
    String(ticket.id),
    ticket.title,
    ticket.description,
    ticket.category_label,
    ticket.asset_label ?? "",
    ticket.status_label,
    ticket.approval_status_label,
    ticket.priority_label,
  ]
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  return haystack.includes(normalizedSearch);
}

function matchesTicketListFilter(ticket: Ticket, filter: TicketListFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "returned_to_requester") {
    return ticket.status === "returned_to_requester";
  }

  if (filter === "pending_approval") {
    return ticket.approval_status === "pending";
  }

  return ticket.status === filter;
}

function getSortableTime(value: string) {
  const time = new Date(value).getTime();

  if (Number.isNaN(time)) {
    return 0;
  }

  return time;
}

function sortActiveTicketsForRequester(first: Ticket, second: Ticket) {
  const firstReturned = isReturnedToRequester(first);
  const secondReturned = isReturnedToRequester(second);

  if (firstReturned !== secondReturned) {
    return firstReturned ? -1 : 1;
  }

  return getSortableTime(second.updated_at) - getSortableTime(first.updated_at);
}

function sortTicketsByUpdatedDate(first: Ticket, second: Ticket) {
  return getSortableTime(second.updated_at) - getSortableTime(first.updated_at);
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-xs rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
    >
      <IconArrowLeft size={16} aria-hidden={true} />
      Geri
    </button>
  );
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
  const returnedToRequester = isReturnedToRequester(ticket);

  return (
    <article
      className={cn(
        "rounded-panel border bg-surface-1 p-lg shadow-panel transition hover:border-accent/60",
        selected && returnedToRequester
          ? "border-danger bg-danger-bg"
          : selected
            ? "border-accent bg-accent/5"
            : returnedToRequester
              ? "border-danger/50 bg-danger-bg hover:border-danger"
              : "border-border"
      )}
    >
      <div className="flex flex-col gap-md lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-xs">
            <span
              className={cn(
                "rounded-full border px-sm py-1 text-caption",
                returnedToRequester
                  ? "border-danger/30 bg-surface-1 text-danger"
                  : "border-border bg-surface-2 text-text-secondary"
              )}
            >
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
        </div>

        <div className="flex shrink-0 items-center gap-xs whitespace-nowrap text-caption text-text-secondary">
          <IconClock size={14} aria-hidden={true} />
          {formatDate(ticket.created_at)}
        </div>
      </div>

      {returnedToRequester ? (
        <div className="mt-md rounded-app border border-danger/30 bg-surface-1 px-md py-sm text-caption text-danger">
          Geri gönderildi. Mesajları kontrol edip eksik bilgileri tamamladıktan
          sonra tekrar gönderebilirsin.
        </div>
      ) : null}

      <div className="mt-md flex flex-wrap gap-xs text-caption text-text-secondary">
        <span className="rounded-full bg-surface-2 px-sm py-1">
          {ticket.category_label}
        </span>

        {ticket.asset_label ? (
          <span className="rounded-full bg-surface-2 px-sm py-1">
            Cihaz: {ticket.asset_label}
          </span>
        ) : null}

        <span className="rounded-full bg-surface-2 px-sm py-1">
          {ticket.comments_count} mesaj
        </span>

        {ticket.attachments_count > 0 ? (
          <span className="rounded-full bg-surface-2 px-sm py-1">
            {ticket.attachments_count} dosya
          </span>
        ) : null}
      </div>

      <div className="mt-md flex flex-col gap-sm border-t border-border pt-md sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={() => onSelect(ticket)}
          className={cn(
            "inline-flex items-center justify-center gap-xs rounded-app border px-md py-sm text-body transition",
            selected
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-text-primary hover:border-accent hover:text-accent"
          )}
        >
          <IconMessageCircle size={16} aria-hidden={true} />
          Mesajlar
          <IconChevronRight size={16} aria-hidden={true} />
        </button>

        <TicketTimelineIndicator
          ticketId={ticket.id}
          ticketTitle={ticket.title}
          className="w-full sm:w-auto"
        />
      </div>
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
            <p className="text-caption text-text-secondary">Talep</p>
            <h2 className="text-h3 text-text-primary">#{ticket.id}</h2>
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
            allowInternalNotes={false}
            defaultMode="public_reply"
            onClose={onClose}
            onCommentCreated={onCommentCreated}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyTicketState({
  title,
  onCreate,
}: {
  title: string;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-panel border border-dashed border-border bg-surface-1 p-xl text-center shadow-panel">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-text-secondary">
        <IconClipboardList size={24} aria-hidden={true} />
      </div>

      <h3 className="mt-md text-h3 text-text-primary">{title}</h3>

      <button
        type="button"
        onClick={onCreate}
        className="mt-md inline-flex items-center justify-center gap-xs rounded-app bg-accent px-md py-sm text-body font-semibold text-white transition hover:opacity-90"
      >
        <IconPlus size={16} aria-hidden={true} />
        Talep Oluştur
      </button>
    </div>
  );
}

function TicketListSection({
  title,
  tickets,
  searchTerm,
  onSearchChange,
  filterValue,
  onFilterChange,
  isFetching,
  selectedTicket,
  onSelectTicket,
  onRefresh,
  onBack,
  onCreate,
}: {
  title: string;
  tickets: Ticket[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterValue?: TicketListFilter;
  onFilterChange?: (value: TicketListFilter) => void;
  isFetching: boolean;
  selectedTicket: Ticket | null;
  onSelectTicket: (ticket: Ticket) => void;
  onRefresh: () => void;
  onBack: () => void;
  onCreate: () => void;
}) {
  const hasFilter = filterValue !== undefined && Boolean(onFilterChange);

  return (
    <section>
      <div className="mb-lg flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-sm">
          <BackButton onClick={onBack} />

          <h2 className="text-h2 text-text-primary">{title}</h2>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-xs rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
        >
          <IconRefresh
            size={16}
            aria-hidden={true}
            className={isFetching ? "animate-spin" : undefined}
          />
          Yenile
        </button>
      </div>

      <div
        className={cn(
          "mb-md grid gap-sm",
          hasFilter ? "lg:grid-cols-[minmax(0,1fr)_240px]" : "lg:grid-cols-1"
        )}
      >
        <label className="flex h-12 min-w-0 items-center gap-xs rounded-app border border-border bg-surface-1 px-md">
          <IconSearch size={16} className="shrink-0 text-text-secondary" />
          <input
            className="w-full min-w-0 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
            placeholder="Başlık, açıklama, durum, öncelik veya cihaz ara..."
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        {hasFilter ? (
          <label className="flex h-12 min-w-0 items-center gap-xs rounded-app border border-border bg-surface-1 px-md">
            <IconFilter size={16} className="shrink-0 text-text-secondary" />

            <select
              className="w-full min-w-0 bg-transparent text-body text-text-primary focus:outline-none"
              value={filterValue}
              onChange={(event) =>
                onFilterChange?.(event.target.value as TicketListFilter)
              }
              aria-label="Talep filtresi"
            >
              {ticketListFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {isFetching ? (
        <div className="mb-md rounded-panel border border-border bg-surface-1 p-md text-body text-text-secondary">
          Güncelleniyor...
        </div>
      ) : null}

      {tickets.length === 0 ? (
        <EmptyTicketState title="Kayıt yok" onCreate={onCreate} />
      ) : (
        <div className="grid gap-md">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              selected={selectedTicket?.id === ticket.id}
              onSelect={onSelectTicket}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function MyTicketsPage() {
  const [currentView, setCurrentView] = useState<MyTicketsView>(() =>
    getViewFromUrl()
  );
  const [source, setSource] = useState<MyTicketsSource>(() =>
    getSourceFromUrl()
  );

  const { user } = useAuth();
  const isApproverPortalUser = user?.role === "approver";

  const myTicketsQuery = useMyTickets();
  const requesterContextQuery = useRequesterContext();

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ticketFilter, setTicketFilter] = useState<TicketListFilter>("all");

  const allTickets = useMemo(
    () => myTicketsQuery.data ?? [],
    [myTicketsQuery.data]
  );

  const activeTicketCount = useMemo(
    () => allTickets.filter(isActiveTicket).length,
    [allTickets]
  );

  const historyTicketCount = useMemo(
    () => allTickets.filter(isHistoryTicket).length,
    [allTickets]
  );

  const activeTickets = useMemo(
    () =>
      allTickets
        .filter(isActiveTicket)
        .filter((ticket) => matchesTicketListFilter(ticket, ticketFilter))
        .filter((ticket) => matchesSearch(ticket, searchTerm))
        .sort(sortActiveTicketsForRequester),
    [allTickets, searchTerm, ticketFilter]
  );

  const historyTickets = useMemo(
    () =>
      allTickets
        .filter(isHistoryTicket)
        .filter((ticket) => matchesSearch(ticket, searchTerm))
        .sort(sortTicketsByUpdatedDate),
    [allTickets, searchTerm]
  );

  useEffect(() => {
    function handlePopState() {
      setCurrentView(getViewFromUrl());
      setSource(getSourceFromUrl());
    }

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function goToView(view: MyTicketsView) {
    setSelectedTicket(null);
    setSearchTerm("");
    setTicketFilter("all");
    updateViewInUrl(view, source);
    setCurrentView(view);
  }

  function goBack() {
    setSelectedTicket(null);
    setSearchTerm("");
    setTicketFilter("all");

    if (source === "approvals" || isApproverPortalUser) {
      window.location.assign("/approvals");
      return;
    }

    goToView("home");
  }

  function goToApprovals() {
    window.location.assign("/approvals");
  }

  async function refetchAll() {
    await Promise.all([
      myTicketsQuery.refetch(),
      requesterContextQuery.refetch(),
    ]);
  }

  async function handleTicketCreated() {
    await refetchAll();
    goToView("list");
  }

  const isLoadingHome = myTicketsQuery.isLoading;

  const approverReturnButton = isApproverPortalUser ? (
    <div className="mb-lg flex justify-end">
      <button
        type="button"
        onClick={goToApprovals}
        className="inline-flex items-center justify-center gap-xs rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent"
      >
        <IconShieldCheck size={16} aria-hidden={true} />
        Onay Paneline Dön
      </button>
    </div>
  ) : null;

  return (
    <SimplePortalShell badge="Çalışan Portalı" title="Yardım Merkezi" subtitle="">
      {approverReturnButton}

      {currentView === "home" ? (
        <section className="mx-auto max-w-4xl">
          {isLoadingHome ? (
            <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-[150px] rounded-panel" />
              <Skeleton className="h-[150px] rounded-panel" />
              <Skeleton className="h-[150px] rounded-panel" />
            </div>
          ) : (
            <PortalActionGrid
              actions={[
                {
                  key: "create",
                  label: "Talep Oluştur",
                  icon: <IconPlus size={34} aria-hidden={true} />,
                  tone: "accent",
                  onClick: () => goToView("create"),
                },
                {
                  key: "list",
                  label: "Taleplerim",
                  icon: <IconClipboardList size={34} aria-hidden={true} />,
                  badge: activeTicketCount,
                  tone: "warning",
                  onClick: () => goToView("list"),
                },
                {
                  key: "history",
                  label: "Geçmiş İşlemler",
                  icon: <IconHistory size={34} aria-hidden={true} />,
                  badge: historyTicketCount,
                  tone: "neutral",
                  onClick: () => goToView("history"),
                },
              ]}
            />
          )}
        </section>
      ) : null}

      {currentView === "create" ? (
        <section className="mx-auto max-w-3xl">
          <div className="mb-lg">
            <BackButton onClick={goBack} />
          </div>

          <RequesterTicketForm
            requesterContext={requesterContextQuery.data}
            isContextLoading={requesterContextQuery.isLoading}
            isContextError={requesterContextQuery.isError}
            onRefreshContext={() => requesterContextQuery.refetch()}
            onCreated={handleTicketCreated}
          />
        </section>
      ) : null}

      {currentView === "list" ? (
        <TicketListSection
          title="Taleplerim"
          tickets={activeTickets}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterValue={ticketFilter}
          onFilterChange={setTicketFilter}
          isFetching={myTicketsQuery.isFetching}
          selectedTicket={selectedTicket}
          onSelectTicket={setSelectedTicket}
          onRefresh={refetchAll}
          onBack={goBack}
          onCreate={() => goToView("create")}
        />
      ) : null}

      {currentView === "history" ? (
        <TicketListSection
          title="Geçmiş İşlemler"
          tickets={historyTickets}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isFetching={myTicketsQuery.isFetching}
          selectedTicket={selectedTicket}
          onSelectTicket={setSelectedTicket}
          onRefresh={refetchAll}
          onBack={goBack}
          onCreate={() => goToView("create")}
        />
      ) : null}

      <TicketChatDrawer
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onCommentCreated={refetchAll}
      />
    </SimplePortalShell>
  );
}