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
    "hover:border-accent hover:bg-accent/5 hover:text-accent focus-visible:border-accent",
  success:
    "hover:border-success hover:bg-success/5 hover:text-success focus-visible:border-success",
  warning:
    "hover:border-warning hover:bg-warning/5 hover:text-warning focus-visible:border-warning",
  danger:
    "hover:border-danger hover:bg-danger/5 hover:text-danger focus-visible:border-danger",
  neutral:
    "hover:border-border hover:bg-surface-2 hover:text-text-primary focus-visible:border-border",
};

const iconToneClassNames: Record<PortalActionTone, string> = {
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  neutral: "bg-surface-2 text-text-secondary",
};

export function PortalActionGrid({ actions, className }: PortalActionGridProps) {
  return (
    <div
      className={cn(
        "grid gap-md sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {actions.map((action) => {
        const tone = action.tone ?? "accent";

        return (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              "group min-h-[150px] rounded-panel border border-border bg-surface-1 p-lg text-left shadow-panel outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60",
              toneClassNames[tone]
            )}
          >
            <div className="flex h-full flex-col items-center justify-center gap-md text-center">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl transition group-hover:scale-105",
                  iconToneClassNames[tone]
                )}
              >
                {action.icon}
              </div>

              <div className="flex items-center justify-center gap-xs">
                <span className="text-h3 text-text-primary transition group-hover:text-inherit">
                  {action.label}
                </span>

                {action.badge !== null && action.badge !== undefined ? (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-border bg-surface-2 px-xs py-[2px] text-caption font-semibold text-text-secondary">
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