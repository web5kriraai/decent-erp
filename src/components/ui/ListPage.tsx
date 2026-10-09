"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { QueryState } from "@/components/ui/QueryState";
import { PaginationBar, type PaginationBarProps } from "@/components/ui/PaginationBar";
import { ListSearch, type ListSearchProps } from "@/components/ui/ListSearch";
import { ListRefreshButton } from "@/components/ui/ListRefreshButton";
import type { BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { cn } from "@/lib/utils";

export type ListPageQueryProps = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  skeletonVariant?: "table" | "cards" | "stats" | "pipeline-accordion";
  hideOnForbidden?: boolean;
};

export type ListPageProps = {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  /** Extra header actions (Add, Archive, etc.). Refresh lives in the toolbar. */
  actions?: ReactNode;
  wide?: boolean;
  className?: string;
  /** Search field in the toolbar. */
  search?: Omit<ListSearchProps, "className">;
  /** Optional filters (status select, date range, etc.). */
  filters?: ReactNode;
  /** Extra toolbar content after filters (counts, secondary links). */
  toolbarExtra?: ReactNode;
  /** Refresh handler - always shown when provided. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** Stats / summary row above the table (flex-shrink: 0). */
  beforeTable?: ReactNode;
  /** Loading / error / empty wrapper around the table body. */
  query?: ListPageQueryProps;
  /** Pagination under the scrollable table. */
  pagination?: Omit<PaginationBarProps, "className">;
  /** Hide toolbar entirely (rare). */
  hideToolbar?: boolean;
  /**
   * Modals / portals that must not sit as siblings of `.list-page` under
   * `.app-content` (they steal flex height and clip the toolbar + table).
   */
  overlays?: ReactNode;
  children: ReactNode;
};

/**
 * Viewport-fit list shell: fixed header + toolbar + pagination;
 * only the table body scrolls. Use with DataTable (flush recommended).
 */
export function ListPage({
  title,
  subtitle,
  breadcrumbs,
  actions,
  wide = false,
  className,
  search,
  filters,
  toolbarExtra,
  onRefresh,
  isRefreshing,
  beforeTable,
  query,
  pagination,
  hideToolbar = false,
  overlays,
  children,
}: ListPageProps) {
  const showToolbar =
    !hideToolbar &&
    Boolean(search || filters || toolbarExtra || onRefresh);

  const tableContent = query ? (
    <QueryState
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={query.onRetry ?? onRefresh}
      isEmpty={query.isEmpty}
      emptyTitle={query.emptyTitle}
      emptyDescription={query.emptyDescription}
      emptyAction={query.emptyAction}
      skeletonVariant={query.skeletonVariant ?? "table"}
      hideOnForbidden={query.hideOnForbidden}
    >
      {children}
    </QueryState>
  ) : (
    children
  );

  return (
    <div className="list-page-host">
      <div
        className={cn(
          "page-shell list-page",
          wide && "page-shell--wide",
          className,
        )}
      >
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          actions={actions}
          className="list-page__header"
        />

        {showToolbar ? (
          <PageToolbar className="list-page__toolbar">
            {search ? <ListSearch {...search} /> : null}
            {filters ? (
              <div className="list-filter-group" role="group" aria-label="Filters">
                {filters}
              </div>
            ) : null}
            {toolbarExtra}
            {onRefresh ? (
              <ListRefreshButton
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
              />
            ) : null}
          </PageToolbar>
        ) : null}

        {beforeTable ? (
          <div className="list-page__before">{beforeTable}</div>
        ) : null}

        <div className="list-page__body">
          <div className="list-page__table">{tableContent}</div>
        </div>

        {pagination && pagination.total >= 0 ? (
          <PaginationBar {...pagination} className="list-page__pagination" />
        ) : null}
      </div>
      {overlays}
    </div>
  );
}
