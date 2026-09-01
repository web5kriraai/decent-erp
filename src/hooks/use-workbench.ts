"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { ProductionInboxResponse } from "@/lib/services/production-inbox-service";

export type DesignHeadWorkbenchSummary = {
  myOpenTasks: number;
  overdueTasks: number;
  handoffPending: number;
  handoffTasks: Array<{
    id: string;
    status: string;
    design: { id: string; ideaRef: string; collectionName: string; status: string };
    subProcess: { name: string };
  }>;
  blockedDesigns: Array<{
    id: string;
    ideaRef: string;
    collectionName: string;
    status: string;
    priority: string;
  }>;
  activeDesigns: number;
  openCorrections: number;
  stageApprovals: Array<{
    taskId: string;
    designId: string;
    ideaRef: string;
    collectionName: string;
    stageName: string;
    stageCode: string;
    status: string;
    assigneeName: string | null;
    workStageName: string | null;
  }>;
};

export type ManagementWorkbenchSummary = {
  approvalPending: number;
  highPriorityPending: number;
  blockedInApproval: number;
  approvedCount: number;
  releasedCount: number;
  underDevelopment: number;
  liveReviewPending: number;
  liveReviewTasks: Array<{
    id: string;
    status: string;
    design: { id: string; ideaRef: string; collectionName: string; status: string };
    subProcess: { name: string };
  }>;
  managementLevelId: number | null;
  recentApprovalQueue: Array<{
    id: string;
    ideaRef: string;
    collectionName: string;
    status: string;
    priority: string;
    updatedAtUtc: string;
  }>;
};

export function useDesignHeadWorkbench(enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboard.designHead,
    queryFn: () => apiGet<DesignHeadWorkbenchSummary>("/api/dashboard/design-head"),
    enabled,
    staleTime: 30_000,
  });
}

export function useManagementWorkbench(enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboard.management,
    queryFn: () => apiGet<ManagementWorkbenchSummary>("/api/dashboard/management"),
    enabled,
    staleTime: 30_000,
  });
}

export function useProductionInbox(enabled = true) {
  return useQuery({
    queryKey: queryKeys.production.inbox,
    queryFn: () => apiGet<ProductionInboxResponse>("/api/production/inbox"),
    enabled,
    staleTime: 30_000,
  });
}
