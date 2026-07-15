import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface MiniMetricCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
  className?: string;
}

const toneClasses: Record<NonNullable<MiniMetricCardProps["tone"]>, string> = {
  default: "border-border bg-surface-1/80 text-text-primary",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-danger/25 bg-danger/10 text-danger",
  accent: "border-accent/25 bg-accent-bg text-accent",
};

export function MiniMetricCard({
  label,
  value,
  icon,
  tone = "default",
  className,
}: MiniMetricCardProps) {
  return (
    <div
      className={cn(
        "inline-flex min-w-[104px] items-center gap-sm rounded-full border px-md py-xs shadow-sm",
        toneClasses[tone],
        className
      )}
    >
      {icon ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2/70">
          {icon}
        </span>
      ) : null}

      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium leading-tight text-text-secondary">
          {label}
        </p>
        <p className="text-lg font-semibold leading-tight">{value}</p>
      </div>
    </div>
  );
}