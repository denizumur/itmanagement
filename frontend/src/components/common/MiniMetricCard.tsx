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
  onClick,
  ariaLabel,
}: MiniMetricCardProps) {
  const content = (
    <>
      {icon ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2/70">
          {icon}
        </span>
      ) : null}

      <div className="min-w-0 text-left">
        <p className="truncate text-[10px] font-medium leading-tight text-text-secondary">
          {label}
        </p>
        <p className="text-lg font-semibold leading-tight">{value}</p>
      </div>
    </>
  );

  const classNames = cn(
    "inline-flex min-w-[104px] items-center gap-sm rounded-full border px-md py-xs shadow-sm",
    onClick &&
      "cursor-pointer transition hover:-translate-y-0.5 hover:border-accent hover:shadow-panel focus:outline-none focus:ring-2 focus:ring-accent/40",
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