"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { TimerWidget } from "@/components/TimerWidget";
import { PermissionDenied } from "@/components/PermissionDenied";
import { TaskActionCard } from "@/components/tasks/TaskActionCard";
import { ActionCenterRecordsTable } from "@/components/tasks/ActionCenterRecordsTable";
import { TaskHoldDialog } from "@/components/tasks/TaskHoldDialog";
import { TaskEndDialog } from "@/components/tasks/TaskEndDialog";
import { earlierDesignerStages } from "@/components/tasks/DesignerTimePanel";
import type { SampleCorrectionRoute } from "@/lib/services/sample-outcome-utils";
import { CloseWorkdayConfirm } from "@/components/tasks/CloseWorkdayConfirm";
import { WorkdayStatusBanner } from "@/features/time/WorkdayStatusBanner";
import { AppButton } from "@/components/ui/AppButton";
import { ListSearch } from "@/components/ui/ListSearch";
import { ListSelectFilter } from "@/components/ui/ListSelectFilter";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { ListRefreshButton } from "@/components/ui/ListRefreshButton";
import { AppCard } from "@/components/ui/AppCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/config/routes";
import {
  useActionCenter,
  useTaskMutations,
} from "@/hooks/use-tasks";
import { useHoldReasons, useChecklistItems } from "@/hooks/use-masters";
import { useMyTimeSummary, useTaskTimeDetail } from "@/hooks/use-time";
import {
  useErpStageAction,
  useErpStageChainForDesign,
} from "@/hooks/use-production";
import { canViewErpChain } from "@/lib/erp-rbac";
import {
  ErpStageOperator,
  floorProgressFromChain,
} from "@/features/production/ErpStageOperator";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignTask, Priority } from "@/lib/types/api";
import { useLiveTimeSummary } from "@/hooks/use-live-time-summary";
import { groupActionCenterTasks } from "@/lib/task-priority";
import { resolveTaskContextActions, WORKFLOW_ACTION_CODES } from "@/lib/workflow-actions";
import {
  getTaskEndDialogConfig,
  getTaskHoldDialogConfig,
  buildHandoffContextFromTask,
  handoffTimeFromSummary,
} from "@/lib/task-dialog-config";
import { findNextPeerForHandoff, findPriorPeerForHandoff } from "@/lib/services/stage-approval-queue";
import { getTimerControlFlags } from "@/lib/task-control-capability";
import { resolveWorkOpenHref } from "@/lib/resolve-work-open-href";
import { usesStageApprovalActionsNotTimerEnd } from "@/lib/stage-approval-rbac";
import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";
import { cn } from "@/lib/utils";

const KANBAN_COLUMNS = [
  ["READY", "Ready to Start"],
  ["CORRECTION_REQUIRED", "Rework"],
  ["RUNNING", "In Progress"],
  ["ON_HOLD", "On Hold"],
] as const;

const PRIORITY_FILTER_OPTIONS: { value: Priority | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Priority" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

type ActionTab = "actionRequired" | "blocked" | "upcoming" | "completed";

const ACTION_TABS: { id: ActionTab; label: string }[] = [
  { id: "actionRequired", label: "Action required" },
  { id: "blocked", label: "Blocked" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

export function TaskWorkspace() {
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canExecute = permissions.includes(PERMISSIONS.TASK_EXECUTE);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, priorityFilter, stageFilter, pageSize]);

  const timeSummaryQuery = useMyTimeSummary(canExecute);
  const workdayClosed = !!timeSummaryQuery.data?.workdayClosed;
  const centerQuery = useActionCenter(
    {
      page,
      pageSize,
      q: searchQuery,
      priority: priorityFilter,
      stage: stageFilter,
    },
    canExecute,
  );
  const holdReasons = useHoldReasons(canExecute);
  const checklistQuery = useChecklistItems(canExecute);
  const { start, hold, resume, end, closeWorkday, openWorkday, isPending } = useTaskMutations();
  const canViewErp = canViewErpChain(permissions);

  const [activeTab, setActiveTab] = useState<ActionTab>("actionRequired");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [closeWorkdayOpen, setCloseWorkdayOpen] = useState(false);
  const [holdReasonId, setHoldReasonId] = useState<number | "">("");
  const [holdRemark, setHoldRemark] = useState("");
  const [endRemark, setEndRemark] = useState("");
  const [endStatus, setEndStatus] = useState<"CHECKING" | "COMPLETED">("CHECKING");
  const [checklistResults, setChecklistResults] = useState<Record<number, boolean>>({});
  const [checklistNote, setChecklistNote] = useState("");
  const [sampleOutcome, setSampleOutcome] = useState<
    "APPROVE" | "PASS" | "HOLD" | "REJECT" | "RESAMPLE" | ""
  >("");
  const [correctionRoute, setCorrectionRoute] = useState<SampleCorrectionRoute | "">("");
  const [costEntries, setCostEntries] = useState<
    Array<{ costType: "TIME" | "MATERIAL" | "MACHINE" | "CORRECTION"; description?: string; amount: number }>
  >([]);

  const center = centerQuery.data;
  const selectedTask = (center?.actionRequired ?? []).find((t) => t.id === selectedTaskId) ?? null;
  const timerTask = center?.activeTimerTask ?? null;
  const runningTask =
    timerTask?.status === "RUNNING"
      ? timerTask
      : (center?.actionRequired ?? []).find((t) => t.status === "RUNNING");
  const onHoldTask =
    timerTask?.status === "ON_HOLD"
      ? timerTask
      : (center?.actionRequired ?? []).find((t) => t.status === "ON_HOLD");
  const activeTask = runningTask ?? onHoldTask ?? selectedTask;
  const isTimerActive = !!(runningTask || onHoldTask);
  const activeDetailQuery = useTaskTimeDetail(
    activeTask?.id ?? "",
    !!activeTask && isTimerActive,
  );
  const activeDetail = activeDetailQuery.data;

  const isProdReleaseActive =
    !!activeTask &&
    resolveStageBehavior({
      code: activeTask.subProcess.code,
      isApproval: activeTask.subProcess.isApproval,
      capabilities: (activeTask.subProcess as { capabilities?: unknown }).capabilities,
    }).onComplete.includes("unlockErp");
  const showErpOnWorkspace = isProdReleaseActive && isTimerActive && canViewErp;
  const erpChainQuery = useErpStageChainForDesign(
    activeTask?.design?.id,
    showErpOnWorkspace,
  );
  const erpStageAction = useErpStageAction();
  const floorProgress = floorProgressFromChain(erpChainQuery.data);

  const timerActions = useMemo(() => {
    if (!activeTask || !isTimerActive) return [];
    return resolveTaskContextActions({
      task: {
        id: activeTask.id,
        designId: activeTask.design?.id ?? "",
        status: activeTask.status,
        sequence: activeTask.sequence,
        dependencySequence: activeTask.dependencySequence ?? null,
        assignedEmployeeId: activeTask.assignedEmployeeId ?? null,
        subProcess: activeTask.subProcess,
      },
      isAssignee: true,
      permissions,
    });
  }, [activeTask, isTimerActive, permissions]);

  const canHold = timerActions.some((a) => a.code === WORKFLOW_ACTION_CODES.HOLD_TASK && a.enabled);
  const canResume = timerActions.some(
    (a) => a.code === WORKFLOW_ACTION_CODES.RESUME_TASK && a.enabled,
  );

  const fileRequired = !!activeTask?.subProcess?.isFileRequired;
  const isSampleCheck = activeTask?.subProcess?.code === "SAMPLE_CHECK";
  const dialogDesign = activeTask
    ? {
        ideaRef: activeTask.design.ideaRef,
        collectionName: activeTask.design.collectionName,
        priority: activeTask.design.priority,
        productType: activeDetail?.design.productType ?? activeTask.design.productType?.name ?? null,
      }
    : undefined;
  const holdDialogConfig = activeTask
    ? getTaskHoldDialogConfig({
        status: activeTask.status,
        subProcess: activeTask.subProcess,
        design: dialogDesign,
        assignedEmployee: activeTask.assignedEmployee,
      })
    : null;
  const endDialogConfig = activeTask
    ? getTaskEndDialogConfig(
        {
          status: activeTask.status,
          subProcess: activeTask.subProcess,
          design: dialogDesign,
          assignedEmployee: activeTask.assignedEmployee,
        },
        session?.user?.roleCode,
      )
    : null;

  const blocksTimerEnd = usesStageApprovalActionsNotTimerEnd(activeTask?.subProcess?.code, {
    isApproval: activeTask?.subProcess?.isApproval,
    capabilities: (activeTask?.subProcess as { capabilities?: unknown } | undefined)?.capabilities,
  });
  const timerFlags = activeTask
    ? getTimerControlFlags(activeTask, { endDialogMode: endDialogConfig?.mode })
    : null;
  const canEnd =
    !!timerFlags?.showEnd &&
    timerActions.some((a) => a.code === WORKFLOW_ACTION_CODES.END_TASK && a.enabled);

  const priorPeer =
    activeTask && activeDetail?.workflowPeers
      ? findPriorPeerForHandoff(activeTask.subProcess.code, activeDetail.workflowPeers)
      : null;
  const priorStage = priorPeer
    ? {
        code: priorPeer.subProcess.code,
        name: priorPeer.subProcess.name,
        status: priorPeer.status,
        outputRemark: priorPeer.outputRemark,
        assigneeName: priorPeer.assignedEmployee?.name,
      }
    : null;
  const nextPeer = activeDetail
    ? findNextPeerForHandoff(
        { id: activeDetail.id, sequence: activeDetail.sequence },
        activeDetail.workflowPeers,
      )
    : null;
  const nextStage = nextPeer
    ? {
        code: nextPeer.subProcess.code,
        name: nextPeer.subProcess.name,
        assigneeName: nextPeer.assignedEmployee?.name ?? null,
      }
    : null;

  const liveSummary = useLiveTimeSummary(
    activeDetail?.timeline,
    activeDetail?.status === "RUNNING" || activeDetail?.status === "ON_HOLD",
  );
  const elapsedSeconds = liveSummary?.activeSeconds ?? 0;

  const holdHandoff =
    activeTask && holdDialogConfig
      ? buildHandoffContextFromTask(
          {
            status: activeTask.status,
            subProcess: activeTask.subProcess,
            design: {
              ideaRef: activeTask.design?.ideaRef,
              collectionName: activeTask.design?.collectionName,
              productType: activeDetail?.design.productType ?? undefined,
            },
            assignedEmployee: activeTask.assignedEmployee,
          },
          {
            description: holdDialogConfig.description,
            nextStepHint: holdDialogConfig.nextStepHint,
            priorStage,
            ...handoffTimeFromSummary(liveSummary ?? activeDetail?.timeSummary, activeTask.expectedMinutes),
            nextStage,
          },
        )
      : null;

  const endHandoff =
    activeTask && endDialogConfig
      ? buildHandoffContextFromTask(
          {
            status: activeTask.status,
            subProcess: activeTask.subProcess,
            design: {
              ideaRef: activeTask.design?.ideaRef,
              collectionName: activeTask.design?.collectionName,
              productType: activeDetail?.design.productType ?? undefined,
            },
            assignedEmployee: activeTask.assignedEmployee,
          },
          {
            description: endDialogConfig.description,
            nextStepHint: endDialogConfig.nextStepHint,
            priorStage,
            ...handoffTimeFromSummary(liveSummary ?? activeDetail?.timeSummary, activeTask.expectedMinutes),
            nextStage,
          },
        )
      : null;

  const kanbanGroups = useMemo(
    () => groupActionCenterTasks(center?.actionRequired ?? []),
    [center?.actionRequired],
  );

  const tabCounts = center?.tabTotals ?? {
    actionRequired: 0,
    blocked: 0,
    upcoming: 0,
    completed: 0,
  };
  const pageTotal =
    activeTab === "actionRequired"
      ? (center?.pagination.total ?? 0)
      : tabCounts[activeTab];

  const taskChecklistItems =
    checklistQuery.data?.filter((item) => item.subProcessId === activeTask?.subProcess?.id) ?? [];

  if (!canExecute) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TASK_EXECUTE} />
      </div>
    );
  }

  async function handleStart(task: DesignTask) {
    if (!task.canStart) return;
    setSelectedTaskId(task.id);
    try {
      await start.mutateAsync(task.id);
    } catch {
      // Toast is handled by useTaskMutations.onError
      return;
    }
    const href = resolveWorkOpenHref({
      taskId: task.id,
      designId: task.design?.id ?? task.designId,
      intent: "task",
    });
    if (href) router.push(href);
  }

  async function handleHoldSubmit() {
    if (!activeTask || !holdReasonId) return;
    await hold.mutateAsync({
      taskId: activeTask.id,
      holdReasonId: Number(holdReasonId),
      remark: holdRemark || undefined,
      version: activeTask.version,
    });
    setHoldModalOpen(false);
    setHoldRemark("");
  }

  async function handleEndSubmit() {
    if (!activeTask) return;
    const isCosting = endDialogConfig?.costingEntry === true;
    if (isCosting && !endRemark.trim()) return;
    if (isSampleCheck && !sampleOutcome) return;
    if (
      isSampleCheck &&
      sampleOutcome === "REJECT" &&
      (!correctionRoute || !endRemark.trim())
    ) {
      return;
    }
    const checklist = taskChecklistItems.map((item) => ({
      itemId: item.id,
      result: checklistResults[item.id] ?? false,
    }));
    const passed = checklist.filter((c) => c.result).length;
    const failed = checklist.length - passed;
    if (checklist.length > 0 && passed === 0) return;
    if (failed > 0 && !checklistNote.trim()) return;
    if (
      isSampleCheck &&
      (sampleOutcome === "APPROVE" || sampleOutcome === "PASS") &&
      failed > 0
    ) {
      return;
    }

    const note = checklistNote.trim() || undefined;
    await end.mutateAsync({
      taskId: activeTask.id,
      version: activeTask.version,
      outputRemark: endRemark.trim() || "Completed",
      completionStatus: isSampleCheck
        ? sampleOutcome === "REJECT"
          ? "CHECKING"
          : "COMPLETED"
        : isCosting || endDialogConfig?.forceChecking
          ? "CHECKING"
          : endStatus,
      checklist: checklist.length
        ? checklist.map((c) => (c.result ? c : { ...c, remark: note }))
        : undefined,
      checklistNote: note,
      sampleOutcome: isSampleCheck && sampleOutcome ? sampleOutcome : undefined,
      correctionRoute:
        isSampleCheck && sampleOutcome === "REJECT" && correctionRoute
          ? correctionRoute
          : undefined,
      costEntries: isCosting && costEntries.length > 0 ? costEntries : undefined,
    });
    setEndModalOpen(false);
    setEndRemark("");
    setChecklistResults({});
    setChecklistNote("");
    setSampleOutcome("");
    setCorrectionRoute("");
    setCostEntries([]);
    setSelectedTaskId(null);
  }

  function handleTaskCardKeyDown(e: React.KeyboardEvent, task: DesignTask) {
    const showStart =
      (task.status === "ASSIGNED" ||
        task.status === "CORRECTION_REQUIRED" ||
        task.status === "PENDING") &&
      task.canStart;
    if (e.key === "Enter" && showStart) {
      e.preventDefault();
      void handleStart(task);
    }
  }

  const hasAnyWork = center
    ? center.totals.actionRequired +
        center.totals.blocked +
        center.totals.upcoming +
        center.totals.completed >
      0
    : false;

  return (
    <div className="page-shell page-shell--wide list-page">
      <PageHeader
        title="My Action Center"
        className="list-page__header"
        actions={
          <>
            <ListRefreshButton
              onRefresh={() => centerQuery.refetch()}
              isRefreshing={centerQuery.isFetching}
            />
            {workdayClosed ? (
              <AppButton
                type="button"
                size="sm"
                onClick={() => openWorkday.mutate()}
                disabled={openWorkday.isPending}
              >
                {openWorkday.isPending ? "Opening…" : "Open Workday"}
              </AppButton>
            ) : (
              <AppButton
                type="button"
                appVariant="outline"
                size="sm"
                onClick={() => setCloseWorkdayOpen(true)}
                disabled={closeWorkday.isPending || !!runningTask}
                title={runningTask ? "Stop running task before closing workday" : undefined}
              >
                Close Workday
              </AppButton>
            )}
          </>
        }
      />

      <WorkdayStatusBanner />

      <QueryState
        isLoading={centerQuery.isLoading}
        isError={centerQuery.isError}
        error={centerQuery.error}
        isEmpty={!hasAnyWork}
        emptyTitle="No tasks assigned yet"
        skeletonVariant="cards"
        onRetry={() => centerQuery.refetch()}
      >
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as ActionTab)}
          className="action-center-tabs-root"
        >
          <TabsList className="action-center-tabs-list mb-4">
            {ACTION_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="action-center-tab-trigger">
                {tab.label}
                <span className="action-center-tab-count">{tabCounts[tab.id]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div
            className="workflow-dash-filters list-filter-group mb-4"
            role="group"
            aria-label="Task filters"
          >
            <ListSearch
              id="my-tasks-search"
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search idea, collection, or stage…"
              aria-label="Search tasks"
              className="workflow-dash-search"
            />
            <ListSelectFilter
              id="my-tasks-priority"
              label="Priority"
              value={priorityFilter}
              onChange={(value) => setPriorityFilter((value || "ALL") as Priority | "ALL")}
              options={PRIORITY_FILTER_OPTIONS}
            />
            <ListSelectFilter
              id="my-tasks-stage"
              label="Stage"
              value={stageFilter}
              onChange={(value) => setStageFilter(value || "ALL")}
              options={[
                { value: "ALL", label: "All stages" },
                ...(center?.stages ?? []).map((stage) => ({ value: stage, label: stage })),
              ]}
            />
          </div>

          <TabsContent value="actionRequired">
            <div className="task-workspace-layout">
              <TimerWidget
                compact
                status={runningTask ? "RUNNING" : onHoldTask ? "ON_HOLD" : "IDLE"}
                elapsedSeconds={elapsedSeconds}
                taskLabel={
                  activeTask && isTimerActive
                    ? `${activeTask.design.ideaRef} · ${activeTask.subProcess.name}`
                    : undefined
                }
                onHold={
                  canHold && runningTask
                    ? () => {
                        setHoldModalOpen(true);
                        setHoldReasonId("");
                      }
                    : undefined
                }
                onResume={
                  canResume && onHoldTask
                    ? () => resume.mutate({ taskId: activeTask!.id, version: activeTask!.version })
                    : undefined
                }
                onEnd={
                  canEnd && (runningTask || onHoldTask)
                    ? () => {
                        setEndModalOpen(true);
                        setEndRemark("");
                        setChecklistNote("");
                        setSampleOutcome("");
                        setChecklistResults({});
                        setEndStatus("CHECKING");
                      }
                    : undefined
                }
              />
              {blocksTimerEnd && isTimerActive ? (
                <p className="mb-3 text-sm text-muted-foreground" role="status">
                  This is a stage approval - finish with Approve / Reject on the task page. Hold
                  still works here.
                </p>
              ) : null}

              {showErpOnWorkspace ? (
                <AppCard
                  title="ERP Chain"
                  className="erp-chain-task-panel mb-4"
                  headerAction={
                    <span
                      className={cn(
                        "erp-chain-floor-chip",
                        floorProgress.ok && "erp-chain-floor-chip--ok",
                      )}
                    >
                      Floor {floorProgress.completed}/{floorProgress.total}
                    </span>
                  }
                >
                  {erpChainQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground m-0">Loading ERP stages…</p>
                  ) : erpChainQuery.data ? (
                    <ErpStageOperator
                      chain={erpChainQuery.data}
                      permissions={permissions}
                      isPending={erpStageAction.isPending}
                      showFloorChip={false}
                      onStart={(stageId) =>
                        erpStageAction.mutate({ stageId, action: "start" })
                      }
                      onComplete={(stageId, payload) =>
                        erpStageAction.mutate({ stageId, action: "complete", ...payload })
                      }
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground m-0">
                      Start Production Release to seed Floor ERP stages.
                    </p>
                  )}
                  {!floorProgress.ok ? (
                    <p className="mt-2 mb-0 text-sm text-amber-800" role="status">
                      Complete Floor stages before ending this task.
                    </p>
                  ) : null}
                </AppCard>
              ) : null}

              {tabCounts.actionRequired === 0 ? (
                <p className="action-center-empty action-center-empty--inline">
                  No tasks ready for you right now. Check Blocked or Upcoming tabs.
                </p>
              ) : (
                <div className="task-workspace-kanban">
                  <div className="kanban kanban--workspace">
                    {KANBAN_COLUMNS.map(([bucket, label]) => {
                      const laneTasks = kanbanGroups[bucket] ?? [];
                      const laneTotal = center?.laneCounts?.[bucket] ?? laneTasks.length;

                      return (
                        <div key={bucket} className="kanban-column">
                          <div className="kanban-column-header">
                            <span className="kanban-column-title">{label}</span>
                            <span className="kanban-column-count">{laneTotal}</span>
                          </div>
                          <div className="kanban-cards">
                            {laneTotal === 0 ? (
                              <p className="kanban-empty">No tasks</p>
                            ) : (
                              laneTasks.map((task) => {
                                const isActiveCard = task.id === activeTask?.id && isTimerActive;
                                const showStartButton =
                                  bucket === "READY" || bucket === "CORRECTION_REQUIRED";
                                return (
                                  <TaskActionCard
                                    key={task.id}
                                    task={task}
                                    selected={selectedTaskId === task.id}
                                    active={isActiveCard}
                                    showStartButton={showStartButton}
                                    isPending={isPending}
                                    onSelect={() => setSelectedTaskId(task.id)}
                                    onStart={() => void handleStart(task)}
                                    onKeyDown={(e) => handleTaskCardKeyDown(e, task)}
                                  />
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {selectedTask && !isTimerActive ? (
              <p className="task-workspace-selected">
                Selected:{" "}
                <Link href={ROUTES.work.taskDetail(selectedTask.id)} className="data-table-link">
                  {selectedTask.design.ideaRef} · {selectedTask.subProcess.name}
                </Link>
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="blocked" className="action-center-tab-panel">
            <ActionCenterRecordsTable
              mode="blocked"
              items={center?.blocked ?? []}
              onRefresh={() => centerQuery.refetch()}
              isRefreshing={centerQuery.isFetching}
            />
          </TabsContent>

          <TabsContent value="upcoming" className="action-center-tab-panel">
            <ActionCenterRecordsTable
              mode="upcoming"
              items={center?.upcoming ?? []}
              onRefresh={() => centerQuery.refetch()}
              isRefreshing={centerQuery.isFetching}
            />
          </TabsContent>

          <TabsContent value="completed" className="action-center-tab-panel">
            <ActionCenterRecordsTable
              mode="completed"
              items={center?.completed ?? []}
              onRefresh={() => centerQuery.refetch()}
              isRefreshing={centerQuery.isFetching}
            />
          </TabsContent>
          <PaginationBar
            total={pageTotal}
            page={center?.pagination.page ?? page}
            pageSize={center?.pagination.pageSize ?? pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeSelectId="my-tasks-page-size"
            className="list-page__pagination"
          />
        </Tabs>
      </QueryState>

      <TaskHoldDialog
        open={holdModalOpen}
        onClose={() => setHoldModalOpen(false)}
        holdReasons={holdReasons.data ?? []}
        holdReasonId={holdReasonId}
        onHoldReasonChange={setHoldReasonId}
        holdRemark={holdRemark}
        onHoldRemarkChange={setHoldRemark}
        onSubmit={handleHoldSubmit}
        isPending={hold.isPending}
        title={holdDialogConfig?.title}
        description={holdDialogConfig?.description}
        preferredHoldReasonCodes={holdDialogConfig?.preferredHoldReasonCodes}
        remarkLabel={holdDialogConfig?.remarkLabel}
        remarkPlaceholder={holdDialogConfig?.remarkPlaceholder}
        handoff={holdHandoff}
      />

      <TaskEndDialog
        open={endModalOpen && canEnd}
        onClose={() => {
          setEndModalOpen(false);
          setCostEntries([]);
        }}
        endStatus={endStatus}
        onEndStatusChange={setEndStatus}
        endRemark={endRemark}
        onEndRemarkChange={setEndRemark}
        checklistItems={taskChecklistItems}
        checklistResults={checklistResults}
        onChecklistChange={(itemId, checked) =>
          setChecklistResults((prev) => ({ ...prev, [itemId]: checked }))
        }
        checklistNote={checklistNote}
        onChecklistNoteChange={setChecklistNote}
        fileRequired={endDialogConfig?.fileRequired ?? fileRequired}
        taskId={activeTask?.id}
        designId={activeTask?.design.id}
        subProcessCode={activeTask?.subProcess.code}
        subProcessName={activeTask?.subProcess.name}
        isSampleCheck={endDialogConfig?.showSampleOutcomes ?? isSampleCheck}
        sampleOutcome={sampleOutcome || undefined}
        onSampleOutcomeChange={setSampleOutcome}
        correctionRoute={correctionRoute}
        onCorrectionRouteChange={setCorrectionRoute}
        gateForcesChecking={endDialogConfig?.forceChecking}
        dialogTitle={endDialogConfig?.title}
        dialogDescription={endDialogConfig?.description}
        remarkLabel={endDialogConfig?.remarkLabel}
        remarkPlaceholder={endDialogConfig?.remarkPlaceholder}
        handoff={endHandoff}
        priorPunching={activeDetail?.priorPunching}
        designerStages={
          activeDetail && activeTask?.subProcess.code === "COSTING"
            ? earlierDesignerStages(activeDetail.workflowPeers, {
                id: activeDetail.id,
                sequence: activeDetail.sequence,
              })
            : undefined
        }
        showStatusSelect={endDialogConfig?.showStatusSelect}
        costEntries={costEntries}
        onCostEntriesChange={setCostEntries}
        onSubmit={handleEndSubmit}
        isPending={end.isPending}
      />

      <CloseWorkdayConfirm
        open={closeWorkdayOpen}
        onClose={() => setCloseWorkdayOpen(false)}
        isPending={closeWorkday.isPending}
        onConfirm={() => {
          closeWorkday.mutate(undefined, {
            onSuccess: () => setCloseWorkdayOpen(false),
          });
        }}
      />
    </div>
  );
}
