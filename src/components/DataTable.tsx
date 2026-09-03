import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "center" | "right";
};

type DataTableProps<T extends Record<string, unknown>> = {
  columns: Column<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  toolbar?: ReactNode;
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
  /** Drop inner wrap border/shadow when the table already sits inside a card. */
  flush?: boolean;
};

/** Canonical data grid — same font, header bg, zebra, and borders on every page. */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyTitle = "No records found",
  emptyDescription = "There is nothing to display yet.",
  emptyAction,
  toolbar,
  getRowKey,
  onRowClick,
  className,
  flush = false,
}: DataTableProps<T>) {
  return (
    <div className={cn(!flush && "space-y-3", className)}>
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">{toolbar}</div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState
          bare
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : (
        <div className={cn("app-table-wrap", flush && "app-table-wrap--flush")}>
          <Table className="app-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-0">
                {columns.map((col) => (
                  <TableHead
                    key={String(col.key)}
                    className={cn(
                      "h-auto bg-[var(--color-neutral-100)] px-3 py-2 text-xs font-semibold text-[var(--color-neutral-700)]",
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                    )}
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-[var(--color-border)] text-sm text-[var(--color-neutral-900)]",
                    index % 2 === 1 && "bg-[var(--color-neutral-50)]",
                    "hover:bg-[var(--color-primary-light)]",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={String(col.key)}
                      className={cn(
                        "px-3 py-2 whitespace-normal",
                        col.align === "center" && "text-center",
                        col.align === "right" && "text-right",
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T] ?? "-")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
