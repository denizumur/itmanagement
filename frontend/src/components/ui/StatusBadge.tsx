import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type StatusBadgeVariant = "accent" | "success" | "warning" | "danger" | "neutral";

interface StatusBadgeProps {
  children: ReactNode;
  variant?: StatusBadgeVariant;
  className?: string;
}

const variantClass: Record<StatusBadgeVariant, string> = {
  accent: "bg-accent-bg text-accent",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-surface-1 text-text-secondary",
};

export function StatusBadge({
  children,
  variant = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-app px-sm py-xs text-caption",
        variantClass[variant],
        className
      )}
    >
      {children}
    </span>
  );
}