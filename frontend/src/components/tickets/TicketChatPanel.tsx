import {
  IconLock,
  IconMessageCircle,
  IconRefresh,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { createTicketComment } from "../../api/tickets";
import { useAuth } from "../../auth/AuthContext";
import { ticketCommentsQueryKey, useTicketComments } from "../../hooks/useTickets";
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
  composerTopSlot?: ReactNode;
  descriptionAsFirstMessage?: boolean;
  className?: string;
};

type OptimisticContext = {
  previousComments?: TicketComment[];
  optimisticId: number;
  body: string;
};

type ChatItem = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  isInternal: boolean;
  isOptimistic: boolean;
  isInitial: boolean;
  isOwn: boolean;
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

function getCurrentUserId(user: unknown) {
  if (!user || typeof user !== "object") {
    return null;
  }

  const id = (user as { id?: unknown }).id;

  if (typeof id === "number") {
    return id;
  }

  if (typeof id === "string" && id.trim()) {
    const parsed = Number(id);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function isOwnComment(comment: TicketComment, user: unknown) {
  if (comment.id < 0) {
    return true;
  }

  const currentUserId = getCurrentUserId(user);

  if (currentUserId && comment.author === currentUserId) {
    return true;
  }

  const currentUserName = getUserDisplayName(user);

  return Boolean(
    comment.author_name &&
      currentUserName &&
      comment.author_name.trim() === currentUserName.trim()
  );
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

function buildChatItems({
  ticket,
  comments,
  descriptionAsFirstMessage,
  user,
}: {
  ticket: Ticket | null;
  comments: TicketComment[];
  descriptionAsFirstMessage: boolean;
  user: unknown;
}): ChatItem[] {
  if (!ticket) {
    return [];
  }

  const items: ChatItem[] = [];

  if (descriptionAsFirstMessage) {
    items.push({
      id: `ticket-description-${ticket.id}`,
      authorName: ticket.employee_name,
      body: ticket.description,
      createdAt: ticket.created_at,
      isInternal: false,
      isOptimistic: false,
      isInitial: true,
      isOwn: false,
    });
  }

  comments.forEach((comment) => {
    items.push({
      id: String(comment.id),
      authorName: comment.author_name ?? "Sistem",
      body: comment.body,
      createdAt: comment.created_at,
      isInternal: comment.is_internal,
      isOptimistic: comment.id < 0,
      isInitial: false,
      isOwn: isOwnComment(comment, user),
    });
  });

  return items;
}

function shouldShowMessageMeta(items: ChatItem[], index: number) {
  if (index === 0) {
    return true;
  }

  const current = items[index];
  const previous = items[index - 1];

  return (
    current.authorName !== previous.authorName ||
    current.isInternal !== previous.isInternal ||
    current.isInitial !== previous.isInitial ||
    current.isOwn !== previous.isOwn
  );
}

function ChatBubble({
  item,
  showMeta,
}: {
  item: ChatItem;
  showMeta: boolean;
}) {
  const isPublicOwn = item.isOwn && !item.isInternal;
  const isPublicOther = !item.isOwn && !item.isInternal;

  return (
    <div
      className={cn(
        "flex w-full flex-col",
        item.isOwn ? "items-end" : "items-start"
      )}
    >
      {showMeta ? (
        <div
          className={cn(
            "mb-xs flex max-w-[84%] flex-wrap items-center gap-xs text-[11px] text-text-muted",
            item.isOwn && "justify-end text-right"
          )}
        >
          <span className="font-semibold text-text-secondary">
            {item.authorName}
          </span>
          <span className="text-text-muted">·</span>
          <span>{formatDateTime(item.createdAt)}</span>

          {item.isInitial ? (
            <span className="rounded-full border border-border bg-surface-1 px-xs py-[2px] text-[10px] font-semibold text-text-secondary">
              İlk talep
            </span>
          ) : null}

          {item.isInternal ? (
            <span className="inline-flex items-center gap-[3px] rounded-full border border-warning/30 bg-warning-bg px-xs py-[2px] text-[10px] font-semibold text-warning">
              <IconLock size={10} aria-hidden={true} />
              Dahili not
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "max-w-[84%] rounded-2xl border px-md py-sm shadow-sm",
          isPublicOwn
            ? "rounded-br-md border-accent bg-accent text-white"
            : null,
          isPublicOther
            ? "rounded-bl-md border-border-subtle bg-surface-1 text-text-primary"
            : null,
          item.isInternal
            ? "rounded-br-md border-warning/35 bg-warning-bg text-text-primary"
            : null,
          item.isOptimistic && "opacity-80"
        )}
      >
        <p
          className={cn(
            "whitespace-pre-wrap break-words text-body leading-relaxed",
            isPublicOwn ? "text-white" : "text-text-primary"
          )}
        >
          {item.body}
        </p>

        {item.isOptimistic ? (
          <p
            className={cn(
              "mt-xs text-[11px]",
              isPublicOwn ? "text-white/80" : "text-text-secondary"
            )}
          >
            Gönderiliyor...
          </p>
        ) : null}
      </div>
    </div>
  );
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
  composerTopSlot,
  descriptionAsFirstMessage = false,
  className,
}: TicketChatPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messageListRef = useRef<HTMLDivElement | null>(null);

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

  const chatItems = useMemo(
    () =>
      buildChatItems({
        ticket,
        comments: sortedComments,
        descriptionAsFirstMessage,
        user,
      }),
    [ticket, sortedComments, descriptionAsFirstMessage, user]
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

  useEffect(() => {
    const node = messageListRef.current;

    if (!node || !open) {
      return;
    }

    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth",
    });
  }, [chatItems.length, open, ticketId]);

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

  function submitCurrentMessage() {
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitCurrentMessage();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submitCurrentMessage();
    }
  }

  if (!open || !ticket) {
    return (
      <aside
        className={cn(
          "rounded-panel border border-border bg-surface-1 p-lg shadow-card",
          variant === "workspace" && "flex h-full min-h-[520px] flex-col",
          className
        )}
      >
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-bg text-accent">
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
  const canSubmit = Boolean(body.trim()) && !createCommentMutation.isPending;

  return (
    <aside
      className={cn(
        "rounded-panel border border-border bg-surface-1 shadow-card",
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
          <div className="flex items-start justify-between gap-md border-b border-border-subtle px-md py-md">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                Talep mesajları
              </p>
              <h2 className="mt-xs line-clamp-1 text-h3 font-semibold text-text-primary">
                #{ticket.id} {ticket.title}
              </h2>
              <p className="mt-xs text-caption text-text-secondary">
                {ticket.employee_name} · {formatDateTime(ticket.created_at)}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-1 text-text-secondary shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              aria-label="Mesaj panelini kapat"
            >
              <IconX size={18} aria-hidden={true} />
            </button>
          </div>
        )}

        {!headerSlot && !descriptionAsFirstMessage ? (
          <div className="mx-md mt-md rounded-2xl border border-border-subtle bg-surface-0 p-md">
            <div className="flex flex-wrap gap-sm">
              <StatusBadge variant={statusMeta.variant}>{statusMeta.label}</StatusBadge>
              <StatusBadge variant={priorityMeta.variant}>
                {priorityMeta.requesterLabel}
              </StatusBadge>
              <StatusBadge variant={approvalMeta.variant}>
                {approvalMeta.requesterLabel}
              </StatusBadge>
            </div>

            <p className="mt-md line-clamp-4 text-body leading-relaxed text-text-secondary">
              {ticket.description}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-md border-y border-border-subtle bg-surface-1 px-md py-sm">
          <div className="flex items-center gap-xs text-caption text-text-secondary">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="font-medium">Canlı sohbet</span>
          </div>

          <button
            type="button"
            onClick={() => commentsQuery.refetch()}
            disabled={commentsQuery.isFetching}
            className="inline-flex h-8 items-center gap-xs rounded-xl border border-border bg-surface-1 px-sm text-caption font-medium text-text-secondary transition hover:border-accent hover:bg-accent-bg hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconRefresh
              size={14}
              aria-hidden={true}
              className={commentsQuery.isFetching ? "animate-spin" : undefined}
            />
            {commentsQuery.isFetching ? "Yenileniyor" : "Yenile"}
          </button>
        </div>

        <div
          ref={messageListRef}
          className="min-h-0 flex-1 overflow-y-auto bg-surface-0 px-md py-lg"
        >
          {commentsQuery.isLoading ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-bg text-accent">
                <IconRefresh size={18} className="animate-spin" aria-hidden={true} />
              </div>
              <p className="mt-sm text-body font-medium text-text-primary">
                Mesajlar yükleniyor
              </p>
              <p className="mt-xs text-caption text-text-secondary">
                Sohbet geçmişi hazırlanıyor...
              </p>
            </div>
          ) : chatItems.length === 0 ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-bg text-accent">
                <IconMessageCircle size={20} aria-hidden={true} />
              </div>
              <p className="mt-sm max-w-sm text-body text-text-secondary">
                Henüz mesaj yok. İlk mesajı buradan yazabilirsin.
              </p>
            </div>
          ) : (
            <div className="space-y-sm">
              {chatItems.map((item, index) => (
                <ChatBubble
                  key={item.id}
                  item={item}
                  showMeta={shouldShowMessageMeta(chatItems, index)}
                />
              ))}
            </div>
          )}
        </div>

        {error ? (
          <div className="mx-md mt-md rounded-2xl border border-danger/30 bg-danger-bg px-md py-sm text-body font-medium text-danger">
            {error}
          </div>
        ) : null}

        <form
          className={cn(
            "sticky bottom-0 border-t px-md py-md",
            isInternalMode
              ? "border-warning/40 bg-warning-bg"
              : "border-border-subtle bg-surface-1"
          )}
          onSubmit={handleSubmit}
        >
          {composerTopSlot ? <div className="mb-sm">{composerTopSlot}</div> : null}

          <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
            {allowInternalNotes ? (
              <div className="grid grid-cols-2 gap-xs rounded-xl border border-border bg-surface-2 p-[3px]">
                <button
                  type="button"
                  onClick={() => setMode("public_reply")}
                  className={cn(
                    "rounded-lg px-sm py-xs text-caption font-semibold transition",
                    mode === "public_reply"
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  Yanıt
                </button>

                <button
                  type="button"
                  onClick={() => setMode("internal_note")}
                  className={cn(
                    "rounded-lg px-sm py-xs text-caption font-semibold transition",
                    mode === "internal_note"
                      ? "bg-warning text-white"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  Dahili
                </button>
              </div>
            ) : (
              <span className="text-caption text-text-secondary">
                Talep yanıtı
              </span>
            )}

            <span
              className={cn(
                "text-caption",
                isInternalMode ? "text-warning" : "text-text-secondary"
              )}
            >
              {isInternalMode
                ? "Sadece IT ekibi görür"
                : "Requester tarafından görünür"}
            </span>
          </div>

          <div
            className={cn(
              "flex items-end gap-sm rounded-2xl border bg-surface-0 p-xs shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20",
              isInternalMode ? "border-warning/45" : "border-border"
            )}
          >
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={1}
              className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-sm py-[11px] text-body text-text-primary outline-none placeholder:text-text-muted"
              placeholder={
                isInternalMode
                  ? "Dahili not yaz..."
                  : "Mesaj yaz..."
              }
            />

            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50",
                isInternalMode ? "bg-warning" : "bg-accent"
              )}
              aria-label={isInternalMode ? "Dahili notu kaydet" : "Mesaj gönder"}
            >
              <IconSend size={18} aria-hidden={true} />
            </button>
          </div>

          <p className="mt-xs text-right text-[11px] text-text-secondary">
            Enter gönderir · Shift+Enter yeni satır
          </p>
        </form>
      </div>
    </aside>
  );
}