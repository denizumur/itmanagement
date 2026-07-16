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
  fetchTicketQueue,
  fetchTicketSummary,
  fetchTicketsTable,
  rejectTicket,
  updateTicketStatus,
  uploadTicketAttachment,
} from "../api/tickets";
import type { TableQueryState } from "../types/table";
import type {
  TicketApprovalDecisionPayload,
  TicketAttachmentUploadPayload,
  TicketCommentCreatePayload,
  TicketCreatePayload,
  TicketStatus,
} from "../types/tickets";

export function ticketCommentsQueryKey(ticketId?: number | null) {
  return ["tickets", "comments", ticketId] as const;
}

export function ticketAttachmentsQueryKey(ticketId?: number | null) {
  return ["tickets", "attachments", ticketId] as const;
}

export function useMyTickets() {
  return useQuery({
    queryKey: ["tickets", "mine"],
    queryFn: fetchMyTickets,
    staleTime: 45_000,
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
  return useQuery({
    queryKey: ["tickets", "requester-context"],
    queryFn: fetchRequesterContext,
    staleTime: 60_000,
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
  return useQuery({
    queryKey: ["tickets", "approvals"],
    queryFn: fetchTicketApprovals,
    staleTime: 30_000,
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
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ticketId,
      status,
    }: {
      ticketId: number;
      status: TicketStatus;
    }) => updateTicketStatus(ticketId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
    onSuccess: async () => {
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}