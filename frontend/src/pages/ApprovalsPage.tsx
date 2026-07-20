import axios from "axios";
import {
  IconArrowLeft,
  IconCheck,
  IconClipboardList,
  IconClock,
  IconHistory,
  IconPlus,
  IconRefresh,
  IconShieldCheck,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import {
  approveTicket,
  fetchTicketApprovals,
  rejectTicket,
} from "../api/tickets";
import { SimplePortalShell } from "../components/layout/SimplePortalShell";
import { PortalActionGrid } from "../components/portal/PortalActionGrid";
import { TicketTimelineIndicator } from "../components/tickets/TicketTimelineIndicator";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useMyTickets } from "../hooks/useTickets";
import type {
  Ticket,
  TicketApproval,
  TicketPriority,
  TicketStatus,
} from "../types/tickets";

type ApprovalsView = "home" | "pending";

const statusMeta: Record<
  TicketStatus,
  {
    label: string;
    variant: "accent" | "success" | "warning" | "danger" | "neutral";
  }
> = {
  open: { label: "Açık", variant: "accent" },
  in_progress: { label: "İşlemde", variant: "warning" },
  returned_to_requester: {
    label: "Geri gönderildi",
    variant: "danger",
  },
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

function getCurrentView(value: string | null): ApprovalsView {
  if (value === "pending") {
    return "pending";
  }

  return "home";
}

function getViewFromUrl(): ApprovalsView {
  return getCurrentView(new URLSearchParams(window.location.search).get("view"));
}

function updateViewInUrl(view: ApprovalsView) {
  const url = new URL(window.location.href);

  if (view === "home") {
    url.searchParams.delete("view");
  } else {
    url.searchParams.set("view", view);
  }

  window.history.pushState({}, "", url);
}

function goToMyTicketsView(view: "create" | "list" | "history") {
  window.location.assign(`/my-tickets?view=${view}&from=approvals`);
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (typeof data === "object" && data !== null) {
      const firstValue = Object.values(data)[0];

      if (Array.isArray(firstValue)) {
        return String(firstValue[0]);
      }

      if (typeof firstValue === "string") {
        return firstValue;
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

function CompactApprovalSummary({
  total,
  urgent,
  high,
}: {
  total: number;
  urgent: number;
  high: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-xs text-caption text-text-secondary">
      <span className="rounded-full border border-border bg-surface-1 px-sm py-1">
        Bekleyen: <strong className="text-text-primary">{total}</strong>
      </span>

      <span className="rounded-full border border-danger/30 bg-danger-bg px-sm py-1 text-danger">
        Acil: <strong>{urgent}</strong>
      </span>

      <span className="rounded-full border border-warning/30 bg-warning-bg px-sm py-1 text-warning">
        Yüksek: <strong>{high}</strong>
      </span>
    </div>
  );
}

function PendingApprovalCard({
  approval,
  decisionNote,
  isActing,
  onDecisionNoteChange,
  onApprove,
  onReject,
}: {
  approval: TicketApproval;
  decisionNote: string;
  isActing: boolean;
  onDecisionNoteChange: (ticketId: number, value: string) => void;
  onApprove: (approval: TicketApproval) => void;
  onReject: (approval: TicketApproval) => void;
}) {
  const ticket = approval.ticket;
  const trimmedDecisionNote = decisionNote.trim();
  const isDecisionDisabled = isActing || !trimmedDecisionNote;
  const priority = priorityMeta[ticket.priority];
  const status = statusMeta[ticket.status];

  return (
    <article className="rounded-panel border border-border bg-surface-1 p-lg shadow-panel transition hover:border-accent/40">
      <div className="flex flex-col gap-md lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-xs">
            <span className="rounded-full border border-border bg-surface-2 px-sm py-1 text-caption text-text-secondary">
              #{ticket.id}
            </span>

            <StatusBadge variant={priority.variant}>{priority.label}</StatusBadge>
            <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
            <StatusBadge variant="warning">Onay bekliyor</StatusBadge>
          </div>

          <h3 className="mt-sm text-h3 text-text-primary">{ticket.title}</h3>

          <div className="mt-xs flex flex-wrap items-center gap-sm text-caption text-text-secondary">
            <span className="inline-flex items-center gap-[4px]">
              <IconUser size={14} aria-hidden={true} />
              {ticket.employee_name}
            </span>

            <span className="inline-flex items-center gap-[4px]">
              <IconClock size={14} aria-hidden={true} />
              {formatDate(ticket.created_at)}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-md line-clamp-2 rounded-2xl bg-surface-2 px-md py-sm text-body text-text-secondary">
        {ticket.description}
      </p>

      <div className="mt-md">
        <label
          htmlFor={`decision-note-${ticket.id}`}
          className="text-caption font-medium text-text-secondary"
        >
          Karar notu
        </label>

        <textarea
          id={`decision-note-${ticket.id}`}
          value={decisionNote}
          onChange={(event) =>
            onDecisionNoteChange(ticket.id, event.target.value)
          }
          className="mt-xs min-h-[82px] w-full rounded-app border border-border bg-surface-2 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-secondary focus:border-accent"
          placeholder="Kısa karar notu yaz..."
        />
      </div>

      <div className="mt-md flex flex-col gap-sm border-t border-border pt-md lg:flex-row lg:items-center lg:justify-between">
        <TicketTimelineIndicator
          ticketId={ticket.id}
          ticketTitle={ticket.title}
          className="w-full lg:w-auto"
        />

        <div className="flex flex-col gap-sm sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isDecisionDisabled}
            onClick={() => onReject(approval)}
            className="inline-flex items-center justify-center gap-xs rounded-app border border-danger/40 px-md py-sm text-body font-semibold text-danger transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconX size={16} aria-hidden={true} />
            {isActing ? "İşleniyor..." : "Reddet"}
          </button>

          <button
            type="button"
            disabled={isDecisionDisabled}
            onClick={() => onApprove(approval)}
            className="inline-flex items-center justify-center gap-xs rounded-app bg-accent px-md py-sm text-body font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconCheck size={16} aria-hidden={true} />
            {isActing ? "İşleniyor..." : "Onayla"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ApprovalsPage() {
  const [currentView, setCurrentView] = useState<ApprovalsView>(() =>
    getViewFromUrl()
  );
  const [approvals, setApprovals] = useState<TicketApproval[]>([]);
  const myTicketsQuery = useMyTickets();
  const [decisionNotes, setDecisionNotes] = useState<Record<number, string>>({});
  const [actionTicketId, setActionTicketId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadApprovals() {
    setIsRefreshing(true);
    setError(null);

    try {
      const data = await fetchTicketApprovals();

      setApprovals(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadApprovals();
  }, []);

  useEffect(() => {
    function handlePopState() {
      setCurrentView(getViewFromUrl());
    }

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const summary = useMemo(() => {
    return {
      total: approvals.length,
      urgent: approvals.filter((approval) => approval.ticket.priority === "urgent")
        .length,
      high: approvals.filter((approval) => approval.ticket.priority === "high")
        .length,
    };
  }, [approvals]);

  const myTicketSummary = useMemo(() => {
    const myTickets = myTicketsQuery.data ?? [];

    return {
      active: myTickets.filter(isActiveTicket).length,
      history: myTickets.filter(isHistoryTicket).length,
    };
  }, [myTicketsQuery.data]);

  function goToView(view: ApprovalsView) {
    setError(null);
    setSuccessMessage(null);
    updateViewInUrl(view);
    setCurrentView(view);
  }

  function updateDecisionNote(ticketId: number, value: string) {
    setDecisionNotes((current) => ({
      ...current,
      [ticketId]: value,
    }));
  }

  async function handleApprove(approval: TicketApproval) {
    const decisionNote = decisionNotes[approval.ticket.id]?.trim() ?? "";

    if (!decisionNote) {
      setError("Onay için karar notu zorunludur.");
      return;
    }

    setActionTicketId(approval.ticket.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await approveTicket(approval.ticket.id, {
        decision_note: decisionNote,
      });

      setSuccessMessage(`#${approval.ticket.id} onaylandı.`);
      setDecisionNotes((current) => {
        const next = { ...current };

        delete next[approval.ticket.id];

        return next;
      });

      await loadApprovals();
    } catch (approveError) {
      setError(getErrorMessage(approveError));
    } finally {
      setActionTicketId(null);
    }
  }

  async function handleReject(approval: TicketApproval) {
    const decisionNote = decisionNotes[approval.ticket.id]?.trim() ?? "";

    if (!decisionNote) {
      setError("Red için karar notu zorunludur.");
      return;
    }

    setActionTicketId(approval.ticket.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await rejectTicket(approval.ticket.id, {
        decision_note: decisionNote,
      });

      setSuccessMessage(`#${approval.ticket.id} reddedildi.`);
      setDecisionNotes((current) => {
        const next = { ...current };

        delete next[approval.ticket.id];

        return next;
      });

      await loadApprovals();
    } catch (rejectError) {
      setError(getErrorMessage(rejectError));
    } finally {
      setActionTicketId(null);
    }
  }

  return (
    <SimplePortalShell badge="Approver Portalı" title="Yardım Merkezi" subtitle="">
      {currentView === "home" ? (
        <section className="mx-auto max-w-5xl">
          {isLoading ? (
            <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
              <div className="h-[150px] rounded-panel border border-border bg-surface-1 shadow-panel" />
              <div className="h-[150px] rounded-panel border border-border bg-surface-1 shadow-panel" />
              <div className="h-[150px] rounded-panel border border-border bg-surface-1 shadow-panel" />
              <div className="h-[150px] rounded-panel border border-border bg-surface-1 shadow-panel" />
            </div>
          ) : (
            <PortalActionGrid
              className="lg:grid-cols-4"
              actions={[
                {
                  key: "create",
                  label: "Talep Oluştur",
                  icon: <IconPlus size={34} aria-hidden={true} />,
                  tone: "accent",
                  onClick: () => goToMyTicketsView("create"),
                },
                {
                  key: "my-tickets",
                  label: "Taleplerim",
                  icon: <IconClipboardList size={34} aria-hidden={true} />,
                  badge: myTicketsQuery.isLoading ? null : myTicketSummary.active,
                  tone: "warning",
                  onClick: () => goToMyTicketsView("list"),
                },
                {
                  key: "history",
                  label: "Geçmiş İşlemler",
                  icon: <IconHistory size={34} aria-hidden={true} />,
                  badge: myTicketsQuery.isLoading ? null : myTicketSummary.history,
                  tone: "neutral",
                  onClick: () => goToMyTicketsView("history"),
                },
                {
                  key: "pending-approvals",
                  label: "Onay Bekleyenler",
                  icon: <IconShieldCheck size={34} aria-hidden={true} />,
                  badge: summary.total,
                  tone: summary.total > 0 ? "danger" : "success",
                  onClick: () => goToView("pending"),
                },
              ]}
            />
          )}
        </section>
      ) : null}

      {currentView === "pending" ? (
        <section>
          <div className="mb-lg flex flex-col gap-md lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-sm">
              <div className="flex items-center gap-sm">
                <BackButton onClick={() => goToView("home")} />
                <h2 className="text-h2 text-text-primary">Onay Bekleyenler</h2>
              </div>

              <CompactApprovalSummary
                total={summary.total}
                urgent={summary.urgent}
                high={summary.high}
              />
            </div>

            <button
              type="button"
              onClick={loadApprovals}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-xs rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconRefresh
                size={16}
                aria-hidden={true}
                className={isRefreshing ? "animate-spin" : undefined}
              />
              Yenile
            </button>
          </div>

          {error ? (
            <div className="mb-md rounded-app border border-danger/30 bg-danger-bg px-md py-sm text-body text-danger">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-md rounded-app border border-success/30 bg-success-bg px-md py-sm text-body text-success">
              {successMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="rounded-panel border border-border bg-surface-1 p-lg text-body text-text-secondary shadow-panel">
              Onaylar yükleniyor...
            </div>
          ) : approvals.length === 0 ? (
            <div className="rounded-panel border border-dashed border-border bg-surface-1 p-xl text-center shadow-panel">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-text-secondary">
                <IconCheck size={24} aria-hidden={true} />
              </div>

              <h3 className="mt-md text-h3 text-text-primary">
                Bekleyen onay yok
              </h3>
            </div>
          ) : (
            <div className="grid gap-md">
              {approvals.map((approval) => (
                <PendingApprovalCard
                  key={approval.id}
                  approval={approval}
                  decisionNote={decisionNotes[approval.ticket.id] ?? ""}
                  isActing={actionTicketId === approval.ticket.id}
                  onDecisionNoteChange={updateDecisionNote}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </SimplePortalShell>
  );
}