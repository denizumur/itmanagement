import type { UserRole } from "../types/auth";

export function canManage(role: UserRole | null | undefined) {
  return role === "admin" || role === "technician";
}

export function canView(role: UserRole | null | undefined) {
  return role === "admin" || role === "technician" || role === "viewer";
}

export function canApprove(role: UserRole | null | undefined) {
  return role === "admin" || role === "approver";
}

export function isRequester(role: UserRole | null | undefined) {
  return role === "requester";
}

export function canAccessOperationalApp(role: UserRole | null | undefined) {
  return role === "admin" || role === "technician" || role === "viewer";
}

export function canAccessRequesterApp(role: UserRole | null | undefined) {
  return role === "requester";
}