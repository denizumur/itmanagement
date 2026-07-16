import type { ReactNode } from "react";
import {
  IconChevronDown,
  IconChevronUp,
  IconSelector,
} from "@tabler/icons-react";
import { cn } from "../../lib/cn";
import { getSortDirection } from "../../lib/tableQuery";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  sortKey?: string;
  className?: string;
  render: (item: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (item: T) => string | number;
  ordering?: string | null;
  onSortChange?: (sortKey: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  getRowClassName?: (item: T) => string;
};

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  ordering,
  onSortChange,
  isLoading = false,
  emptyMessage = "Kayıt bulunamadı.",
  onRowClick,
  getRowClassName,
}: DataTableProps<T>) {
  const currentOrdering = ordering ?? "";

  function renderSortIcon(column: DataTableColumn<T>) {
    if (!column.sortable) {
      return null;
    }

    const sortKey = column.sortKey ?? column.key;
    const direction = getSortDirection(currentOrdering, sortKey);

    if (direction === "asc") {
      return <IconChevronUp size={14} aria-hidden={true} />;
    }

    if (direction === "desc") {
      return <IconChevronDown size={14} aria-hidden={true} />;
    }

    return <IconSelector size={14} aria-hidden={true} />;
  }

  return (
    <div className="overflow-hidden rounded-panel border border-border bg-surface-1 shadow-panel">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-body">
          <thead>
            <tr className="text-caption text-text-secondary">
              {columns.map((column) => {
                const sortKey = column.sortKey ?? column.key;

                return (
                  <th
                    key={column.key}
                    className={cn(
                      "border-b border-border px-md py-sm font-normal",
                      column.className
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(sortKey)}
                        className="inline-flex items-center gap-xs text-left transition hover:text-accent"
                      >
                        <span>{column.label}</span>
                        {renderSortIcon(column)}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-md py-lg text-center text-text-secondary"
                >
                  Yükleniyor...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-md py-lg text-center text-text-secondary"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={getRowKey(item)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={cn(
                    "transition hover:bg-surface-2",
                    onRowClick && "cursor-pointer",
                    getRowClassName?.(item)
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "border-b border-border px-md py-md align-top",
                        column.className
                      )}
                    >
                      {column.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}