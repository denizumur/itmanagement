import type { UserRole } from "../types/auth";

export function canManage(role: UserRole | null | undefined) {
  return role === "admin" || role === "technician";
}

export function canView(role: UserRole | null | undefined) {
  return role === "admin" || role === "technician" || role === "viewer";
}