import type { RoleColor } from "../types/dashboard";

export type UrgencyLevel = "success" | "warning" | "danger";

export const roleSurfaceClass: Record<RoleColor, string> = {
  accent: "bg-accent-bg text-accent",
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  success: "bg-success-bg text-success",
};

export const badgeClass: Record<UrgencyLevel, string> = {
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  success: "bg-success-bg text-success",
};

export function getUrgencyLevel(daysLeft: number): UrgencyLevel {
  if (daysLeft <= 7) return "danger";
  if (daysLeft <= 30) return "warning";
  return "success";
}

export function daysLabel(days: number) {
  if (days < 0) return `${Math.abs(days)} gün gecikmiş`;
  if (days === 0) return "Bugün";
  return `${days} gün`;
}