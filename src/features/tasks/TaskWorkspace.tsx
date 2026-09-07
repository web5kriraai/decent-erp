"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { IconEye } from "@/components/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { TimerWidget } from "@/components/TimerWidget";
import { PermissionDenied } from "@/components/PermissionDenied";
import { TaskActionCard, TaskActionListItem } from "@/components/tasks/TaskActionCard";
import { TaskHoldDialog } from "@/components/tasks/TaskHoldDialog";
import { TaskEndDialog } from "@/components/tasks/TaskEndDialog";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/config/routes";
import {
  useActionCenter,
  useTaskMutations,
  type ActionCenterBlockedItem,
} from "@/hooks/use-tasks";
import { useHoldReasons, useChecklistItems } from "@/hooks/use-masters";
import { useTaskTimeDetail } from "@/hooks/use-time";
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
import type { DesignTask } from "@/lib/types/api";
import { computeElapsedSeconds } from "@/lib/types/api";
import { groupActionCenterTasks } from "@/lib/task-priority";
import { resolveTaskContextActions, WORKFLOW_ACTION_CODES } from "@/lib/workflow-actions";
import {
  getTaskEndDialogConfig,
  getTaskHoldDialogConfig,
  buildHandoffContextFromTask,
} from "@/lib/task-dialog-config";
import { findPriorPeerForHandoff } from "@/lib/services/stage-approval-queue";
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

/** Max task cards per lane before "+ N more" (matches pipeline board). */
const WORKSPACE_LANE_PREVIEW = 15;

type ActionTab = "actionRequired" | "blocked" | "upcoming" | "completed";

const ACTION_TABS: { id: ActionTab; label: string }[] = [
  { id: "actionRequired", label: "Action required" },
  { id: "blocked", label: "Blocked" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

function BlockedList({ items }: { items: ActionCenterBlockedItem[] }) {
  if (items.length === 0) {
    return <p className="action-center-empty">No blocked tasks.</p>;
  }
  return (
    <ul className="action-center-list">
      {items.map((item) => (
        <li key={item.taskId} className="action-center-list-item">
          <div>
            <Link href={ROUTES.designs.detail(item.design.id)} className="data-table-link">
              {item.design.ideaRef}
            </Link>
            <p className="action-center-list-meta">{item.stage}</p>
            <p className="action-center-list-detail">{item.blockedMessage}</p>
          </div>
          <AppButtonLink
            href={ROUTES.work.taskDetail(item.taskId)}
            appVariant="ghost"
            size="icon-sm"
            className="table-icon-action"
            title="View task"
            aria-label="View task"
          >
            <IconEye aria-hidden />
          </AppButtonLink>
        </li>
      ))}
    </ul>
  );
}

function TaskList({
  tasks,
  emptyMessage,
  variant = "active",
}: {
  tasks: DesignTask[];
  emptyMessage: string;
  variant?: "active" | "completed" | "upcoming";
}) {
  if (tasks.length === 0) {
    return <p className="action-center-empty">{emptyMessage}</p>;
  }
  return (
    <ul className="action-center-list">
      {tasks.map((task) => (
        <TaskActionListItem key={task.id} task={task} variant={variant} />
      ))}
    </ul>
  );
}

export function TaskWorkspace() {
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canExecute = permissions.includes(PERMISSIONS.TASK_EXECUTE);

  const centerQuery = useActionCenter(canExecute);
  const holdReasons = useHoldReasons(canExecute);
  const checklistQuery = useChecklistItems(canExecute);
  const { start, hold, resume, end, closeWorkday, isPending } = useTaskMutations();
  const canViewErp = canViewErpChain(permissions);

  const [activeTab, setActiveTab] = useState<ActionTab>("actionRequired");
  const [expandedKanbanLanes, setExpandedKanbanLanes] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [holdReasonId, setHoldReasonId] = useState<number | "">("");
  const [holdRemark, setHoldRemark] = useState("");
  const [endRemark, setEndRemark] = useState("");
  const [endStatus, setEndStatus] = useState<"CHECKING" | "COMPLETED">("CHECKING");
  const [checklistResults, setChecklistResults] = useState<Record<number, boolean>>({});
  const [checklistNote, setChecklistNote] = useState("");
  const [sampleOutcome, setSampleOutcome] = useState<
    "APPROVE" | "PASS" | "HOLD" | "REJECT" | "RESAMPLE" | ""
  >("");
  const [costEntries, setCostEntries] = useState<
    Array<{ costType: "TIME" | "MATERIAL" | "MACHINE" | "CORRECTION"; description?: string; amount: number }>
  >([]);

  const center = centerQuery.data;
  const selectedTask = (center?.actionRequired ?? []).find((t) => t.id === selectedTaskId) ?? null;
  const runningTask = (center?.actionRequired ?? []).find((t) => t.status === "RUNNING");
  const onHoldTask = (center?.actionRequired ?? []).find((t) => t.status === "ON_HOLD");
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
  const holdDialogConfig = activeTask
    ? getTaskHoldDialogConfig({
        status: activeTask.status,
        subProcess: activeTask.subProcess,
        design: activeTask.design,
        assignedEmployee: activeTask.assignedEmployee,
      })
    : null;
  const endDialogConfig = activeTask
    ? getTaskEndDialogConfig(
        {
          status: activeTask.status,
          subProcess: activeTask.subProcess,
          design: activeTask.design,
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
          },
        )
      : null;

  const elapsedSeconds = activeTask?.timeEvents
    ? computeElapsedSeconds(activeTask.timeEvents)
    : 0;

  const kanbanGroups = useMemo(
    () => groupActionCenterTasks(center?.actionRequired ?? []),
    [center?.actionRequired],
  );

  const tabCounts = useMemo(
    () => ({
      actionRequired: center?.actionRequired.length ?? 0,
      blocked: center?.blocked.length ?? 0,
      upcoming: center?.upcoming.length ?? 0,
      completed: center?.completed.length ?? 0,
    }),
    [center],
  );

  const taskChecklistItems =
    checklistQuery.data?.filter((item) => item.subProcessId === activeTask?.subProcess?.id) ?? [];

  function toggleKanbanLaneExpanded(bucket: string) {
    setExpandedKanbanLanes((current) => {
      const next = new Set(current);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }

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
    await start.mutateAsync(task.id);
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
    if (!activeTask || !endRemark.trim()) return;
    if (isSampleCheck && !sampleOutcome) return;
    const isCosting = endDialogConfig?.costingEntry === true;
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
      outputRemark: endRemark.trim(),
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
      costEntries: isCosting && costEntries.length > 0 ? costEntries : undefined,
    });
    setEndModalOpen(false);
    setEndRemark("");
    setChecklistResults({});
    setChecklistNote("");
    setSampleOutcome("");
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
    } else if (e.key === "Enter") {
      setSelectedTaskId(task.id);
    }
  }

  const hasAnyWork =
    tabCounts.actionRequired + tabCounts.blocked + tabCounts.upcoming + tabCounts.completed > 0;

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="My Action Center"
        actions={
          <AppButton
            type="button"
            appVariant="outline"
            size="sm"
            onClick={() => closeWorkday.mutate()}
            disabled={closeWorkday.isPending || !!runningTask}
            title={runningTask ? "Stop running task before closing workday" : undefined}
          >
            Close Workday
          </AppButton>
        }
      />

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

              {(center?.actionRequired ?? []).length === 0 ? (
                <p className="action-center-empty action-center-empty--inline">
                  No tasks ready for you right now. Check Blocked or Upcoming tabs.
                </p>
              ) : (
                <div className="task-workspace-kanban">
                  <div className="kanban kanban--workspace">
                    {KANBAN_COLUMNS.map(([bucket, label]) => {
                      const laneTasks = kanbanGroups[bucket] ?? [];
                      const laneExpanded = expandedKanbanLanes.has(bucket);
                      const visibleTasks = laneExpanded
                        ? laneTasks
                        : laneTasks.slice(0, WORKSPACE_LANE_PREVIEW);
                      const hiddenCount = laneExpanded
                        ? 0
                        : Math.max(0, laneTasks.length - WORKSPACE_LANE_PREVIEW);

                      return (
                        <div key={bucket} className="kanban-column">
                          <div className="kanban-column-header">
                            <span className="kanban-column-title">{label}</span>
                            <span className="kanban-column-count">{laneTasks.length}</span>
                          </div>
                          <div className="kanban-cards">
                            {visibleTasks.map((task) => {
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
                            })}
                            {laneTasks.length === 0 ? (
                              <p className="kanban-empty">No tasks</p>
                            ) : null}
                            {hiddenCount > 0 ? (
                              <button
                                type="button"
                                className="kanban-lane-more"
                                onClick={() => toggleKanbanLaneExpanded(bucket)}
                              >
                                +{hiddenCount} more tasks
                              </button>
                            ) : null}
                            {laneExpanded && laneTasks.length > WORKSPACE_LANE_PREVIEW ? (
                              <button
                                type="button"
                                className="kanban-lane-more"
                                onClick={() => toggleKanbanLaneExpanded(bucket)}
                              >
                                Show fewer tasks
                              </button>
                            ) : null}
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

          <TabsContent value="blocked">
            <BlockedList items={center?.blocked ?? []} />
          </TabsContent>

          <TabsContent value="upcoming">
            <TaskList
              tasks={center?.upcoming ?? []}
              emptyMessage="No upcoming tasks - prior stages will unlock work for you."
              variant="upcoming"
            />
          </TabsContent>

          <TabsContent value="completed">
            <TaskList
              tasks={center?.completed ?? []}
              emptyMessage="No recently completed tasks."
              variant="completed"
            />
          </TabsContent>
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
        gateForcesChecking={endDialogConfig?.forceChecking}
        dialogTitle={endDialogConfig?.title}
        dialogDescription={endDialogConfig?.description}
        remarkLabel={endDialogConfig?.remarkLabel}
        remarkPlaceholder={endDialogConfig?.remarkPlaceholder}
        handoff={endHandoff}
        showStatusSelect={endDialogConfig?.showStatusSelect}
        costEntries={costEntries}
        onCostEntriesChange={setCostEntries}
        onSubmit={handleEndSubmit}
        isPending={end.isPending}
      />
    </div>
  );
}
