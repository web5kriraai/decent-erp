import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";

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
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyTitle = "No records found",
  emptyDescription = "There is nothing to display yet.",
  emptyAction,
  toolbar,
  getRowKey,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="data-table-wrap">
      {toolbar && <div className="toolbar">{toolbar}</div>}
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={String(col.key)} style={{ textAlign: col.align ?? "left" }}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} style={{ textAlign: col.align ?? "left" }}>
                      {col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
