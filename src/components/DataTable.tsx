import { Fragment, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageToolbar } from "@/components/ui/PageToolbar";
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
  className?: string;
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
  /** Optional expanded content under a row (e.g. nested sub-tables). */
  renderExpandedRow?: (row: T) => ReactNode | null | undefined;
};

/** Canonical data grid - same font, header bg, zebra, and borders on every page. */
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
  renderExpandedRow,
}: DataTableProps<T>) {
  return (
    <div className={cn(!flush && "space-y-3", className)}>
      {toolbar ? <PageToolbar className="mb-0">{toolbar}</PageToolbar> : null}
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
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={String(col.key)}
                    className={cn(
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                      col.className,
                    )}
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const expanded = renderExpandedRow?.(row);
                return (
                  <Fragment key={getRowKey(row)}>
                    <TableRow
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        onRowClick && "cursor-pointer",
                        "has-aria-expanded:bg-transparent",
                        expanded && "app-table-parent-expanded",
                      )}
                    >
                      {columns.map((col) => (
                        <TableCell
                          key={String(col.key)}
                          className={cn(
                            "whitespace-normal",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right",
                            col.className,
                          )}
                        >
                          {col.render
                            ? col.render(row)
                            : String(row[col.key as keyof T] ?? "-")}
                        </TableCell>
                      ))}
                    </TableRow>
                    {expanded ? (
                      <TableRow className="app-table-expanded-row hover:bg-transparent">
                        <TableCell
                          colSpan={columns.length}
                          className="app-table-expanded-cell whitespace-normal p-0"
                        >
                          {expanded}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
