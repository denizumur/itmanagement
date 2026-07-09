import type { ReactNode } from "react";
import { GlassPanel } from "./GlassPanel";

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
    <GlassPanel className={className}>
      {(title || description || action) && (
        <div className="mb-md flex items-start justify-between gap-md">
          <div>
            {title && <p className="text-h3 text-text-primary">{title}</p>}
            {description && (
              <p className="mt-xs text-caption text-text-secondary">
                {description}
              </p>
            )}
          </div>

          {action}
        </div>
      )}

      {children}
    </GlassPanel>
  );
}