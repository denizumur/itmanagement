import type { ReactNode } from "react";
import {
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
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
    <div className="overflow-hidden rounded-panel border border-border-strong/60 bg-surface-1/80 shadow-panel backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-body">
          <thead className="bg-surface-2/95">
            <tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
              {columns.map((column) => {
                const sortKey = column.sortKey ?? column.key;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "border-b border-border px-md py-[10px]",
                      column.className
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(sortKey)}
                        className="inline-flex items-center gap-xs rounded-md text-left transition hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/25 motion-reduce:transition-none"
                      >
                        <span>{column.label}</span>
                        <span className="text-text-muted">
                          {renderSortIcon(column)}
                        </span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}

              {hasDetailAction ? (
                <th className="sticky right-0 z-10 w-[64px] border-b border-border bg-surface-2/95 px-sm py-[10px] text-right shadow-[-16px_0_22px_-22px_rgba(15,23,42,0.42)]">
                  <span className="sr-only">{viewDetailsLabel}</span>
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-md py-xl">
                  <div className="mx-auto flex max-w-sm flex-col items-center justify-center rounded-2xl border border-dashed border-accent/30 bg-accent-bg/40 px-lg py-xl text-center">
                    <IconLoader2
                      size={22}
                      className="animate-spin text-accent"
                      aria-hidden={true}
                    />
                    <p className="mt-sm text-body font-medium text-text-primary">
                      Yükleniyor
                    </p>
                    <p className="mt-xs text-caption text-text-secondary">
                      Tablo verileri hazırlanıyor...
                    </p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-md py-xl">
                  <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-border-strong bg-surface-0/80 px-lg py-xl text-center">
                    <p className="text-body font-semibold text-text-primary">
                      Kayıt bulunamadı
                    </p>
                    <p className="mt-xs text-caption text-text-secondary">
                      {emptyMessage}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={getRowKey(item)}
                  className={cn(
                    "group bg-surface-1/70 transition hover:bg-surface-2/90 motion-reduce:transition-none",
                    getRowClassName?.(item)
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "border-b border-border-subtle/80 px-md py-sm align-middle text-text-secondary",
                        column.className
                      )}
                    >
                      {column.render(item)}
                    </td>
                  ))}

                  {hasDetailAction ? (
                    <td className="sticky right-0 z-10 w-[64px] border-b border-border-subtle/80 bg-inherit px-sm py-sm text-right align-middle shadow-[-16px_0_22px_-22px_rgba(15,23,42,0.42)]">
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
