"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { IconClipboardCheck } from "@/components/icons";
import { DataTable } from "@/components/DataTable";
import { AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { TableIconActionGroup } from "@/components/ui/TableIconAction";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/config/routes";
import { resolveWorkOpenHref } from "@/lib/resolve-work-open-href";
import { useApprovalsHub } from "@/hooks/use-approvals";
import { canRoleAccessApprovalsHub, getApprovalHubTabsForRole } from "@/lib/stage-approval-rbac";

type ApprovalTab = "stage" | "ready";

function isApprovalTab(value: string | null): value is ApprovalTab {
  return value === "stage" || value === "ready";
}

function TabCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="action-center-tab-count">{count}</span>;
}

function formatCompletedAt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ApprovalsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const roleCode = session?.user?.roleCode;
  const hubTabs = getApprovalHubTabsForRole(roleCode);
  const canAccessHub = canRoleAccessApprovalsHub(roleCode);

  const hubQuery = useApprovalsHub(canAccessHub);

  const stageItems = hubQuery.data?.stageApprovals ?? [];
  const readyItems = hubQuery.data?.readyForSignOff ?? [];

  const visibleTabs = useMemo(() => {
    const tabs: ApprovalTab[] = [];
    if (hubTabs.stage) tabs.push("stage");
    if (hubTabs.ready) tabs.push("ready");
    return tabs;
  }, [hubTabs.ready, hubTabs.stage]);

  const defaultTab = useMemo<ApprovalTab>(() => {
    if (hubTabs.stage && stageItems.length > 0) return "stage";
    if (hubTabs.ready && readyItems.length > 0) return "ready";
    return visibleTabs[0] ?? "stage";
  }, [hubTabs.ready, hubTabs.stage, readyItems.length, stageItems.length, visibleTabs]);

  const tabParam = searchParams.get("tab");
  // Legacy ?tab=management redirects to first allowed tab (ready for DH, else stage).
  const activeTab: ApprovalTab =
    isApprovalTab(tabParam) && visibleTabs.includes(tabParam) ? tabParam : defaultTab;

  useEffect(() => {
    if (!canAccessHub) return;
    if (!isApprovalTab(tabParam) || !visibleTabs.includes(tabParam)) {
      router.replace(`${ROUTES.quality.approvals}?tab=${defaultTab}`, { scroll: false });
    }
  }, [canAccessHub, defaultTab, router, tabParam, visibleTabs]);

  function setActiveTab(tab: ApprovalTab) {
    router.replace(`${ROUTES.quality.approvals}?tab=${tab}`, { scroll: false });
  }

  if (!canAccessHub) {
    return (
      <div className="page-shell">
        <PermissionDenied message="Approvals hub is not available for your role. Open assigned approval tasks from My Tasks." />
      </div>
    );
  }

  const isLoading = hubQuery.isLoading;
  const isError = hubQuery.isError;
  const error = hubQuery.error;
  const showTabChrome = visibleTabs.length > 1;

  function retryAll() {
    hubQuery.refetch();
  }

  const stagePanel = (
    <AppCard title={showTabChrome ? undefined : "Stage approvals"}>
      <DataTable
        columns={[
          {
            key: "design",
            header: "Design",
            render: (row) => {
              const href =
                resolveWorkOpenHref({
                  taskId: row.taskId,
                  designId: row.designId,
                  intent: "task",
                }) ?? ROUTES.designs.detail(row.designId);
              return (
                <Link href={href} className="data-table-link">
                  {row.ideaRef}
                </Link>
              );
            },
          },
          { key: "collection", header: "Collection", render: (row) => row.collectionName },
          { key: "stage", header: "Stage", render: (row) => row.stageName },
          {
            key: "work",
            header: "Work submitted",
            render: (row) => row.workStageName ?? "—",
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (row) => {
              const href =
                resolveWorkOpenHref({
                  taskId: row.taskId,
                  designId: row.designId,
                  intent: "task",
                }) ?? ROUTES.designs.detail(row.designId);
              return (
                <TableIconActionGroup>
                  <AppButtonLink
                    href={href}
                    appVariant="primary"
                    size="icon-sm"
                    className="table-icon-action"
                    title="Review"
                    aria-label="Review"
                  >
                    <IconClipboardCheck aria-hidden />
                  </AppButtonLink>
                </TableIconActionGroup>
              );
            },
          },
        ]}
        rows={stageItems}
        getRowKey={(row) => row.taskId}
        emptyTitle="No stage approvals waiting"
      />
    </AppCard>
  );

  const readyPanel = (
    <AppCard title={showTabChrome ? undefined : "Ready to approve"}>
      <DataTable
        columns={[
          {
            key: "design",
            header: "Design",
            render: (row) => (
              <Link href={ROUTES.designs.detail(row.designId)} className="data-table-link">
                {row.ideaRef}
              </Link>
            ),
          },
          { key: "collection", header: "Collection", render: (row) => row.collectionName },
          {
            key: "completed",
            header: "Workflow completed",
            render: (row) => formatCompletedAt(row.completedAt),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (row) => (
              <TableIconActionGroup>
                <AppButtonLink
                  href={ROUTES.quality.requestSignOff(row.designId)}
                  appVariant="primary"
                  size="icon-sm"
                  className="table-icon-action"
                  title="Approve for production"
                  aria-label="Approve for production"
                >
                  <IconClipboardCheck aria-hidden />
                </AppButtonLink>
              </TableIconActionGroup>
            ),
          },
        ]}
        rows={readyItems}
        getRowKey={(row) => row.designId}
        emptyTitle="No designs ready to approve for production"
      />
    </AppCard>
  );

  function panelForTab(tab: ApprovalTab) {
    if (tab === "ready") return readyPanel;
    return stagePanel;
  }

  return (
    <div className="page-shell">
      <PageHeader title="Approvals" />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={retryAll}
        skeletonVariant="table"
      >
        {showTabChrome ? (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ApprovalTab)}>
            <TabsList className="mb-4">
              {hubTabs.stage ? (
                <TabsTrigger value="stage" className="action-center-tab-trigger">
                  Stage approvals
                  <TabCountBadge count={stageItems.length} />
                </TabsTrigger>
              ) : null}
              {hubTabs.ready ? (
                <TabsTrigger value="ready" className="action-center-tab-trigger">
                  Ready to approve
                  <TabCountBadge count={readyItems.length} />
                </TabsTrigger>
              ) : null}
            </TabsList>

            {hubTabs.stage ? <TabsContent value="stage">{stagePanel}</TabsContent> : null}
            {hubTabs.ready ? <TabsContent value="ready">{readyPanel}</TabsContent> : null}
          </Tabs>
        ) : (
          panelForTab(activeTab)
        )}
      </QueryState>
    </div>
  );
}
