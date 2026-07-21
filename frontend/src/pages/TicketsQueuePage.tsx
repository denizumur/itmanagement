import {
  IconAlertTriangle,
  IconClipboardList,
  IconClock,
  IconDeviceLaptop,
  IconMessageCircle,
  IconRefresh,
  IconSearch,
  IconTool,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { MiniMetricCard } from "../components/common/MiniMetricCard";
import { Skeleton } from "../components/common/Skeleton";
import { TablePagination } from "../components/common/TablePagination";
import { AppShell } from "../components/layout/AppShell";
import { TicketChatPanel } from "../components/tickets/TicketChatPanel";
import { TicketTimelineIndicator } from "../components/tickets/TicketTimelineIndicator";
import { GlowButton } from "../components/ui/GlowButton";
import { PageHeader } from "../components/ui/PageHeader";
import { PageTransition } from "../components/ui/PageTransition";
import { StatusBadge } from "../components/ui/StatusBadge";
import {
  useReturnTicketToRequester,
  useTicketContext,
  useTicketSummary,
  useTicketsTable,
  useUpdateTicketStatus,
} from "../hooks/useTickets";
import { useTableQueryState } from "../hooks/useTableQueryState";
import { cn } from "../lib/cn";
import { canManage } from "../lib/rbac";
import {
  getTicketApprovalMeta,
  getTicketPriorityMeta,
  getTicketStatusMeta,
} from "../lib/ticketLabels";
import type { TableQueryState } from "../types/table";
import type {
  Ticket,
  TicketContext,
  TicketPriority,
  TicketStatus,
} from "../types/tickets";

const statusOptions: Array<{ value: TicketStatus; label: string }> = [
  { value: "open", label: "Açık" },
  { value: "in_progress", label: "İşlemde" },
  { value: "resolved", label: "Çözüldü" },
  { value: "closed", label: "Kapandı" },
];

const statusFilterOptions: Array<{ value: "" | TicketStatus; label: string }> = [
  { value: "", label: "Tüm durumlar" },
  { value: "open", label: "Açık" },
  { value: "in_progress", label: "İşlemde" },
  { value: "resolved", label: "Çözüldü" },
];

const priorityFilterOptions: Array<{ value: "" | TicketPriority; label: string }> = [
  { value: "", label: "Tüm öncelikler" },
  { value: "urgent", label: "Acil" },
  { value: "high", label: "Yüksek" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Düşük" },
];

const orderingOptions = [
  { value: "-created_at", label: "Yeni önce" },
  { value: "created_at", label: "Eski önce" },
  { value: "-updated_at", label: "Son güncellenen" },
  { value: "priority", label: "Öncelik" },
];

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

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
  }).format(date);
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

function TicketInboxList({
  tickets,
  selectedTicketId,
  ordering,
  isFetching,
  onSelectTicket,
  onSortChange,
}: {
  tickets: Ticket[];
  selectedTicketId?: number | null;
  ordering?: string;
  isFetching: boolean;
  onSelectTicket: (ticket: Ticket) => void;
  onSortChange: (ordering: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-panel border border-border bg-surface-1 shadow-panel">
      <div className="border-b border-border p-md">
        <div className="flex items-center justify-between gap-sm">
          <div>
            <p className="text-caption font-semibold uppercase tracking-wide text-accent">
              Kuyruk
            </p>
            <h2 className="text-h3 text-text-primary">Ticket listesi</h2>
          </div>

          {isFetching ? (
            <span className="text-caption text-text-secondary">Yenileniyor</span>
          ) : null}
        </div>

        <select
          className="mt-md h-10 w-full rounded-app border border-border bg-surface-2 px-sm text-caption text-text-primary focus:outline-none"
          value={ordering ?? "-created_at"}
          onChange={(event) => onSortChange(event.target.value)}
          aria-label="Ticket sıralama"
        >
          {orderingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-sm">
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface-2 p-md text-body text-text-secondary">
            Kuyrukta aktif ticket yok.
          </div>
        ) : (
          <div className="space-y-xs">
            {tickets.map((ticket) => {
              const priorityMeta = getTicketPriorityMeta(ticket.priority);
              const statusMeta = getTicketStatusMeta(ticket.status);
              const selected = selectedTicketId === ticket.id;

              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => onSelectTicket(ticket)}
                  className={cn(
                    "w-full rounded-2xl border-l-4 p-sm text-left transition",
                    selected
                      ? "border-l-accent bg-accent-bg"
                      : "border-l-transparent bg-surface-2 hover:border-l-accent hover:bg-accent-bg"
                  )}
                >
                  <div className="flex items-start justify-between gap-sm">
                    <div className="min-w-0">
                      <p className="truncate text-body font-semibold text-text-primary">
                        #{ticket.id} {ticket.title}
                      </p>
                      <p className="mt-1 truncate text-caption text-text-secondary">
                        {ticket.employee_name}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-xs">
                      <StatusBadge variant={priorityMeta.variant}>
                        {priorityMeta.label}
                      </StatusBadge>

                      <StatusBadge variant={statusMeta.variant}>
                        {statusMeta.label}
                      </StatusBadge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function ResolvedTicketsList({
  tickets,
  selectedTicketId,
  isLoading,
  isFetching,
  isError,
  onSelectTicket,
}: {
  tickets: Ticket[];
  selectedTicketId?: number | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onSelectTicket: (ticket: Ticket) => void;
}) {
  return (
    <section className="mt-md rounded-panel border border-border bg-surface-1 p-md shadow-panel">
      <div className="flex items-center justify-between gap-sm">
        <div>
          <p className="text-caption font-semibold uppercase tracking-wide text-success">
            Çözülenler
          </p>
          <h2 className="text-h3 text-text-primary">Çözülen ticketlar</h2>
        </div>

        {isFetching ? (
          <span className="text-caption text-text-secondary">Yenileniyor</span>
        ) : null}
      </div>

      <div className="mt-sm space-y-xs">
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-surface-2 p-sm text-caption text-text-secondary">
            Çözülen ticketlar yükleniyor...
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-warning/30 bg-warning-bg p-sm text-caption text-warning">
            Çözülen ticket listesi alınamadı.
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface-2 p-sm text-caption text-text-secondary">
            Henüz çözülen ticket yok.
          </div>
        ) : (
          tickets.map((ticket) => {
            const priorityMeta = getTicketPriorityMeta(ticket.priority);
            const selected = selectedTicketId === ticket.id;

            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => onSelectTicket(ticket)}
                className={cn(
                  "w-full rounded-2xl border-l-4 p-sm text-left transition",
                  selected
                    ? "border-l-success bg-success-bg"
                    : "border-l-transparent bg-surface-2 hover:border-l-success hover:bg-success-bg"
                )}
              >
                <div className="flex items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="truncate text-caption font-semibold text-text-primary">
                      #{ticket.id} {ticket.title}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-text-secondary">
                      {ticket.employee_name} · {formatDate(ticket.created_at)}
                    </p>
                  </div>

                  <StatusBadge variant={priorityMeta.variant}>
                    {priorityMeta.label}
                  </StatusBadge>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function EmptyChatState() {
  return (
    <section className="flex min-h-[560px] flex-col items-center justify-center rounded-panel border border-border bg-surface-1 p-lg text-center shadow-panel">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-secondary">
        <IconMessageCircle size={22} aria-hidden={true} />
      </div>
      <h2 className="mt-md text-h3 text-text-primary">Görüntülemek için ticket seçin</h2>
      <p className="mt-sm max-w-sm text-body text-text-secondary">
        Sol listedeki satıra tıkladığında chat, durum yönetimi ve bağlam bilgileri açılır.
      </p>
    </section>
  );
}

function WorkspaceChatHeader({
  ticket,
  context,
  canEditTickets,
  isUpdating,
  isReturning,
  onClose,
  onRefresh,
  onOpenContext,
  onOpenReturnDialog,
}: {
  ticket: Ticket;
  context?: TicketContext;
  canEditTickets: boolean;
  isUpdating: boolean;
  isReturning: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpenContext: () => void;
  onOpenReturnDialog: () => void;
}) {
  const resolvedTicket = context?.ticket ?? ticket;
  const statusMeta = getTicketStatusMeta(resolvedTicket.status);
  const priorityMeta = getTicketPriorityMeta(resolvedTicket.priority);
  const approvalMeta = getTicketApprovalMeta(resolvedTicket.approval_status);

  const canReturnToRequester = Boolean(
    canEditTickets && context?.actions.can_return_to_requester
  );

  return (
    <div className="border-b border-border bg-surface-1 p-md">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <p className="text-caption text-text-secondary">
            {resolvedTicket.employee_name} · {formatDateTime(resolvedTicket.created_at)}
          </p>
          <h2 className="mt-xs truncate text-h2 text-text-primary">
            #{resolvedTicket.id} {resolvedTicket.title}
          </h2>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-xs">
          <TicketTimelineIndicator
            ticketId={resolvedTicket.id}
            ticketTitle={resolvedTicket.title}
            className="h-10"
          />

          {canReturnToRequester ? (
            <button
              type="button"
              onClick={onOpenReturnDialog}
              disabled={isReturning || isUpdating}
              className="inline-flex h-10 items-center justify-center gap-xs rounded-app border border-warning/40 px-sm text-caption font-semibold text-warning transition hover:bg-warning-bg disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconAlertTriangle size={15} aria-hidden={true} />
              Geri Çevir
            </button>
          ) : null}

          <button
            type="button"
            onClick={onOpenContext}
            className="inline-flex h-10 items-center justify-center rounded-app border border-border px-sm text-caption text-text-secondary transition hover:border-accent hover:text-accent 2xl:hidden"
          >
            Context
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isReturning}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-secondary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Ticket detayını yenile"
          >
            <IconRefresh size={17} aria-hidden={true} />
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isReturning}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-secondary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Ticket detayını kapat"
          >
            <IconX size={17} aria-hidden={true} />
          </button>
        </div>
      </div>

      <div className="mt-md flex flex-wrap gap-xs">
        <StatusBadge variant={approvalMeta.variant}>{approvalMeta.label}</StatusBadge>
        <StatusBadge variant={statusMeta.variant}>{statusMeta.label}</StatusBadge>
        <StatusBadge variant={priorityMeta.variant}>{priorityMeta.label}</StatusBadge>
        <span className="rounded-full border border-border bg-surface-2 px-sm py-1 text-caption text-text-secondary">
          {resolvedTicket.category_label}
        </span>
        {context?.actions.is_read_only ? (
          <StatusBadge variant="neutral">Salt okunur</StatusBadge>
        ) : null}
      </div>

      {context?.actions.blocked_reason ? (
        <div className="mt-md rounded-app border border-warning/30 bg-warning-bg px-md py-sm text-body text-warning">
          {context.actions.blocked_reason}
        </div>
      ) : null}
    </div>
  );
}

function TicketStatusComposerControls({
  ticket,
  context,
  canEditTickets,
  isUpdating,
  isReturning,
  pendingStatus,
  solutionNote,
  onStatusChange,
  onSolutionNoteChange,
  onCancelSolutionNote,
  onApplySolutionNote,
}: {
  ticket: Ticket;
  context?: TicketContext;
  canEditTickets: boolean;
  isUpdating: boolean;
  isReturning: boolean;
  pendingStatus: TicketStatus | null;
  solutionNote: string;
  onStatusChange: (ticket: Ticket, status: TicketStatus) => void;
  onSolutionNoteChange: (value: string) => void;
  onCancelSolutionNote: () => void;
  onApplySolutionNote: () => void;
}) {
  const canUpdateStatus = Boolean(
    canEditTickets && context?.actions.can_update_status
  );

  const selectedStatus = pendingStatus ?? ticket.status;
  const isResolutionFlow = pendingStatus === "resolved" || pendingStatus === "closed";

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-sm">
      <div className="flex flex-col gap-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
            Ticket durumu
          </p>
          <p className="mt-[2px] text-caption text-text-secondary">
            Durumu buradan güncelle. Çözüldü/Kapandı için not zorunludur.
          </p>
        </div>

        <select
          value={selectedStatus}
          disabled={!canUpdateStatus || isUpdating || isReturning}
          onChange={(event) =>
            onStatusChange(ticket, event.target.value as TicketStatus)
          }
          className="h-10 min-w-[180px] rounded-app border border-border bg-surface-0 px-sm text-caption text-text-primary outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Ticket durumunu değiştir"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {ticket.resolution_note && !isResolutionFlow ? (
        <div className="mt-sm rounded-app border border-success/30 bg-success-bg px-md py-sm text-caption text-success">
          <span className="font-semibold">Çözüm notu:</span>{" "}
          {ticket.resolution_note}
        </div>
      ) : null}

      {isResolutionFlow ? (
        <div className="mt-sm rounded-2xl border border-accent/30 bg-accent-bg p-sm">
          <div className="flex flex-col gap-xs sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-body font-semibold text-text-primary">
                {pendingStatus === "resolved" ? "Çözüm notu" : "Kapanış notu"} zorunlu
              </p>
              <p className="mt-[2px] text-caption text-text-secondary">
                Bu not requester tarafında public mesaj olarak da görünür.
              </p>
            </div>
          </div>

          <textarea
            value={solutionNote}
            onChange={(event) => onSolutionNoteChange(event.target.value)}
            className="mt-sm min-h-[82px] w-full rounded-app border border-border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-secondary focus:border-accent"
            placeholder="Örn: VPN profili yenilendi ve kullanıcı tekrar giriş yapabildi."
          />

          <div className="mt-sm flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancelSolutionNote}
              disabled={isUpdating || isReturning}
              className="rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              Vazgeç
            </button>

            <button
              type="button"
              onClick={onApplySolutionNote}
              disabled={!solutionNote.trim() || isUpdating || isReturning}
              className="rounded-app bg-accent px-md py-sm text-body font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating ? "Kaydediliyor" : "Kaydet ve uygula"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContextCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface-1 p-sm shadow-panel">
      <div className="flex items-center gap-xs">
        <span className="text-text-secondary">{icon}</span>
        <h3 className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
          {title}
        </h3>
      </div>
      <div className="mt-sm">{children}</div>
    </section>
  );
}

function ContextSidePanel({
  context,
  isLoading,
}: {
  context?: TicketContext;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <aside className="flex min-w-0 flex-col gap-sm">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </aside>
    );
  }

  if (!context) {
    return (
      <aside className="rounded-2xl border border-border bg-surface-1 p-md text-caption text-text-secondary shadow-panel">
        Ticket seçildiğinde bağlam bilgileri burada görünecek.
      </aside>
    );
  }

  return (
    <aside className="flex min-w-0 flex-col gap-sm">
      <ContextCard title="Requester" icon={<IconUser size={15} aria-hidden={true} />}>
        <div className="space-y-1 text-caption">
          <p className="font-semibold text-text-primary">
            {context.requester.full_name}
          </p>
          <p className="truncate text-text-secondary">{context.requester.email ?? "-"}</p>
          <p className="text-text-secondary">
            {context.requester.department?.name ?? "Departman yok"}
          </p>
          <p className="text-text-secondary">
            Yönetici: {context.requester.manager?.full_name ?? "-"}
          </p>
        </div>
      </ContextCard>

      <ContextCard
        title="Asset"
        icon={<IconDeviceLaptop size={15} aria-hidden={true} />}
      >
        {context.asset ? (
          <div className="space-y-1 text-caption">
            <p className="font-semibold text-text-primary">{context.asset.name}</p>
            <p className="truncate text-text-secondary">
              {context.asset.display_identifier ??
                context.asset.inventory_code ??
                context.asset.serial_number ??
                "-"}
            </p>
            <p className="text-text-secondary">
              {context.asset.category ?? "Kategori yok"} ·{" "}
              {context.asset.status_label ?? "-"}
            </p>
            <p className="text-text-secondary">
              Garanti: {formatDate(context.asset.warranty_end_date)}
            </p>
          </div>
        ) : (
          <p className="text-caption text-text-secondary">Cihaz seçilmedi.</p>
        )}
      </ContextCard>

      <ContextCard
        title="Aktif zimmet"
        icon={<IconClipboardList size={15} aria-hidden={true} />}
      >
        {context.active_assignments.length === 0 ? (
          <p className="text-caption text-text-secondary">Aktif zimmet yok.</p>
        ) : (
          <div className="space-y-xs">
            {context.active_assignments.slice(0, 3).map((assignment) => (
              <div
                key={assignment.id}
                className="rounded-app border border-border bg-surface-2 p-xs"
              >
                <p className="truncate text-caption font-semibold text-text-primary">
                  {assignment.asset.name}
                </p>
                <p className="truncate text-caption text-text-secondary">
                  {assignment.asset.display_identifier ??
                    assignment.asset.inventory_code ??
                    assignment.asset.serial_number ??
                    "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </ContextCard>

      <ContextCard title="Onay" icon={<IconAlertTriangle size={15} aria-hidden={true} />}>
        <div className="space-y-1 text-caption text-text-secondary">
          <p>
            Durum:{" "}
            <span className="font-semibold text-text-primary">
              {context.approval.status_label}
            </span>
          </p>
          {context.approval.pending ? (
            <p>Bekleyen: {context.approval.pending.approver.full_name}</p>
          ) : null}
          <p>Geçmiş: {context.approval.history.length}</p>
        </div>
      </ContextCard>

      <ContextCard title="Son ticketlar" icon={<IconClock size={15} aria-hidden={true} />}>
        {context.requester_recent_tickets.length === 0 ? (
          <p className="text-caption text-text-secondary">Yakın geçmiş yok.</p>
        ) : (
          <div className="space-y-xs">
            {context.requester_recent_tickets.slice(0, 3).map((ticket) => (
              <div
                key={ticket.id}
                className="rounded-app border border-border bg-surface-2 p-xs"
              >
                <p className="truncate text-caption font-semibold text-text-primary">
                  #{ticket.id} {ticket.title}
                </p>
                <p className="text-caption text-text-secondary">
                  {ticket.status_label} · {formatDate(ticket.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </ContextCard>

      <div className="grid grid-cols-4 gap-xs rounded-2xl border border-border bg-surface-1 p-sm text-center shadow-panel">
        <div>
          <p className="text-body font-semibold text-text-primary">
            {context.comments_summary.total}
          </p>
          <p className="text-[10px] text-text-secondary">Mesaj</p>
        </div>
        <div>
          <p className="text-body font-semibold text-text-primary">
            {context.comments_summary.internal}
          </p>
          <p className="text-[10px] text-text-secondary">İç</p>
        </div>
        <div>
          <p className="text-body font-semibold text-text-primary">
            {context.attachments_summary.total}
          </p>
          <p className="text-[10px] text-text-secondary">Dosya</p>
        </div>
        <div>
          <p className="text-body font-semibold text-text-primary">
            {context.requester_recent_tickets.length}
          </p>
          <p className="text-[10px] text-text-secondary">Son</p>
        </div>
      </div>
    </aside>
  );
}

function ContextDrawer({
  open,
  context,
  isLoading,
  onClose,
}: {
  open: boolean;
  context?: TicketContext;
  isLoading: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-md backdrop-blur-sm 2xl:hidden">
      <div className="ml-auto flex h-full w-full max-w-sm flex-col rounded-panel border border-border bg-surface-0 shadow-panel">
        <div className="flex items-center justify-between border-b border-border p-md">
          <h2 className="text-h3 text-text-primary">Context</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border p-xs text-text-secondary transition hover:border-accent hover:text-accent"
            aria-label="Context panelini kapat"
          >
            <IconX size={18} aria-hidden={true} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-md">
          <ContextSidePanel context={context} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

function ReturnToRequesterDialog({
  open,
  ticket,
  comment,
  isSubmitting,
  onCommentChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  ticket: Ticket | null;
  comment: string;
  isSubmitting: boolean;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !ticket) {
    return null;
  }

  const canSubmit = comment.trim().length > 0 && !isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-md backdrop-blur-sm">
      <form
        className="w-full max-w-lg rounded-panel border border-border bg-surface-0 p-lg shadow-panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            onConfirm();
          }
        }}
      >
        <div className="flex items-start gap-md">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning-bg text-warning">
            <IconAlertTriangle size={22} aria-hidden={true} />
          </div>

          <div className="min-w-0">
            <p className="text-caption font-semibold uppercase tracking-wide text-warning">
              Requester’a geri çevir
            </p>
            <h2 className="mt-xs text-h3 text-text-primary">
              #{ticket.id} {ticket.title}
            </h2>
            <p className="mt-sm text-body text-text-secondary">
              Bu ticket IT kuyruğundan çıkar ve requester düzenleyip tekrar gönderebilir.
              Gerekçe requester tarafında görünür.
            </p>
          </div>
        </div>

        <label
          htmlFor="return-to-requester-comment"
          className="mt-lg block text-caption font-semibold text-text-secondary"
        >
          Geri çevirme gerekçesi
        </label>

        <textarea
          id="return-to-requester-comment"
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          autoFocus
          className="mt-xs min-h-[120px] w-full rounded-app border border-border bg-surface-1 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-secondary focus:border-accent"
          placeholder="Örn: Talepte eksik bilgi var. Lütfen cihaz adını ve hata ekran görüntüsünü ekleyerek tekrar gönder."
        />

        <div className="mt-md rounded-app border border-warning/30 bg-warning-bg px-md py-sm text-caption text-warning">
          Gerekçe zorunludur. Boş açıklama ile geri çevirme yapılamaz.
        </div>

        <div className="mt-lg flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-app border border-border px-md py-sm text-body text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            Vazgeç
          </button>

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-xs rounded-app bg-warning px-md py-sm text-body font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconAlertTriangle size={16} aria-hidden={true} />
            {isSubmitting ? "Geri çevriliyor..." : "Geri Çevir"}
          </button>
        </div>
      </form>
    </div>
  );
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
    pageSize: 15,
    ordering: "-created_at",
  });

  const resolvedTicketsState = useMemo<TableQueryState>(
    () => ({
      page: 1,
      pageSize: 5,
      ordering: "-updated_at",
      search: "",
      filters: {
        status: "resolved",
      },
    }),
    []
  );

  const ticketsQuery = useTicketsTable(state);
  const resolvedTicketsQuery = useTicketsTable(resolvedTicketsState);
  const summaryQuery = useTicketSummary();
  const updateStatusMutation = useUpdateTicketStatus();
  const returnTicketMutation = useReturnTicketToRequester();

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);
  const [solutionNote, setSolutionNote] = useState("");
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedTicketId = selectedTicket?.id ?? null;
  const ticketContextQuery = useTicketContext(selectedTicketId, Boolean(selectedTicketId));

  const tableData = ticketsQuery.data;
  const tickets = tableData?.results ?? [];
  const resolvedTickets = resolvedTicketsQuery.data?.results ?? [];
  const summary = summaryQuery.data;
  const context = ticketContextQuery.data;
  const resolvedTicket = context?.ticket ?? selectedTicket;

  const selectedStatus =
    typeof state.filters.status === "string" ? state.filters.status : "";
  const selectedPriority =
    typeof state.filters.priority === "string" ? state.filters.priority : "";

  const ordering = useMemo(
    () => (typeof state.ordering === "string" ? state.ordering : "-created_at"),
    [state.ordering]
  );

  async function refetchAll() {
    await Promise.all([
      ticketsQuery.refetch(),
      resolvedTicketsQuery.refetch(),
      summaryQuery.refetch(),
      selectedTicketId ? ticketContextQuery.refetch() : Promise.resolve(),
    ]);
  }

  function handleSelectTicket(ticket: Ticket) {
    setSelectedTicket(ticket);
    setPendingStatus(null);
    setSolutionNote("");
    setReturnDialogOpen(false);
    setReturnComment("");
    setError(null);
  }

  async function performStatusUpdate(
    ticket: Ticket,
    nextStatus: TicketStatus,
    note?: string
  ) {
    setError(null);

    try {
      const updated = await updateStatusMutation.mutateAsync({
        ticketId: ticket.id,
        status: nextStatus,
        solution_note: note,
      });

      setSelectedTicket(updated);
      setPendingStatus(null);
      setSolutionNote("");
      await refetchAll();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    }
  }

  function handleStatusChange(ticket: Ticket, nextStatus: TicketStatus) {
    if (ticket.status === nextStatus) {
      setPendingStatus(null);
      setSolutionNote("");
      return;
    }

    if (nextStatus === "resolved" || nextStatus === "closed") {
      setPendingStatus(nextStatus);
      setSolutionNote("");
      return;
    }

    void performStatusUpdate(ticket, nextStatus);
  }

  function handleApplySolutionNote() {
    if (!resolvedTicket || !pendingStatus || !solutionNote.trim()) {
      return;
    }

    void performStatusUpdate(resolvedTicket, pendingStatus, solutionNote.trim());
  }

  function handleOpenReturnDialog() {
    if (!resolvedTicket || !context?.actions.can_return_to_requester) {
      return;
    }

    setPendingStatus(null);
    setSolutionNote("");
    setReturnComment("");
    setError(null);
    setReturnDialogOpen(true);
  }

  function handleCloseReturnDialog() {
    if (returnTicketMutation.isPending) {
      return;
    }

    setReturnDialogOpen(false);
    setReturnComment("");
  }

  async function handleConfirmReturnToRequester() {
    const comment = returnComment.trim();

    if (!resolvedTicket || !comment) {
      return;
    }

    setError(null);

    try {
      await returnTicketMutation.mutateAsync({
        ticketId: resolvedTicket.id,
        payload: {
          comment,
        },
      });

      await refetchAll();

      setReturnDialogOpen(false);
      setReturnComment("");
      setSelectedTicket(null);
      setPendingStatus(null);
      setSolutionNote("");
      setContextDrawerOpen(false);
    } catch (returnError) {
      setError(getErrorMessage(returnError));
    }
  }

  function handleCloseSelectedTicket() {
    setSelectedTicket(null);
    setPendingStatus(null);
    setSolutionNote("");
    setReturnDialogOpen(false);
    setReturnComment("");
    setContextDrawerOpen(false);
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
          title="Ticket Inbox"
          description="Ticket listesinden seç, merkezi chat alanında yanıtla; sağ panelden requester, asset ve onay bağlamını hızlıca gör."
          actions={
            <GlowButton
              variant="ghost"
              onClick={refetchAll}
              disabled={
                ticketsQuery.isFetching ||
                summaryQuery.isFetching ||
                updateStatusMutation.isPending ||
                returnTicketMutation.isPending
              }
              icon={<IconRefresh size={16} aria-hidden={true} />}
            >
              {ticketsQuery.isFetching || summaryQuery.isFetching
                ? "Yenileniyor"
                : "Veriyi yenile"}
            </GlowButton>
          }
        />

        <section className="mt-lg grid gap-sm sm:grid-cols-2 xl:grid-cols-5">
          <MiniMetricCard
            label="Gösterilen ticket"
            value={tableData?.count ?? tickets.length}
            icon={<IconClipboardList size={15} aria-hidden={true} />}
            tone="accent"
            className="w-full"
          />

          <MiniMetricCard
            label="Açık"
            value={summary?.open ?? 0}
            icon={<IconClipboardList size={15} aria-hidden={true} />}
            tone="accent"
            className="w-full"
          />

          <MiniMetricCard
            label="İşlemde"
            value={summary?.in_progress ?? 0}
            icon={<IconTool size={15} aria-hidden={true} />}
            tone="warning"
            className="w-full"
          />

          <MiniMetricCard
            label="Acil"
            value={summary?.urgent ?? 0}
            icon={<IconAlertTriangle size={15} aria-hidden={true} />}
            tone="danger"
            className="w-full"
          />

          <MiniMetricCard
            label="Yüksek/Acil"
            value={summary?.high_or_urgent ?? 0}
            icon={<IconAlertTriangle size={15} aria-hidden={true} />}
            tone="warning"
            className="w-full"
          />
        </section>

        {error ? (
          <div className="mt-lg rounded-app border border-danger/30 bg-danger-bg px-md py-sm text-body text-danger">
            {error}
          </div>
        ) : null}

        <section className="mt-lg rounded-panel border border-border bg-surface-1 p-md shadow-panel">
          <div className="grid gap-md xl:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <label className="flex h-11 min-w-0 items-center gap-sm rounded-app border border-border bg-surface-2 px-md shadow-panel">
              <IconSearch
                size={18}
                className="shrink-0 text-text-secondary"
                aria-hidden={true}
              />

              <input
                className="min-w-0 flex-1 bg-transparent text-body text-text-primary placeholder:text-text-secondary focus:outline-none"
                placeholder="Başlık, açıklama, requester veya varlık ara..."
                value={state.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="h-11 rounded-app border border-border bg-surface-2 px-md text-body text-text-primary shadow-panel focus:outline-none"
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
              className="h-11 rounded-app border border-border bg-surface-2 px-md text-body text-text-primary shadow-panel focus:outline-none"
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
              className="h-11 rounded-app border border-border px-md text-body text-text-primary transition hover:border-accent hover:text-accent"
            >
              Temizle
            </button>
          </div>
        </section>

        <section className="mt-lg grid min-h-[calc(100vh-310px)] gap-lg xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_260px]">
          <div className="min-h-0">
            <TicketInboxList
              tickets={tickets}
              selectedTicketId={selectedTicketId}
              ordering={ordering}
              isFetching={ticketsQuery.isFetching}
              onSelectTicket={handleSelectTicket}
              onSortChange={setSort}
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

            <ResolvedTicketsList
              tickets={resolvedTickets}
              selectedTicketId={selectedTicketId}
              isLoading={resolvedTicketsQuery.isLoading}
              isFetching={resolvedTicketsQuery.isFetching}
              isError={resolvedTicketsQuery.isError}
              onSelectTicket={handleSelectTicket}
            />
          </div>

          <div className="min-h-0">
            {resolvedTicket ? (
              <TicketChatPanel
                ticket={resolvedTicket}
                open={Boolean(resolvedTicket)}
                allowInternalNotes={Boolean(context?.actions.can_add_internal_note)}
                defaultMode="public_reply"
                onClose={handleCloseSelectedTicket}
                onCommentCreated={refetchAll}
                variant="workspace"
                descriptionAsFirstMessage
                className="h-full"
                headerSlot={
                  <WorkspaceChatHeader
                    ticket={resolvedTicket}
                    context={context}
                    canEditTickets={canEditTickets}
                    isUpdating={updateStatusMutation.isPending}
                    isReturning={returnTicketMutation.isPending}
                    onClose={handleCloseSelectedTicket}
                    onRefresh={refetchAll}
                    onOpenContext={() => setContextDrawerOpen(true)}
                    onOpenReturnDialog={handleOpenReturnDialog}
                  />
                }
                composerTopSlot={
                  <TicketStatusComposerControls
                    ticket={resolvedTicket}
                    context={context}
                    canEditTickets={canEditTickets}
                    isUpdating={updateStatusMutation.isPending}
                    isReturning={returnTicketMutation.isPending}
                    pendingStatus={pendingStatus}
                    solutionNote={solutionNote}
                    onStatusChange={handleStatusChange}
                    onSolutionNoteChange={setSolutionNote}
                    onCancelSolutionNote={() => {
                      setPendingStatus(null);
                      setSolutionNote("");
                    }}
                    onApplySolutionNote={handleApplySolutionNote}
                  />
                }
              />
            ) : (
              <EmptyChatState />
            )}
          </div>

          <div className="hidden min-h-0 overflow-y-auto 2xl:block">
            <ContextSidePanel
              context={context}
              isLoading={ticketContextQuery.isLoading}
            />
          </div>
        </section>

        <ContextDrawer
          open={contextDrawerOpen}
          context={context}
          isLoading={ticketContextQuery.isLoading}
          onClose={() => setContextDrawerOpen(false)}
        />

        <ReturnToRequesterDialog
          open={returnDialogOpen}
          ticket={resolvedTicket}
          comment={returnComment}
          isSubmitting={returnTicketMutation.isPending}
          onCommentChange={setReturnComment}
          onClose={handleCloseReturnDialog}
          onConfirm={handleConfirmReturnToRequester}
        />
      </PageTransition>
    </AppShell>
  );
}