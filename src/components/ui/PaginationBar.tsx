"use client";

import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { AppButton } from "@/components/ui/AppButton";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type PaginationBarProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  /** Show page-size select. Default true when onPageSizeChange is provided. */
  showPageSize?: boolean;
};

export function PaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
  showPageSize = Boolean(onPageSizeChange),
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className={cn("pagination-bar", className)} role="navigation" aria-label="Pagination">
      <p className="pagination-bar__summary">
        {total === 0 ? "No records" : `Showing ${from}–${to} of ${total}`}
      </p>

      <div className="pagination-bar__controls">
        {showPageSize && onPageSizeChange ? (
          <label className="pagination-bar__size">
            <span className="sr-only">Rows per page</span>
            <select
              className="form-select form-select--compact"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="pagination-bar__pages">
          <AppButton
            type="button"
            appVariant="secondary"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
          >
            <IconChevronLeft size={14} />
            Prev
          </AppButton>
          <span className="pagination-bar__page-label" aria-live="polite">
            Page {safePage} of {totalPages}
          </span>
          <AppButton
            type="button"
            appVariant="secondary"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
          >
            Next
            <IconChevronRight size={14} />
          </AppButton>
        </div>
      </div>
    </div>
  );
}
