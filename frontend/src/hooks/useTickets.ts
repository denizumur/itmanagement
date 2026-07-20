import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  approveTicket,
  createTicket,
  createTicketComment,
  fetchMyTickets,
  fetchRequesterContext,
  fetchTicketApprovals,
  fetchTicketAttachments,
  fetchTicketComments,
  fetchTicketContext,
  fetchTicketTimeline,
  fetchTicketQueue,
  fetchTicketSummary,
  fetchTicketsTable,
  rejectTicket,
  updateTicketStatus,
  uploadTicketAttachment,
} from "../api/tickets";
import { useAuth } from "../auth/AuthContext";
import type { TableQueryState } from "../types/table";
import type {
  TicketApprovalDecisionPayload,
  TicketAttachmentUploadPayload,
  TicketCommentCreatePayload,
  TicketCreatePayload,
  TicketStatusUpdatePayload,
} from "../types/tickets";

export function ticketCommentsQueryKey(ticketId?: number | null) {
  return ["tickets", "comments", ticketId] as const;
}

export function ticketAttachmentsQueryKey(ticketId?: number | null) {
  return ["tickets", "attachments", ticketId] as const;
}

export function ticketContextQueryKey(ticketId?: number | null) {
  return ["tickets", "context", ticketId] as const;
}
export function ticketTimelineQueryKey(ticketId?: number | null) {
  return ["tickets", "timeline", ticketId] as const;
}
export function useMyTickets() {
  const { userKey, enabled } = useCurrentUserQueryScope();

  return useQuery({
    queryKey: ["tickets", "mine", userKey],
    queryFn: fetchMyTickets,
    enabled,
    staleTime: 0,
  });
}
export function useTicketsTable(state: TableQueryState) {
  return useQuery({
    queryKey: ["tickets", "table", state],
    queryFn: () => fetchTicketsTable(state),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useTicketSummary() {
  return useQuery({
    queryKey: ["tickets", "summary"],
    queryFn: fetchTicketSummary,
    staleTime: 30_000,
  });
}

export function useRequesterContext() {
  const { userKey, enabled } = useCurrentUserQueryScope();

  return useQuery({
    queryKey: ["tickets", "requester-context", userKey],
    queryFn: fetchRequesterContext,
    enabled,
    staleTime: 0,
  });
}
export function useTicketContext(ticketId?: number | null, enabled = true) {
  return useQuery({
    queryKey: ticketContextQueryKey(ticketId),
    queryFn: () => fetchTicketContext(Number(ticketId)),
    enabled: enabled && Boolean(ticketId),
    staleTime: 15_000,
  });
}

export function useTicketTimeline(ticketId?: number | null, enabled = true) {
  return useQuery({
    queryKey: ticketTimelineQueryKey(ticketId),
    queryFn: () => fetchTicketTimeline(Number(ticketId)),
    enabled: enabled && Boolean(ticketId),
    staleTime: 15_000,
  });
}

export function useTicketQueue() {
  return useQuery({
    queryKey: ["tickets", "queue"],
    queryFn: fetchTicketQueue,
    staleTime: 30_000,
  });
}

export function useTicketApprovals() {
  const { userKey, enabled } = useCurrentUserQueryScope();

  return useQuery({
    queryKey: ["tickets", "approvals", userKey],
    queryFn: fetchTicketApprovals,
    enabled,
    staleTime: 0,
  });
}

export function useTicketComments(ticketId?: number | null, enabled = true) {
  return useQuery({
    queryKey: ticketCommentsQueryKey(ticketId),
    queryFn: () => fetchTicketComments(Number(ticketId)),
    enabled: enabled && Boolean(ticketId),
    refetchInterval: enabled && ticketId ? 5_000 : false,
    staleTime: 0,
  });
}

export function useTicketAttachments(ticketId?: number | null, enabled = true) {
  return useQuery({
    queryKey: ticketAttachmentsQueryKey(ticketId),
    queryFn: () => fetchTicketAttachments(Number(ticketId)),
    enabled: enabled && Boolean(ticketId),
    staleTime: 30_000,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TicketCreatePayload) => createTicket(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUploadTicketAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TicketAttachmentUploadPayload) =>
      uploadTicketAttachment(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ticketAttachmentsQueryKey(variables.ticketId),
      });
      await queryClient.invalidateQueries({
        queryKey: ticketContextQueryKey(variables.ticketId),
      });
      await queryClient.invalidateQueries({
        queryKey: ticketTimelineQueryKey(variables.ticketId),
      });
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TicketStatusUpdatePayload) => updateTicketStatus(payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ticketContextQueryKey(variables.ticketId),
      });
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ticketTimelineQueryKey(variables.ticketId) });
    },
  });
}

export function useCreateTicketComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ticketId,
      payload,
    }: {
      ticketId: number;
      payload: TicketCommentCreatePayload;
    }) => createTicketComment(ticketId, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ticketCommentsQueryKey(variables.ticketId),
      });
      await queryClient.invalidateQueries({
        queryKey: ticketContextQueryKey(variables.ticketId),
      });
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useApproveTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ticketId,
      payload,
    }: {
      ticketId: number;
      payload: TicketApprovalDecisionPayload;
    }) => approveTicket(ticketId, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ticketContextQueryKey(variables.ticketId),
      });
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useRejectTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ticketId,
      payload,
    }: {
      ticketId: number;
      payload: TicketApprovalDecisionPayload;
    }) => rejectTicket(ticketId, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ticketContextQueryKey(variables.ticketId),
      });
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

function useCurrentUserQueryScope() {
  const { isAuthenticated, user } = useAuth();

  const userKey = isAuthenticated
    ? `${user?.email ?? user?.username ?? "unknown"}:${user?.role ?? "unknown"}`
    : "anonymous";

  return {
    userKey,
    enabled: isAuthenticated && Boolean(user),
  };
}