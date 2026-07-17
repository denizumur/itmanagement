import { IconHistory } from "@tabler/icons-react";
import { Link } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { cn } from "../../lib/cn";

interface AuditHistoryLinkProps {
  entityType: string;
  entityId?: string | number | null;
  label?: string;
  className?: string;
}

export function AuditHistoryLink({
  entityType,
  entityId,
  label = "Tüm geçmişi gör",
  className,
}: AuditHistoryLinkProps) {
  const { user } = useAuth();

  if (user?.role !== "admin" || entityId === undefined || entityId === null || entityId === "") {
    return null;
  }

  const searchParams = new URLSearchParams({
    entity_type: entityType,
    entity_id: String(entityId),
  });

  return (
    <Link
      to={`/audit?${searchParams.toString()}`}
      className={cn(
        "inline-flex items-center gap-xs rounded-app border border-accent/30 bg-accent-bg px-sm py-xs text-caption font-semibold text-accent transition hover:border-accent hover:bg-accent/15",
        className
      )}
    >
      <IconHistory size={15} aria-hidden={true} />
      {label}
    </Link>
  );
}
