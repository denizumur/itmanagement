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
    <div className="flex flex-col gap-sm rounded-panel border border-border bg-surface-1 p-md shadow-panel md:flex-row md:items-center md:justify-between">
      <div className="text-caption text-text-secondary">
        Toplam <span className="font-semibold text-text-primary">{totalCount}</span>{" "}
        kayıt · Sayfa{" "}
        <span className="font-semibold text-text-primary">{page}</span> /{" "}
        <span className="font-semibold text-text-primary">{totalPages}</span>
      </div>

      <div className="flex flex-wrap items-center gap-sm">
        <label className="flex items-center gap-xs text-caption text-text-secondary">
          Sayfa boyutu
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-app border border-border bg-surface-2 px-sm py-xs text-body text-text-primary outline-none focus:border-accent"
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
              "inline-flex items-center gap-xs rounded-app border border-border px-sm py-xs text-body transition",
              hasPrevious
                ? "text-text-primary hover:border-accent hover:text-accent"
                : "cursor-not-allowed text-text-muted opacity-50"
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
              "inline-flex items-center gap-xs rounded-app border border-border px-sm py-xs text-body transition",
              hasNext
                ? "text-text-primary hover:border-accent hover:text-accent"
                : "cursor-not-allowed text-text-muted opacity-50"
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