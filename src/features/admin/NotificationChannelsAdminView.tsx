"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { ListPage } from "@/components/ui/ListPage";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet } from "@/lib/api-client";
import { useClientList } from "@/hooks/use-client-list";

type ChannelStatus = {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
} & Record<string, unknown>;

type Response = {
  inAppAlwaysOn: true;
  channels: ChannelStatus[];
};

function channelSearchText(row: ChannelStatus) {
  return `${row.label} ${row.detail} ${row.id}`;
}

export function NotificationChannelsAdminView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.MASTER_ADMIN);

  const query = useQuery({
    queryKey: ["admin", "notification-channels"],
    queryFn: () => apiGet<Response>("/api/admin/notification-channels"),
    enabled,
  });

  const getSearchText = useCallback(channelSearchText, []);
  const list = useClientList({
    items: query.data?.channels ?? [],
    getSearchText,
    initialPageSize: 25,
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.MASTER_ADMIN} />
      </div>
    );
  }

  return (
    <ListPage
      title="Notification channels"
      subtitle="Readiness of outbound channels. Secrets are never shown — configure values in .env and restart the app/worker."
      search={{
        value: list.search,
        onChange: list.setSearch,
        placeholder: "Search channels…",
        "aria-label": "Search notification channels",
      }}
      toolbarExtra={
        <span className="toolbar-count text-sm text-muted-foreground">
          In-app notifications work without SMTP/WhatsApp/Push.
        </span>
      }
      onRefresh={() => query.refetch()}
      isRefreshing={query.isFetching}
      query={{
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        onRetry: () => query.refetch(),
      }}
      pagination={{
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        onPageChange: list.setPage,
        onPageSizeChange: list.setPageSize,
        pageSizeSelectId: "notification-channels-page-size",
      }}
    >
      <DataTable
        flush
        columns={[
          { key: "label", header: "Channel" },
          {
            key: "detail",
            header: "Details",
            render: (row) => (
              <span className="text-muted-foreground">{row.detail}</span>
            ),
          },
          {
            key: "configured",
            header: "Status",
            render: (row) => (
              <StatusBadge
                status={row.configured ? "ACTIVE" : "ON_HOLD"}
                label={row.configured ? "Ready" : "Not configured"}
              />
            ),
          },
        ]}
        rows={list.pageItems}
        getRowKey={(row) => row.id}
        emptyTitle="No channels found"
        emptyDescription="Channel readiness will appear here once configured."
      />
    </ListPage>
  );
}
