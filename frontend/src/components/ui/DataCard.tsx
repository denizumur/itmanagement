import type { ReactNode } from "react";
import { GlassPanel } from "./GlassPanel";
import { cn } from "../../lib/cn";

interface DataCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function DataCard({
  title,
  description,
  children,
  action,
  className,
}: DataCardProps) {
  return (
    <GlassPanel className={cn("p-lg", className)}>
      {(title || description || action) && (
        <div className="mb-lg flex flex-col gap-sm border-b border-border-subtle pb-md sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <p className="text-h3 font-semibold text-text-primary">{title}</p>
            ) : null}

            {description ? (
              <p className="mt-xs max-w-2xl text-caption text-text-secondary">
                {description}
              </p>
            ) : null}
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}

      {children}
    </GlassPanel>
  );
}