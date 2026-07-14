import axios from "axios";
import {useEffect, useMemo, useState } from "react";
import type { FormEvent } from 'react';
import {
  createTicketComment,
  fetchTicketComments,
  fetchTicketQueue,
  updateTicketStatus,
} from "../api/tickets";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/layout/AppShell";
import { DataTable } from "../components/ui/DataTable";
import { StatusBadge } from "../components/ui/StatusBadge";
import { canManage } from "../lib/rbac";
import type {
  Ticket,
  TicketComment,
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

const statusOptions: Array<{ value: TicketStatus; label: string }> = [
  { value: "open", label: "Açık" },
  { value: "in_progress", label: "İşlemde" },
  { value: "resolved", label: "Çözüldü" },
  { value: "closed", label: "Kapandı" },
];

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

export function TicketsQueuePage() {
  const { user } = useAuth();
  const canEditTickets = canManage(user?.role);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadQueue() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchTicketQueue();
      setTickets(data);

      if (selectedTicket) {
        const refreshed = data.find((ticket) => ticket.id === selectedTicket.id);
        setSelectedTicket(refreshed ?? null);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadComments(ticketId: number) {
    setIsCommentsLoading(true);

    try {
      const data = await fetchTicketComments(ticketId);
      setComments(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsCommentsLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  const summary = useMemo(() => {
    return {
      open: tickets.filter((ticket) => ticket.status === "open").length,
      inProgress: tickets.filter((ticket) => ticket.status === "in_progress")
        .length,
      urgent: tickets.filter((ticket) => ticket.priority === "urgent").length,
    };
  }, [tickets]);

  async function handleSelectTicket(ticket: Ticket) {
    setSelectedTicket(ticket);
    setCommentBody("");
    setError(null);
    await loadComments(ticket.id);
  }

  async function handleStatusChange(ticket: Ticket, status: TicketStatus) {
    setError(null);

    try {
      const updated = await updateTicketStatus(ticket.id, status);

      setTickets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );

      if (selectedTicket?.id === updated.id) {
        setSelectedTicket(updated);
      }
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTicket || !commentBody.trim()) {
      return;
    }

    setError(null);

    try {
      await createTicketComment(selectedTicket.id, {
        body: commentBody.trim(),
        is_internal: isInternalComment,
      });

      setCommentBody("");
      await loadComments(selectedTicket.id);
      await loadQueue();
    } catch (commentError) {
      setError(getErrorMessage(commentError));
    }
  }

  return (
    <AppShell>
      <div className="mb-lg flex flex-col gap-md md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-display">Ticket Kuyruğu</h1>
          <p className="mt-sm text-text-secondary">
            Requester kullanıcılarından gelen IT taleplerini buradan takip et.
          </p>
        </div>

        <button
          type="button"
          onClick={loadQueue}
          className="rounded-app border border-border-subtle px-md py-sm text-body text-text-secondary transition hover:border-border-strong hover:text-text-primary"
        >
          Kuyruğu Yenile
        </button>
      </div>

      <div className="mb-lg grid gap-md md:grid-cols-3">
        <div className="panel">
          <p className="text-caption text-text-secondary">Açık Ticket</p>
          <p className="mt-xs text-h2">{summary.open}</p>
        </div>

        <div className="panel">
          <p className="text-caption text-text-secondary">İşlemde</p>
          <p className="mt-xs text-h2">{summary.inProgress}</p>
        </div>

        <div className="panel">
          <p className="text-caption text-text-secondary">Acil</p>
          <p className="mt-xs text-h2">{summary.urgent}</p>
        </div>
      </div>

      {error && (
        <div className="mb-lg rounded-app border border-danger/30 bg-danger-bg px-md py-sm text-body text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-lg xl:grid-cols-[1.2fr_0.8fr]">
        <DataTable
          title="IT Ticket Kuyruğu"
          description="Onay akışı N4'te eklenecek. Bu fazda ticketlar doğrudan IT kuyruğuna düşer."
        >
          {isLoading ? (
            <div className="p-lg text-body text-text-secondary">
              Ticket kuyruğu yükleniyor...
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-lg text-center text-body text-text-secondary">
              Kuyrukta aktif ticket yok.
            </div>
          ) : (
            <table className="min-w-full text-left text-body">
              <thead className="text-caption text-text-secondary">
                <tr>
                  <th className="px-sm py-sm">Ticket</th>
                  <th className="px-sm py-sm">Requester</th>
                  <th className="px-sm py-sm">Durum</th>
                  <th className="px-sm py-sm">Öncelik</th>
                  <th className="px-sm py-sm">Tarih</th>
                  <th className="px-sm py-sm">Aksiyon</th>
                </tr>
              </thead>

              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-border-subtle">
                    <td className="px-sm py-md">
                      <p className="font-semibold">#{ticket.id} {ticket.title}</p>
                      <p className="mt-xs max-w-sm truncate text-caption text-text-secondary">
                        {ticket.description}
                      </p>
                    </td>

                    <td className="px-sm py-md text-text-secondary">
                      <p>{ticket.employee_name}</p>
                      <p className="text-caption">{ticket.employee_email}</p>
                    </td>

                    <td className="px-sm py-md">
                      {canEditTickets ? (
                        <select
                          value={ticket.status}
                          onChange={(event) =>
                            handleStatusChange(
                              ticket,
                              event.target.value as TicketStatus
                            )
                          }
                          className="rounded-app border border-border-subtle bg-surface-0 px-sm py-xs text-caption outline-none transition focus:border-accent"
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
                      )}
                    </td>

                    <td className="px-sm py-md">
                      <StatusBadge variant={priorityMeta[ticket.priority].variant}>
                        {priorityMeta[ticket.priority].label}
                      </StatusBadge>
                    </td>

                    <td className="px-sm py-md text-text-secondary">
                      {formatDate(ticket.created_at)}
                    </td>

                    <td className="px-sm py-md">
                      <button
                        type="button"
                        onClick={() => handleSelectTicket(ticket)}
                        className="rounded-app border border-border-subtle px-sm py-xs text-caption text-text-secondary transition hover:border-border-strong hover:text-text-primary"
                      >
                        Detay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataTable>

        <aside className="panel">
          {!selectedTicket ? (
            <div>
              <h2 className="text-h3">Ticket Detayı</h2>
              <p className="mt-sm text-body text-text-secondary">
                Detay ve yorumları görmek için kuyruktan bir ticket seç.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-md">
                <div>
                  <h2 className="text-h3">#{selectedTicket.id} {selectedTicket.title}</h2>
                  <p className="mt-xs text-caption text-text-secondary">
                    {selectedTicket.employee_name} · {formatDate(selectedTicket.created_at)}
                  </p>
                </div>

                <StatusBadge variant={statusMeta[selectedTicket.status].variant}>
                  {statusMeta[selectedTicket.status].label}
                </StatusBadge>
              </div>

              <p className="mt-md rounded-2xl bg-surface-0 p-md text-body text-text-secondary">
                {selectedTicket.description}
              </p>

              <div className="mt-lg">
                <h3 className="text-h3">Yorumlar</h3>

                {isCommentsLoading ? (
                  <p className="mt-md text-body text-text-secondary">
                    Yorumlar yükleniyor...
                  </p>
                ) : comments.length === 0 ? (
                  <p className="mt-md text-body text-text-secondary">
                    Henüz yorum yok.
                  </p>
                ) : (
                  <div className="mt-md space-y-sm">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-2xl border border-border-subtle bg-surface-0 p-md"
                      >
                        <div className="flex items-center justify-between gap-md">
                          <p className="text-body font-semibold">
                            {comment.author_name ?? "Sistem"}
                          </p>

                          {comment.is_internal && (
                            <StatusBadge variant="warning">İç not</StatusBadge>
                          )}
                        </div>

                        <p className="mt-xs text-body text-text-secondary">
                          {comment.body}
                        </p>

                        <p className="mt-xs text-caption text-text-secondary">
                          {formatDate(comment.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canEditTickets && (
                <form className="mt-lg space-y-md" onSubmit={handleCommentSubmit}>
                  <div>
                    <label className="text-caption text-text-secondary">
                      Yorum / İç Not
                    </label>
                    <textarea
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      className="mt-xs min-h-[90px] w-full rounded-app border border-border-subtle bg-surface-0 px-md py-sm text-body outline-none transition focus:border-accent"
                      placeholder="Ticket hakkında not ekle."
                    />
                  </div>

                  <label className="flex items-center gap-sm text-body text-text-secondary">
                    <input
                      type="checkbox"
                      checked={isInternalComment}
                      onChange={(event) =>
                        setIsInternalComment(event.target.checked)
                      }
                    />
                    IT iç notu olarak ekle
                  </label>

                  <button
                    type="submit"
                    className="w-full rounded-app bg-accent px-md py-sm text-body font-semibold text-white transition hover:opacity-90"
                  >
                    Yorum Ekle
                  </button>
                </form>
              )}
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}