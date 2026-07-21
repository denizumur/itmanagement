import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface MiniMetricCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

const toneClasses: Record<NonNullable<MiniMetricCardProps["tone"]>, string> = {
  default:
    "border-border bg-surface-1 text-text-primary [--metric-icon-bg:var(--surface-2)] [--metric-icon-color:var(--text-secondary)]",
  success:
    "border-success/25 bg-surface-1 text-success [--metric-icon-bg:var(--bg-success)] [--metric-icon-color:var(--color-success)]",
  warning:
    "border-warning/25 bg-surface-1 text-warning [--metric-icon-bg:var(--bg-warning)] [--metric-icon-color:var(--color-warning)]",
  danger:
    "border-danger/25 bg-surface-1 text-danger [--metric-icon-bg:var(--bg-danger)] [--metric-icon-color:var(--color-danger)]",
  accent:
    "border-accent/25 bg-surface-1 text-accent [--metric-icon-bg:var(--bg-accent)] [--metric-icon-color:var(--color-accent)]",
};

export function MiniMetricCard({
  label,
  value,
  icon,
  tone = "default",
  className,
  onClick,
  ariaLabel,
}: MiniMetricCardProps) {
  const content = (
    <>
      {icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--metric-icon-bg)] text-[var(--metric-icon-color)]">
          {icon}
        </span>
      ) : null}

      <div className="min-w-0 text-left">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {label}
        </p>
        <p className="mt-[2px] text-xl font-semibold leading-tight text-text-primary">
          {value}
        </p>
      </div>
    </>
  );

  const classNames = cn(
    "inline-flex min-h-[64px] min-w-[148px] items-center gap-sm rounded-panel border px-md py-sm shadow-panel",
    onClick &&
      "cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:border-accent hover:bg-accent-bg hover:shadow-card focus:outline-none focus:ring-2 focus:ring-accent/30",
    toneClasses[tone],
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={classNames}
        onClick={onClick}
        aria-label={ariaLabel ?? `${label}: ${value}`}
      >
        {content}
      </button>
    );
  }

  return <div className={classNames}>{content}</div>;
}