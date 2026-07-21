import type { ReactNode } from "react";
import {
  IconChevronDown,
  IconChevronUp,
  IconSelector,
} from "@tabler/icons-react";
import { DetailIconButton } from "./DetailIconButton";
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
  onViewDetails?: (item: T) => void;
  viewDetailsLabel?: string;
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
  onViewDetails,
  viewDetailsLabel = "Detayları gör",
  getRowClassName,
}: DataTableProps<T>) {
  const currentOrdering = ordering ?? "";
  const hasDetailAction = Boolean(onViewDetails);
  const colSpan = columns.length + (hasDetailAction ? 1 : 0);

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

              {hasDetailAction ? (
                <th className="sticky right-0 z-10 w-[72px] border-b border-border bg-surface-1 px-md py-sm text-right font-normal">
                  <span className="sr-only">{viewDetailsLabel}</span>
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-md py-lg text-center text-text-secondary"
                >
                  Yükleniyor...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-md py-lg text-center text-text-secondary"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={getRowKey(item)}
                  className={cn(
                    "transition hover:bg-surface-2",
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

                  {hasDetailAction ? (
                    <td className="sticky right-0 z-10 w-[72px] border-b border-border bg-surface-1 px-md py-md text-right align-top shadow-[-8px_0_16px_-16px_rgba(15,23,42,0.35)]">
                     <DetailIconButton
                     label={viewDetailsLabel}
                     onClick={() => onViewDetails?.(item)}
                     />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}