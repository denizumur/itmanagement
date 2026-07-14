import { api } from "./http";
import type {
  Ticket,
  TicketComment,
  TicketCommentCreatePayload,
  TicketCreatePayload,
  TicketStatus,
} from "../types/tickets";

export async function fetchMyTickets() {
  const response = await api.get<Ticket[]>("/api/tickets/");
  return response.data;
}

export async function createTicket(payload: TicketCreatePayload) {
  const response = await api.post<Ticket>("/api/tickets/", payload);
  return response.data;
}

export async function fetchTicketQueue() {
  const response = await api.get<Ticket[]>("/api/tickets/queue/");
  return response.data;
}

export async function updateTicketStatus(ticketId: number, status: TicketStatus) {
  const response = await api.post<Ticket>(`/api/tickets/${ticketId}/status/`, {
    status,
  });
  return response.data;
}

export async function fetchTicketComments(ticketId: number) {
  const response = await api.get<TicketComment[]>(
    `/api/tickets/${ticketId}/comments/`
  );
  return response.data;
}

export async function createTicketComment(
  ticketId: number,
  payload: TicketCommentCreatePayload
) {
  const response = await api.post<TicketComment>(
    `/api/tickets/${ticketId}/comments/`,
    payload
  );
  return response.data;
}