import type { ReactNode } from "react";
import { IconChevronDown, IconChevronUp, IconSelector } from "@tabler/icons-react";
import { cn } from "../../lib/cn";
import { getSortDirection } from "../../lib/tableQuery";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  sortKey?: string;
  className?: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string | number;
  ordering: string | null;
  onSortChange: (field: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

function SortIcon({
  direction,
}: {
  direction: "asc" | "desc" | null;
}) {
  if (direction === "asc") {
    return <IconChevronUp size={14} aria-hidden={true} />;
  }

  if (direction === "desc") {
    return <IconChevronDown size={14} aria-hidden={true} />;
  }

  return <IconSelector size={14} aria-hidden={true} />;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  ordering,
  onSortChange,
  isLoading = false,
  emptyMessage = "Kayıt bulunamadı.",
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-panel border border-border bg-surface-1 shadow-panel">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-left">
          <thead className="bg-surface-2/80">
            <tr>
              {columns.map((column) => {
                const sortField = column.sortKey ?? column.key;
                const direction = getSortDirection(ordering, sortField);

                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-md py-sm text-caption font-semibold uppercase tracking-wide text-text-secondary",
                      column.className
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(sortField)}
                        className="inline-flex items-center gap-xs text-left transition hover:text-text-primary"
                      >
                        <span>{column.label}</span>
                        <SortIcon direction={direction} />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-md py-lg text-center text-body text-text-secondary"
                >
                  Yükleniyor...
                </td>
              </tr>
            ) : null}

            {!isLoading && data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-md py-lg text-center text-body text-text-secondary"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : null}

            {!isLoading
              ? data.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    className="transition hover:bg-surface-2/60"
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "whitespace-nowrap px-md py-sm text-body text-text-primary",
                          column.className
                        )}
                      >
                        {column.render
                          ? column.render(row)
                          : String((row as Record<string, unknown>)[column.key] ?? "-")}
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}