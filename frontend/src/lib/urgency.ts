import type { NotificationItem } from "../types/notifications";
import type { RoleColor } from "../types/dashboard";

export type UrgencyLevel = "success" | "warning" | "danger";

export type NotificationTone = "neutral" | "accent" | "warning" | "danger";

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

export const notificationToneClass: Record<NotificationTone, string> = {
  danger: "bg-danger-bg text-danger border-danger/30",
  warning: "bg-warning-bg text-warning border-warning/30",
  accent: "bg-accent-bg text-accent border-accent/30",
  neutral: "bg-surface-2 text-text-secondary border-border",
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

export function getNotificationTone(score: number): NotificationTone {
  if (score >= 90) return "danger";
  if (score >= 80) return "warning";
  if (score >= 60) return "accent";
  return "neutral";
}

export function getNotificationTypeLabel(item: NotificationItem) {
  if (item.type === "ticket_approval") return "Onay";
  if (item.type === "ticket") return "Ticket";
  if (item.type === "reminder") return "Hatırlatıcı";

  return item.type;
}

export function sortNotificationItems(items: NotificationItem[]) {
  return [...items].sort((first, second) => {
    const scoreDiff = second.urgency_score - first.urgency_score;

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return (
      new Date(second.created_at).getTime() -
      new Date(first.created_at).getTime()
    );
  });
}