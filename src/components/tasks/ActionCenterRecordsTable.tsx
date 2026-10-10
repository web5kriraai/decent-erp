"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { AppButtonLink } from "@/components/ui/AppButton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { ListSearch } from "@/components/ui/ListSearch";
import { ListRefreshButton } from "@/components/ui/ListRefreshButton";
import { useClientList } from "@/hooks/use-client-list";
import { ROUTES } from "@/config/routes";
import type { ActionCenterBlockedItem } from "@/hooks/use-tasks";
import type { DesignTask } from "@/lib/types/api";
import {
  formatActionCenterListHint,
  resolveActionDesignLabels,
  resolveActionPriority,
  resolveListItemDisplayStatus,
} from "@/lib/task-action-display";

type RecordsMode = "blocked" | "upcoming" | "completed";

type ActionCenterTableRow = {
  id: string;
  collection: string;
  ideaRef: string;
  stage: string;
  priority: string;
  status: string;
  detail: string;
} & Record<string, unknown>;

const DETAIL_HEADERS: Record<RecordsMode, string> = {
  blocked: "Blocked reason",
  upcoming: "Waiting on",
  completed: "Note",
};

const EMPTY: Record<
  RecordsMode,
  { title: string; description: string; searchPlaceholder: string }
> = {
  blocked: {
    title: "No blocked tasks",
    description: "Nothing is waiting on another stage right now.",
    searchPlaceholder: "Search blocked tasks…",
  },
  upcoming: {
    title: "No upcoming tasks",
    description: "Prior stages will unlock work for you here.",
    searchPlaceholder: "Search upcoming tasks…",
  },
  completed: {
    title: "No recently completed tasks",
    description: "Finished tasks will show up in this list.",
    searchPlaceholder: "Search completed tasks…",
  },
};

function mapBlockedRows(items: ActionCenterBlockedItem[]): ActionCenterTableRow[] {
  return items.map((item) => {
    const labels = resolveActionDesignLabels(item.design);
    const priority = resolveActionPriority(item.priority, item.designPriority);
    return {
      id: item.taskId,
      collection: labels.designTitle,
      ideaRef: labels.ideaRef,
      stage: item.stage,
      priority,
      status: item.status,
      detail: item.blockedMessage,
    };
  });
}

function mapTaskRows(
  tasks: DesignTask[],
  mode: "upcoming" | "completed",
): ActionCenterTableRow[] {
  return tasks.map((task) => {
    const labels = resolveActionDesignLabels(task.design);
    const priority = resolveActionPriority(task.priority, task.design?.priority);
    const detail = formatActionCenterListHint(task, mode) ?? "-";
    return {
      id: task.id,
      collection: labels.designTitle,
      ideaRef: labels.ideaRef,
      stage: task.subProcess.name,
      priority,
      status: resolveListItemDisplayStatus(task),
      detail,
    };
  });
}

function actionCenterSearchText(row: ActionCenterTableRow) {
  return [row.collection, row.ideaRef, row.stage, row.priority, row.status, row.detail].join(
    " ",
  );
}

type ActionCenterRecordsTableProps =
  | {
      mode: "blocked";
      items: ActionCenterBlockedItem[];
      onRefresh?: () => void;
      isRefreshing?: boolean;
    }
  | {
      mode: "upcoming" | "completed";
      items: DesignTask[];
      onRefresh?: () => void;
      isRefreshing?: boolean;
    };

export function ActionCenterRecordsTable(props: ActionCenterRecordsTableProps) {
  const { mode, items, onRefresh, isRefreshing } = props;

  const rows = useMemo(() => {
    if (mode === "blocked") return mapBlockedRows(items);
    return mapTaskRows(items, mode);
  }, [items, mode]);

  const getSearchText = useCallback(actionCenterSearchText, []);

  const list = useClientList({
    items: rows,
    getSearchText,
    filterKey: mode,
    initialPageSize: 10,
  });

  const copy = EMPTY[mode];
  const detailHeader = DETAIL_HEADERS[mode];

  return (
    <div className="action-center-records list-page">
      <div className="action-center-records__toolbar list-page__toolbar">
        <ListSearch
          value={list.search}
          onChange={list.setSearch}
          placeholder={copy.searchPlaceholder}
          aria-label={`Search ${mode} tasks`}
        />
        {onRefresh ? (
          <ListRefreshButton
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            className="ml-auto"
          />
        ) : null}
      </div>

      <div className="action-center-records__table list-page__table">
        <DataTable<ActionCenterTableRow>
          flush
          columns={[
            {
              key: "collection",
              header: "Design",
              render: (row) => (
                <div className="action-center-records__design">
                  <span className="font-medium text-foreground">{row.collection}</span>
                  <Link
                    href={ROUTES.work.taskDetail(row.id)}
                    className="data-table-link action-center-records__idea-ref"
                  >
                    {row.ideaRef}
                  </Link>
                </div>
              ),
            },
            {
              key: "stage",
              header: "Task",
              render: (row) => row.stage,
            },
            {
              key: "priority",
              header: "Priority",
              render: (row) => <PriorityBadge priority={row.priority} />,
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusBadge status={row.status} />,
            },
            {
              key: "detail",
              header: detailHeader,
              className: "action-center-records__detail-col",
              render: (row) => (
                <span className="action-center-records__detail">{row.detail}</span>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              render: (row) => (
                <AppButtonLink
                  href={ROUTES.work.taskDetail(row.id)}
                  size="sm"
                  appVariant="outline"
                >
                  View
                </AppButtonLink>
              ),
            },
          ]}
          rows={list.pageItems}
          getRowKey={(row) => row.id}
          emptyTitle={list.search.trim() ? "No matching tasks" : copy.title}
          emptyDescription={
            list.search.trim() ? "Try a different search term." : copy.description
          }
        />
      </div>

      <PaginationBar
        total={list.total}
        page={list.page}
        pageSize={list.pageSize}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        pageSizeSelectId={`action-center-${mode}-page-size`}
        className="action-center-records__pagination list-page__pagination"
      />
    </div>
  );
}
