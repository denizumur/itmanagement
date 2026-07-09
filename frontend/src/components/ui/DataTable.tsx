import type { ReactNode } from "react";
import { DataCard } from "./DataCard";

interface DataTableProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function DataTable({
  title,
  description,
  children,
  action,
}: DataTableProps) {
  return (
    <DataCard title={title} description={description} action={action} className="p-lg">
      <div className="overflow-x-auto">{children}</div>
    </DataCard>
  );
}