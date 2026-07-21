import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "../../lib/cn";

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const pageSizeOptions = [10, 25, 50, 100];

export function TablePagination({
  page,
  pageSize,
  totalCount,
  hasNext,
  hasPrevious,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="flex flex-col gap-md rounded-panel border border-border bg-surface-1 px-md py-sm shadow-panel md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-xs text-caption text-text-secondary">
        <span>
          Toplam{" "}
          <span className="font-semibold text-text-primary">{totalCount}</span>{" "}
          kayıt
        </span>
        <span className="text-text-muted">·</span>
        <span>
          Sayfa{" "}
          <span className="font-semibold text-text-primary">{page}</span> /{" "}
          <span className="font-semibold text-text-primary">{totalPages}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-sm">
        <label className="flex items-center gap-xs text-caption text-text-secondary">
          Sayfa boyutu
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-xl border border-border bg-surface-2 px-sm text-body text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-xs">
          <button
            type="button"
            disabled={!hasPrevious}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className={cn(
              "inline-flex h-9 items-center gap-xs rounded-xl border border-border px-sm text-body font-medium transition focus:outline-none focus:ring-2 focus:ring-accent/25",
              hasPrevious
                ? "bg-surface-1 text-text-primary hover:border-accent hover:bg-accent-bg hover:text-accent"
                : "cursor-not-allowed bg-surface-0 text-text-muted opacity-60"
            )}
          >
            <IconChevronLeft size={16} aria-hidden={true} />
            Önceki
          </button>

          <button
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(page + 1)}
            className={cn(
              "inline-flex h-9 items-center gap-xs rounded-xl border border-border px-sm text-body font-medium transition focus:outline-none focus:ring-2 focus:ring-accent/25",
              hasNext
                ? "bg-surface-1 text-text-primary hover:border-accent hover:bg-accent-bg hover:text-accent"
                : "cursor-not-allowed bg-surface-0 text-text-muted opacity-60"
            )}
          >
            Sonraki
            <IconChevronRight size={16} aria-hidden={true} />
          </button>
        </div>
      </div>
    </div>
  );
}