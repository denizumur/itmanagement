import { buildTableApiParams } from "../lib/tableQuery";
import type { TableQueryState } from "../types/table";
import { api } from "./http";
import type {
  PaginatedTicketResponse,
  Ticket,
  TicketApproval,
  TicketApprovalDecisionPayload,
  TicketAttachment,
  TicketAttachmentUploadPayload,
  TicketComment,
  TicketResolutionReopenPayload,
  TicketCommentCreatePayload,
  TicketContext,
  TicketCreatePayload,
  TicketRequesterContext,
  TicketStatusUpdatePayload,
  TicketReturnToRequesterPayload,
  TicketSummary,
  TicketTimelineResponse,
} from "../types/tickets";

const TICKETS_ENDPOINT = "/api/tickets/";

export async function fetchMyTickets() {
  const response = await api.get<Ticket[]>(`${TICKETS_ENDPOINT}mine/`);
  return response.data;
}

export async function fetchTicketsTable(state: TableQueryState) {
  const response = await api.get<PaginatedTicketResponse<Ticket>>(
    `${TICKETS_ENDPOINT}table/`,
    {
      params: buildTableApiParams(state),
    }
  );

  return response.data;
}

export async function fetchTicketSummary() {
  const response = await api.get<TicketSummary>(`${TICKETS_ENDPOINT}summary/`);
  return response.data;
}

export async function fetchRequesterContext() {
  const response = await api.get<TicketRequesterContext>(
    `${TICKETS_ENDPOINT}requester-context/`
  );

  return response.data;
}

export async function fetchTicketContext(ticketId: number) {
  const response = await api.get<TicketContext>(
    `${TICKETS_ENDPOINT}${ticketId}/context/`
  );

  return response.data;
}

export async function fetchTicketTimeline(ticketId: number) {
  const response = await api.get<TicketTimelineResponse>(
    `${TICKETS_ENDPOINT}${ticketId}/timeline/`
  );

  return response.data;
}

export async function createTicket(payload: TicketCreatePayload) {
  const response = await api.post<Ticket>(TICKETS_ENDPOINT, {
    ...payload,
    title: payload.title.trim(),
    description: payload.description.trim(),
  });

  return response.data;
}

export async function fetchTicketQueue() {
  const response = await api.get<Ticket[]>(`${TICKETS_ENDPOINT}queue/`);
  return response.data;
}

export async function fetchTicketApprovals() {
  const response = await api.get<TicketApproval[]>(`${TICKETS_ENDPOINT}approvals/`);
  return response.data;
}

export async function approveTicket(
  ticketId: number,
  payload: TicketApprovalDecisionPayload
) {
  const response = await api.post<Ticket>(
    `${TICKETS_ENDPOINT}${ticketId}/approve/`,
    payload
  );

  return response.data;
}

export async function rejectTicket(
  ticketId: number,
  payload: TicketApprovalDecisionPayload
) {
  const response = await api.post<Ticket>(
    `${TICKETS_ENDPOINT}${ticketId}/reject/`,
    payload
  );

  return response.data;
}

export async function updateTicketStatus({
  ticketId,
  status,
  solution_note,
}: TicketStatusUpdatePayload) {
  const response = await api.post<Ticket>(`${TICKETS_ENDPOINT}${ticketId}/status/`, {
    status,
    solution_note,
  });

  return response.data;
}

export async function returnTicketToRequester(
  ticketId: number,
  payload: TicketReturnToRequesterPayload
) {
  const response = await api.post<Ticket>(
    `${TICKETS_ENDPOINT}${ticketId}/return-to-requester/`,
    {
      comment: payload.comment.trim(),
    }
  );

  return response.data;
}

export async function confirmTicketResolution(ticketId: number) {
  const response = await api.post<Ticket>(
    `${TICKETS_ENDPOINT}${ticketId}/confirm-resolution/`,
    {}
  );

  return response.data;
}

export async function reopenTicketResolution(
  ticketId: number,
  payload: TicketResolutionReopenPayload
) {
  const response = await api.post<Ticket>(
    `${TICKETS_ENDPOINT}${ticketId}/reopen-resolution/`,
    {
      reason: payload.reason.trim(),
    }
  );

  return response.data;
}

export async function fetchTicketComments(ticketId: number) {
  const response = await api.get<TicketComment[]>(
    `${TICKETS_ENDPOINT}${ticketId}/comments/`
  );

  return response.data;
}

export async function createTicketComment(
  ticketId: number,
  payload: TicketCommentCreatePayload
) {
  const response = await api.post<TicketComment>(
    `${TICKETS_ENDPOINT}${ticketId}/comments/`,
    {
      body: payload.body.trim(),
      is_internal: Boolean(payload.is_internal),
    }
  );

  return response.data;
}

export async function fetchTicketAttachments(ticketId: number) {
  const response = await api.get<TicketAttachment[]>(
    `${TICKETS_ENDPOINT}${ticketId}/attachments/`
  );

  return response.data;
}

export async function uploadTicketAttachment({
  ticketId,
  file,
}: TicketAttachmentUploadPayload) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await api.post<TicketAttachment>(
    `${TICKETS_ENDPOINT}${ticketId}/attachments/`,
    formData
  );

  return response.data;
}