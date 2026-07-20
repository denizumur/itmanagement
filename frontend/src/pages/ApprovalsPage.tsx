import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  approveTicket,
  fetchTicketApprovals,
  rejectTicket,
} from "../api/tickets";
import { SimplePortalShell } from "../components/layout/SimplePortalShell";
import { StatusBadge } from "../components/ui/StatusBadge";
import type {
  TicketApproval,
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

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<TicketApproval[]>([]);
  const [decisionNotes, setDecisionNotes] = useState<Record<number, string>>({});
  const [actionTicketId, setActionTicketId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadApprovals() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchTicketApprovals();
      setApprovals(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals();
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

  function updateDecisionNote(ticketId: number, value: string) {
    setDecisionNotes((current) => ({
      ...current,
      [ticketId]: value,
    }));
  }

  async function handleApprove(approval: TicketApproval) {
    setActionTicketId(approval.ticket.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await approveTicket(approval.ticket.id, {
        decision_note: decisionNotes[approval.ticket.id]?.trim() || "",
      });

      setSuccessMessage(`#${approval.ticket.id} ticket onaylandı ve IT kuyruğuna aktarıldı.`);
      await loadApprovals();
    } catch (approveError) {
      setError(getErrorMessage(approveError));
    } finally {
      setActionTicketId(null);
    }
  }

  async function handleReject(approval: TicketApproval) {
    setActionTicketId(approval.ticket.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await rejectTicket(approval.ticket.id, {
        decision_note: decisionNotes[approval.ticket.id]?.trim() || "",
      });

      setSuccessMessage(`#${approval.ticket.id} ticket reddedildi ve kapatıldı.`);
      await loadApprovals();
    } catch (rejectError) {
      setError(getErrorMessage(rejectError));
    } finally {
      setActionTicketId(null);
    }
  }

  return (
    <SimplePortalShell
      badge="Approver Portalı"
      title="Onay Kuyruğum"
      subtitle="Ekibinden gelen IT taleplerini burada onaylayabilir veya reddedebilirsin."
    >
      <div className="grid gap-lg lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel">
          <div className="flex flex-col gap-md md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-h3">Bekleyen onaylar</h2>
              <p className="mt-sm text-body text-text-secondary">
                Sadece doğrudan sana atanmış yönetici onayları burada görünür.
                Onaylanan talepler IT kuyruğuna düşer; reddedilen talepler kapanır.
              </p>
            </div>

            <button
              type="button"
              onClick={loadApprovals}
              className="rounded-app border border-border-subtle px-md py-sm text-body text-text-secondary transition hover:border-border-strong hover:text-text-primary"
            >
              Yenile
            </button>
          </div>

          <div className="mt-lg grid gap-md sm:grid-cols-3">
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-md">
              <p className="text-caption text-text-secondary">Bekleyen</p>
              <p className="mt-xs text-h2">{summary.total}</p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-md">
              <p className="text-caption text-text-secondary">Acil</p>
              <p className="mt-xs text-h2">{summary.urgent}</p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-md">
              <p className="text-caption text-text-secondary">Yüksek</p>
              <p className="mt-xs text-h2">{summary.high}</p>
            </div>
          </div>

          {error && (
            <div className="mt-lg rounded-app border border-danger/30 bg-danger-bg px-md py-sm text-body text-danger">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mt-lg rounded-app border border-success/30 bg-success-bg px-md py-sm text-body text-success">
              {successMessage}
            </div>
          )}

          <div className="mt-lg">
            {isLoading ? (
              <div className="rounded-2xl border border-border-subtle bg-surface-0 p-lg text-body text-text-secondary">
                Onaylar yükleniyor...
              </div>
            ) : approvals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-0 p-lg text-center">
                <p className="text-body font-semibold">Bekleyen onay yok.</p>
                <p className="mt-xs text-body text-text-secondary">
                  Ekibinden yeni bir ticket onaya düştüğünde burada görünecek.
                </p>
              </div>
            ) : (
              <div className="space-y-md">
                {approvals.map((approval) => {
                  const ticket = approval.ticket;
                  const isActing = actionTicketId === ticket.id;

                  return (
                    <article
                      key={approval.id}
                      className="rounded-2xl border border-border-subtle bg-surface-0 p-lg"
                    >
                      <div className="flex flex-col gap-md md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-sm">
                            <h3 className="text-h3">
                              #{ticket.id} {ticket.title}
                            </h3>

                            <StatusBadge variant={priorityMeta[ticket.priority].variant}>
                              {priorityMeta[ticket.priority].label}
                            </StatusBadge>

                            <StatusBadge variant={statusMeta[ticket.status].variant}>
                              {statusMeta[ticket.status].label}
                            </StatusBadge>
                          </div>

                          <p className="mt-xs text-caption text-text-secondary">
                            {ticket.employee_name} · {ticket.employee_email || "E-posta yok"} ·{" "}
                            {formatDate(ticket.created_at)}
                          </p>
                        </div>

                        <StatusBadge variant="warning">Onay bekliyor</StatusBadge>
                      </div>

                      <p className="mt-md rounded-2xl bg-surface-1 p-md text-body text-text-secondary">
                        {ticket.description}
                      </p>

                      <div className="mt-md grid gap-md md:grid-cols-3">
                        <div>
                          <p className="text-caption text-text-secondary">Kategori</p>
                          <p className="mt-xs text-body font-semibold">
                            {ticket.category_label}
                          </p>
                        </div>

                        <div>
                          <p className="text-caption text-text-secondary">Requester</p>
                          <p className="mt-xs text-body font-semibold">
                            {ticket.employee_name}
                          </p>
                        </div>

                        <div>
                          <p className="text-caption text-text-secondary">Onaycı</p>
                          <p className="mt-xs text-body font-semibold">
                            {approval.approver_name}
                          </p>
                        </div>
                      </div>

                      <div className="mt-md">
                        <label className="text-caption text-text-secondary">
                          Karar notu
                        </label>
                        <textarea
                          value={decisionNotes[ticket.id] ?? ""}
                          onChange={(event) =>
                            updateDecisionNote(ticket.id, event.target.value)
                          }
                          className="mt-xs min-h-[90px] w-full rounded-app border border-border-subtle bg-surface-1 px-md py-sm text-body outline-none transition focus:border-accent"
                          placeholder="Onay veya red gerekçeni yaz. Boş bırakılabilir."
                        />
                      </div>

                      <div className="mt-md flex flex-col gap-sm sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleReject(approval)}
                          className="rounded-app border border-danger/40 px-md py-sm text-body font-semibold text-danger transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isActing ? "İşleniyor..." : "Reddet"}
                        </button>

                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleApprove(approval)}
                          className="rounded-app bg-accent px-md py-sm text-body font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isActing ? "İşleniyor..." : "Onayla"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="panel">
          <h2 className="text-h3">Onay kuralı</h2>
          <p className="mt-sm text-body text-text-secondary">
            Requester bir personel kaydına bağlıysa ve o personelin yöneticisi
            Approver/Admin rolündeyse ticket önce yönetici onayına düşer.
          </p>

          <div className="mt-lg space-y-sm text-body text-text-secondary">
            <p>• Onaylanan ticket IT kuyruğuna aktarılır.</p>
            <p>• Reddedilen ticket kapanır ve IT kuyruğuna düşmez.</p>
            <p>• Sadece atanmış yönetici bu onayı görür.</p>
            <p>• Approver operasyonel envanter ekranlarını kullanmaz.</p>
          </div>
        </aside>
      </div>
    </SimplePortalShell>
  );
}