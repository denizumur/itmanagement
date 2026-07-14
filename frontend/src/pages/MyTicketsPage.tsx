import axios from "axios";
import {useEffect, useMemo, useState } from "react";
import type { FormEvent } from 'react';
import { createTicket, fetchMyTickets } from "../api/tickets";
import { SimplePortalShell } from "../components/layout/SimplePortalShell";
import { DataTable } from "../components/ui/DataTable";
import { StatusBadge } from "../components/ui/StatusBadge";
import type {
  Ticket,
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

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<TicketCreatePayload>({
    title: "",
    description: "",
    category: "other",
    priority: "normal",
  });

  async function loadTickets() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchMyTickets();
      setTickets(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  const summary = useMemo(() => {
    return {
      open: tickets.filter((ticket) => ticket.status === "open").length,
      inProgress: tickets.filter((ticket) => ticket.status === "in_progress")
        .length,
      completed: tickets.filter((ticket) =>
        ["resolved", "closed"].includes(ticket.status)
      ).length,
    };
  }, [tickets]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsCreating(true);
    setError(null);

    try {
      await createTicket({
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

      await loadTickets();
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <SimplePortalShell
      badge="Requester Portalı"
      title="Benim Ticketlarım"
      subtitle="IT taleplerini buradan oluşturabilir ve mevcut taleplerinin durumunu takip edebilirsin."
    >
      <div className="grid gap-lg lg:grid-cols-[0.9fr_1.1fr]">
        <section className="panel">
          <h2 className="text-h3">Yeni Ticket Oluştur</h2>
          <p className="mt-sm text-body text-text-secondary">
            Talebini kısa ve anlaşılır şekilde yaz. IT ekibi kuyruğunda görünecek.
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
                className="mt-xs w-full rounded-app border border-border-subtle bg-surface-0 px-md py-sm text-body outline-none transition focus:border-accent"
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
                  className="mt-xs w-full rounded-app border border-border-subtle bg-surface-0 px-md py-sm text-body outline-none transition focus:border-accent"
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
                  className="mt-xs w-full rounded-app border border-border-subtle bg-surface-0 px-md py-sm text-body outline-none transition focus:border-accent"
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
                className="mt-xs min-h-[120px] w-full rounded-app border border-border-subtle bg-surface-0 px-md py-sm text-body outline-none transition focus:border-accent"
                placeholder="Sorunu, ne zaman başladığını ve etkisini yaz."
                required
              />
            </div>

            {error && (
              <div className="rounded-app border border-danger/30 bg-danger-bg px-md py-sm text-body text-danger">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isCreating}
              className="w-full rounded-app bg-accent px-md py-sm text-body font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Oluşturuluyor..." : "Ticket Oluştur"}
            </button>
          </form>
        </section>

        <section>
          <div className="grid gap-md sm:grid-cols-3">
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-md">
              <p className="text-caption text-text-secondary">Açık Talepler</p>
              <p className="mt-xs text-h2">{summary.open}</p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-md">
              <p className="text-caption text-text-secondary">İşlemde</p>
              <p className="mt-xs text-h2">{summary.inProgress}</p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-md">
              <p className="text-caption text-text-secondary">Tamamlanan</p>
              <p className="mt-xs text-h2">{summary.completed}</p>
            </div>
          </div>

          <div className="mt-lg">
            <DataTable
              title="Ticketlarım"
              description="Sadece kendi oluşturduğun IT talepleri burada görünür."
              action={
                <button
                  type="button"
                  onClick={loadTickets}
                  className="rounded-app border border-border-subtle px-md py-sm text-body text-text-secondary transition hover:border-border-strong hover:text-text-primary"
                >
                  Yenile
                </button>
              }
            >
              {isLoading ? (
                <div className="p-lg text-body text-text-secondary">
                  Ticketlar yükleniyor...
                </div>
              ) : tickets.length === 0 ? (
                <div className="p-lg text-center text-body text-text-secondary">
                  Henüz ticket oluşturmadın.
                </div>
              ) : (
                <table className="min-w-full text-left text-body">
                  <thead className="text-caption text-text-secondary">
                    <tr>
                      <th className="px-sm py-sm">Başlık</th>
                      <th className="px-sm py-sm">Durum</th>
                      <th className="px-sm py-sm">Öncelik</th>
                      <th className="px-sm py-sm">Kategori</th>
                      <th className="px-sm py-sm">Tarih</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="border-t border-border-subtle"
                      >
                        <td className="px-sm py-md">
                          <p className="font-semibold">{ticket.title}</p>
                          <p className="mt-xs max-w-md truncate text-caption text-text-secondary">
                            {ticket.description}
                          </p>
                        </td>
                        <td className="px-sm py-md">
                          <StatusBadge variant={statusMeta[ticket.status].variant}>
                            {statusMeta[ticket.status].label}
                          </StatusBadge>
                        </td>
                        <td className="px-sm py-md">
                          <StatusBadge
                            variant={priorityMeta[ticket.priority].variant}
                          >
                            {priorityMeta[ticket.priority].label}
                          </StatusBadge>
                        </td>
                        <td className="px-sm py-md text-text-secondary">
                          {ticket.category_label}
                        </td>
                        <td className="px-sm py-md text-text-secondary">
                          {formatDate(ticket.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </DataTable>
          </div>
        </section>
      </div>
    </SimplePortalShell>
  );
}