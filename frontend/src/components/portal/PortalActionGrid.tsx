import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type PortalActionTone =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export interface PortalActionItem {
  key: string;
  label: string;
  icon: ReactNode;
  badge?: string | number | null;
  tone?: PortalActionTone;
  disabled?: boolean;
  onClick: () => void;
}

interface PortalActionGridProps {
  actions: PortalActionItem[];
  className?: string;
}

const toneClassNames: Record<PortalActionTone, string> = {
  accent:
    "hover:border-accent/50 hover:bg-accent-bg hover:text-accent focus-visible:border-accent focus-visible:ring-accent/25",
  success:
    "hover:border-success/50 hover:bg-success-bg hover:text-success focus-visible:border-success focus-visible:ring-success/25",
  warning:
    "hover:border-warning/50 hover:bg-warning-bg hover:text-warning focus-visible:border-warning focus-visible:ring-warning/25",
  danger:
    "hover:border-danger/50 hover:bg-danger-bg hover:text-danger focus-visible:border-danger focus-visible:ring-danger/25",
  neutral:
    "hover:border-border-strong hover:bg-surface-2 hover:text-text-primary focus-visible:border-accent focus-visible:ring-accent/20",
};

const iconToneClassNames: Record<PortalActionTone, string> = {
  accent: "bg-accent-bg text-accent",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-surface-2 text-text-secondary",
};

const badgeToneClassNames: Record<PortalActionTone, string> = {
  accent: "border-accent/20 bg-accent-bg text-accent",
  success: "border-success/20 bg-success-bg text-success",
  warning: "border-warning/25 bg-warning-bg text-warning",
  danger: "border-danger/25 bg-danger-bg text-danger",
  neutral: "border-border bg-surface-2 text-text-secondary",
};

export function PortalActionGrid({ actions, className }: PortalActionGridProps) {
  return (
    <div className={cn("grid gap-md sm:grid-cols-2 lg:grid-cols-3", className)}>
      {actions.map((action) => {
        const tone = action.tone ?? "accent";
        const hasBadge = action.badge !== null && action.badge !== undefined;

        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            aria-label={action.label}
            className={cn(
              "group relative min-h-[150px] overflow-hidden rounded-panel border border-border-subtle bg-surface-1 p-lg text-left shadow-panel outline-none transition duration-150 hover:-translate-y-0.5 hover:shadow-card focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:border-border-subtle disabled:hover:bg-surface-1 disabled:hover:shadow-panel",
              toneClassNames[tone]
            )}
          >
            <div className="pointer-events-none absolute inset-x-lg top-0 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent opacity-60" />

            <div className="flex h-full flex-col items-center justify-center gap-md text-center">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition duration-150 group-hover:scale-105",
                  iconToneClassNames[tone]
                )}
              >
                {action.icon}
              </div>

              <div className="flex max-w-full flex-col items-center gap-xs">
                <span className="max-w-full truncate text-h3 font-semibold text-text-primary transition group-hover:text-inherit">
                  {action.label}
                </span>

                {hasBadge ? (
                  <span
                    className={cn(
                      "inline-flex min-w-6 items-center justify-center rounded-full border px-xs py-[2px] text-caption font-semibold shadow-sm",
                      badgeToneClassNames[tone]
                    )}
                  >
                    {action.badge}
                  </span>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}