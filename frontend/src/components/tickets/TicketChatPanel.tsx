import { IconMessageCircle, IconRefresh, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createTicketComment } from "../../api/tickets";
import { useAuth } from "../../auth/AuthContext";
import { useTicketComments, ticketCommentsQueryKey } from "../../hooks/useTickets";
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

type TicketChatPanelProps = {
  ticket: Ticket | null;
  open: boolean;
  canUseInternalNotes: boolean;
  onClose: () => void;
  onCommentCreated?: () => void;
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

export function TicketChatPanel({
  ticket,
  open,
  canUseInternalNotes,
  onClose,
  onCommentCreated,
}: TicketChatPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const ticketId = ticket?.id ?? null;
  const commentsQuery = useTicketComments(ticketId, open);

  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comments = commentsQuery.data ?? [];

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
    if (!canUseInternalNotes) {
      setIsInternal(false);
    }
  }, [canUseInternalNotes]);

  useEffect(() => {
    if (!open) {
      setBody("");
      setError(null);
      setIsInternal(false);
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
      if (!ticketId) {
        return;
      }

      queryClient.setQueryData<TicketComment[]>(
        ticketCommentsQueryKey(ticketId),
        (current = []) =>
          current.map((comment) =>
            comment.id === context.optimisticId ? createdComment : comment
          )
      );

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
      is_internal: canUseInternalNotes ? isInternal : false,
    };

    setError(null);
    setBody("");
    createCommentMutation.mutate(payload);
  }

  if (!open || !ticket) {
    return (
      <aside className="rounded-panel border border-border bg-surface-1 p-lg shadow-panel">
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-secondary">
            <IconMessageCircle size={22} aria-hidden={true} />
          </div>
          <h2 className="mt-md text-h3 text-text-primary">Mesajlar</h2>
          <p className="mt-sm max-w-sm text-body text-text-secondary">
            Talep detayını ve yazışmaları görmek için listeden bir talep seç.
          </p>
        </div>
      </aside>
    );
  }

  const statusMeta = getTicketStatusMeta(ticket.status);
  const priorityMeta = getTicketPriorityMeta(ticket.priority);
  const approvalMeta = getTicketApprovalMeta(ticket.approval_status);

  return (
    <aside className="rounded-panel border border-border bg-surface-1 p-lg shadow-panel">
      <div className="flex min-h-[640px] flex-col">
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

        <div className="mt-md flex items-center justify-between gap-md">
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

        <div className="mt-md min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-surface-0 p-md">
          {commentsQuery.isLoading ? (
            <p className="text-body text-text-secondary">Mesajlar yükleniyor...</p>
          ) : sortedComments.length === 0 ? (
            <p className="text-body text-text-secondary">
              Henüz mesaj yok. İlk mesajı buradan yazabilirsin.
            </p>
          ) : (
            <div className="space-y-sm">
              {sortedComments.map((comment) => (
                <div
                  key={comment.id}
                  className={`rounded-2xl border p-md ${
                    comment.id < 0
                      ? "border-accent/40 bg-accent/10"
                      : comment.is_internal
                        ? "border-warning/40 bg-warning-bg"
                        : "border-border bg-surface-1"
                  }`}
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
                      <StatusBadge variant="warning">İç not</StatusBadge>
                    ) : null}
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
          <div className="mt-md rounded-app border border-danger/30 bg-danger-bg px-md py-sm text-body text-danger">
            {error}
          </div>
        ) : null}

        <form className="mt-md space-y-md" onSubmit={handleSubmit}>
          <div>
            <label className="text-caption text-text-secondary">Mesaj</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="mt-xs min-h-[110px] w-full rounded-app border border-border bg-surface-0 px-md py-sm text-body text-text-primary outline-none transition placeholder:text-text-secondary focus:border-accent"
              placeholder="Talebin hakkında mesaj yaz..."
            />
          </div>

          {canUseInternalNotes ? (
            <label className="flex items-center gap-sm text-body text-text-secondary">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(event) => setIsInternal(event.target.checked)}
              />
              IT iç notu olarak ekle
            </label>
          ) : null}

          <button
            type="submit"
            disabled={!body.trim() || createCommentMutation.isPending}
            className="w-full rounded-app bg-accent px-md py-sm text-body font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createCommentMutation.isPending ? "Gönderiliyor..." : "Mesaj Gönder"}
          </button>
        </form>
      </div>
    </aside>
  );
}