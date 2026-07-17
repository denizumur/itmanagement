import { IconMessageCircle, IconRefresh, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createTicketComment } from "../../api/tickets";
import { useAuth } from "../../auth/AuthContext";
import { useTicketComments, ticketCommentsQueryKey } from "../../hooks/useTickets";
import { cn } from "../../lib/cn";
import {
  getTicketApprovalMeta,
  getTicketPriorityMeta,
  getTicketStatusMeta,
} from "../../lib/ticketLabels";
import type {
  Ticket,
  TicketComment,
  TicketCommentCreatePayload,
} from "../../types/tickets";
import { StatusBadge } from "../ui/StatusBadge";

export type TicketChatMode = "public_reply" | "internal_note";

type TicketChatPanelProps = {
  ticket: Ticket | null;
  open: boolean;
  allowInternalNotes?: boolean;
  defaultMode?: TicketChatMode;
  onClose: () => void;
  onCommentCreated?: () => void;
  variant?: "panel" | "workspace";
  headerSlot?: ReactNode;
  descriptionAsFirstMessage?: boolean;
  className?: string;
};

type OptimisticContext = {
  previousComments?: TicketComment[];
  optimisticId: number;
  body: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getUserDisplayName(user: unknown) {
  if (!user || typeof user !== "object") {
    return "Sen";
  }

  const record = user as {
    name?: unknown;
    full_name?: unknown;
    username?: unknown;
    email?: unknown;
  };

  if (typeof record.name === "string" && record.name.trim()) {
    return record.name;
  }

  if (typeof record.full_name === "string" && record.full_name.trim()) {
    return record.full_name;
  }

  if (typeof record.username === "string" && record.username.trim()) {
    return record.username;
  }

  if (typeof record.email === "string" && record.email.trim()) {
    return record.email;
  }

  return "Sen";
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return "Mesaj gönderilemedi. Lütfen tekrar dene.";
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
    return "Mesaj gönderilemedi. Lütfen tekrar dene.";
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
      const [field, value] = firstEntry;

      if (Array.isArray(value)) {
        return `${field}: ${value.join(", ")}`;
      }

      if (typeof value === "string") {
        return `${field}: ${value}`;
      }
    }
  }

  return "Mesaj gönderilemedi. Lütfen tekrar dene.";
}

function normalizeChatMode({
  requestedMode,
  allowInternalNotes,
}: {
  requestedMode: TicketChatMode;
  allowInternalNotes: boolean;
}): TicketChatMode {
  if (!allowInternalNotes) {
    return "public_reply";
  }

  return requestedMode;
}

export function TicketChatPanel({
  ticket,
  open,
  allowInternalNotes = false,
  defaultMode = "public_reply",
  onClose,
  onCommentCreated,
  variant = "panel",
  headerSlot,
  descriptionAsFirstMessage = false,
  className,
}: TicketChatPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const ticketId = ticket?.id ?? null;
  const commentsQuery = useTicketComments(ticketId, open);

  const [body, setBody] = useState("");
  const [mode, setMode] = useState<TicketChatMode>(() =>
    normalizeChatMode({
      requestedMode: defaultMode,
      allowInternalNotes,
    })
  );
  const [error, setError] = useState<string | null>(null);

  const comments = commentsQuery.data ?? [];
  const isInternalMode = mode === "internal_note";

  const sortedComments = useMemo(
    () =>
      [...comments].sort(
        (first, second) =>
          new Date(first.created_at).getTime() -
          new Date(second.created_at).getTime()
      ),
    [comments]
  );

  useEffect(() => {
    setMode(
      normalizeChatMode({
        requestedMode: defaultMode,
        allowInternalNotes,
      })
    );
  }, [defaultMode, allowInternalNotes, ticketId]);

  useEffect(() => {
    if (!open) {
      setBody("");
      setError(null);
      setMode("public_reply");
    }
  }, [open]);

  const createCommentMutation = useMutation<
    TicketComment,
    unknown,
    TicketCommentCreatePayload,
    OptimisticContext
  >({
    mutationFn: async (payload) => {
      if (!ticketId) {
        throw new Error("Talep seçili değil.");
      }

      return createTicketComment(ticketId, payload);
    },
    onMutate: async (payload) => {
      if (!ticketId) {
        throw new Error("Talep seçili değil.");
      }

      const queryKey = ticketCommentsQueryKey(ticketId);
      const optimisticId = -Date.now();

      await queryClient.cancelQueries({ queryKey });

      const previousComments = queryClient.getQueryData<TicketComment[]>(queryKey);

      const optimisticComment: TicketComment = {
        id: optimisticId,
        ticket: ticketId,
        author: null,
        author_name: getUserDisplayName(user),
        body: payload.body,
        is_internal: Boolean(payload.is_internal),
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<TicketComment[]>(queryKey, (current = []) => [
        ...current,
        optimisticComment,
      ]);

      return {
        previousComments,
        optimisticId,
        body: payload.body,
      };
    },
    onError: (mutationError, _variables, context) => {
      if (ticketId) {
        queryClient.setQueryData(
          ticketCommentsQueryKey(ticketId),
          context?.previousComments ?? []
        );
      }

      if (context?.body) {
        setBody(context.body);
      }

      setError(getErrorMessage(mutationError));
    },
    onSuccess: (createdComment, _variables, context) => {
      if (!ticketId || !context) {
        return;
      }

      queryClient.setQueryData<TicketComment[]>(
        ticketCommentsQueryKey(ticketId),
        (current = []) =>
          current.map((comment) =>
            comment.id === context.optimisticId ? createdComment : comment
          )
      );

      setMode("public_reply");
      onCommentCreated?.();
    },
    onSettled: async () => {
      if (!ticketId) {
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: ticketCommentsQueryKey(ticketId),
      });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedBody = body.trim();

    if (!ticketId || !trimmedBody || createCommentMutation.isPending) {
      return;
    }

    const payload: TicketCommentCreatePayload = {
      body: trimmedBody,
      is_internal: allowInternalNotes && mode === "internal_note",
    };

    setError(null);
    setBody("");
    createCommentMutation.mutate(payload);
  }

  if (!open || !ticket) {
    return (
      <aside
        className={cn(
          "rounded-panel border border-border bg-surface-1 p-lg shadow-panel",
          variant === "workspace" && "flex h-full min-h-[520px] flex-col",
          className
        )}
      >
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-secondary">
            <IconMessageCircle size={22} aria-hidden={true} />
          </div>
          <h2 className="mt-md text-h3 text-text-primary">Mesajlar</h2>
          <p className="mt-sm max-w-sm text-body text-text-secondary">
            Görüntülemek için bir ticket seçin.
          </p>
        </div>
      </aside>
    );
  }

  const statusMeta = getTicketStatusMeta(ticket.status);
  const priorityMeta = getTicketPriorityMeta(ticket.priority);
  const approvalMeta = getTicketApprovalMeta(ticket.approval_status);

  return (
    <aside
      className={cn(
        "rounded-panel border border-border bg-surface-1 shadow-panel",
        variant === "workspace"
          ? "flex h-full min-h-0 flex-col overflow-hidden"
          : "p-lg",
        className
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-col",
          variant === "workspace" ? "h-full" : "min-h-[640px]"
        )}
      >
        {headerSlot ? (
          headerSlot
        ) : (
          <div className="flex items-start justify-between gap-md border-b border-border pb-md">
            <div>
              <p className="text-caption text-text-secondary">Talep Mesajları</p>
              <h2 className="mt-xs text-h3 text-text-primary">
                #{ticket.id} {ticket.title}
              </h2>
              <p className="mt-xs text-caption text-text-secondary">
                {ticket.employee_name} · {formatDateTime(ticket.created_at)}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border p-xs text-text-secondary transition hover:border-accent hover:text-accent"
              aria-label="Mesaj panelini kapat"
            >
              <IconX size={18} aria-hidden={true} />
            </button>
          </div>
        )}

        {!headerSlot && !descriptionAsFirstMessage ? (
          <div className="mt-md rounded-2xl bg-surface-2 p-md">
            <div className="flex flex-wrap gap-sm">
              <StatusBadge variant={statusMeta.variant}>{statusMeta.label}</StatusBadge>
              <StatusBadge variant={priorityMeta.variant}>
                {priorityMeta.requesterLabel}
              </StatusBadge>
              <StatusBadge variant={approvalMeta.variant}>
                {approvalMeta.requesterLabel}
              </StatusBadge>
            </div>

            <p className="mt-md line-clamp-4 text-body text-text-secondary">
              {ticket.description}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-md border-b border-border px-md py-sm">
          <p className="text-caption text-text-secondary">
            Panel açıkken mesajlar 5 saniyede bir yenilenir.
          </p>

          <button
            type="button"
            onClick={() => commentsQuery.refetch()}
            disabled={commentsQuery.isFetching}
            className="inline-flex items-center gap-xs rounded-app border border-border px-sm py-xs text-caption text-text-secondary transition hover:border-accent hover:text-accent disabled:opacity-60"
          >
            <IconRefresh size={14} aria-hidden={true} />
            {commentsQuery.isFetching ? "Yenileniyor" : "Yenile"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-0 p-md">
          {commentsQuery.isLoading ? (
            <p className="text-body text-text-secondary">Mesajlar yükleniyor...</p>
          ) : (
            <div className="space-y-sm">
              {descriptionAsFirstMessage ? (
                <div className="rounded-2xl border border-border bg-surface-1 p-md">
                  <div className="flex items-center justify-between gap-md">
                    <div>
                      <p className="text-body font-semibold text-text-primary">
                        {ticket.employee_name}
                      </p>
                      <p className="text-caption text-text-secondary">
                        {formatDateTime(ticket.created_at)}
                      </p>
                    </div>
                    <StatusBadge variant="neutral">İlk talep</StatusBadge>
                  </div>

                  <p className="mt-sm whitespace-pre-wrap text-body text-text-secondary">
                    {ticket.description}
                  </p>
                </div>
              ) : null}

              {sortedComments.length === 0 && !descriptionAsFirstMessage ? (
                <p className="text-body text-text-secondary">
                  Henüz mesaj yok. İlk mesajı buradan yazabilirsin.
                </p>
              ) : null}

              {sortedComments.map((comment) => (
                <div
                  key={comment.id}
                  className={cn(
                    "rounded-2xl border p-md",
                    comment.id < 0 && "border-accent/40 bg-accent/10",
                    comment.id >= 0 &&
                      comment.is_internal &&
                      "border-warning/40 bg-warning-bg",
                    comment.id >= 0 &&
                      !comment.is_internal &&
                      "border-border bg-surface-1"
                  )}
                >
                  <div className="flex items-center justify-between gap-md">
                    <div>
                      <p className="text-body font-semibold text-text-primary">
                        {comment.author_name ?? "Sistem"}
                      </p>
                      <p className="text-caption text-text-secondary">
                        {formatDateTime(comment.created_at)}
                      </p>
                    </div>

                    {comment.is_internal ? (
                      <StatusBadge variant="warning">Dahili IT notu</StatusBadge>
                    ) : (
                      <StatusBadge variant="accent">Talep edene yanıt</StatusBadge>
                    )}
                  </div>

                  <p className="mt-sm whitespace-pre-wrap text-body text-text-secondary">
                    {comment.body}
                  </p>

                  {comment.id < 0 ? (
                    <p className="mt-xs text-caption text-text-secondary">
                      Gönderiliyor...
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <div className="mx-md mt-md rounded-app border border-danger/30 bg-danger-bg px-md py-sm text-body text-danger">
            {error}
          </div>
        ) : null}

        <form
          className={cn(
            "sticky bottom-0 border-t p-md",
            isInternalMode
              ? "border-warning/40 bg-warning-bg"
              : "border-border bg-surface-1"
          )}
          onSubmit={handleSubmit}
        >
          {allowInternalNotes ? (
            <div className="mb-sm grid grid-cols-2 gap-xs rounded-app border border-border bg-surface-2 p-xs">
              <button
                type="button"
                onClick={() => setMode("public_reply")}
                className={cn(
                  "rounded-app px-sm py-xs text-caption transition",
                  mode === "public_reply"
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                Talep edene yanıt
              </button>

              <button
                type="button"
                onClick={() => setMode("internal_note")}
                className={cn(
                  "rounded-app px-sm py-xs text-caption transition",
                  mode === "internal_note"
                    ? "bg-warning text-white"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                Dahili IT notu
              </button>
            </div>
          ) : null}

          {isInternalMode ? (
            <div className="mb-sm rounded-app border border-warning/40 bg-surface-1 px-md py-sm text-caption text-warning">
              Bu not sadece Admin/Technician kullanıcıları tarafından görülür.
              Talep sahibi bu mesajı görmez.
            </div>
          ) : (
            <div className="mb-sm rounded-app border border-accent/30 bg-accent-bg px-md py-sm text-caption text-accent">
              Bu mesaj talep sahibine görünür.
            </div>
          )}

          <label className="text-caption text-text-secondary">
            {isInternalMode ? "Dahili IT notu" : "Talep edene yanıt"}
          </label>

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={cn(
              "mt-xs min-h-[96px] w-full rounded-app border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-secondary focus:border-accent",
              isInternalMode ? "border-warning/50" : "border-border"
            )}
            placeholder={
              isInternalMode
                ? "Sadece IT ekibinin göreceği dahili not yaz. Örn: Loglar kontrol edildi, kullanıcıya henüz bilgi verilmedi."
                : "Talep sahibine görünecek yanıtı yaz. Örn: Kontrol ettik, VPN profilinizi yeniledik."
            }
          />

          <button
            type="submit"
            disabled={!body.trim() || createCommentMutation.isPending}
            className={cn(
              "mt-sm w-full rounded-app px-md py-sm text-body font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
              isInternalMode ? "bg-warning" : "bg-accent"
            )}
          >
            {createCommentMutation.isPending
              ? "Gönderiliyor..."
              : isInternalMode
                ? "Dahili notu kaydet"
                : "Yanıtı gönder"}
          </button>
        </form>
      </div>
    </aside>
  );
}