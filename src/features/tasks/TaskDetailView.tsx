"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBreadcrumbReplacement } from "@/components/layout/BreadcrumbProvider";
import { QueryState } from "@/components/ui/QueryState";
import { TimerWidget } from "@/components/TimerWidget";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { resolveListItemDisplayStatus } from "@/lib/task-action-display";
import { PermissionDenied } from "@/components/PermissionDenied";
import { SkeletonRows } from "@/components/SkeletonRows";
import { TaskTimeTimeline } from "@/components/time/TaskTimeTimeline";
import { TaskHoldDialog } from "@/components/tasks/TaskHoldDialog";
import { TaskEndDialog } from "@/components/tasks/TaskEndDialog";
import { earlierDesignerStages } from "@/components/tasks/DesignerTimePanel";
import { useLiveTimeSummary } from "@/hooks/use-live-time-summary";
import type { SampleCorrectionRoute } from "@/lib/services/sample-outcome-utils";
import { TaskQualityContextPanel } from "@/components/tasks/TaskQualityContextPanel";
import {
  isStageApprovalTask,
  TaskStageApprovalPanel,
} from "@/components/tasks/TaskStageApprovalPanel";
import { ActionUnavailable } from "@/components/ui/ActionUnavailable";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ROUTES } from "@/config/routes";
import { useTaskTimeDetail } from "@/hooks/use-time";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useHoldReasons, useChecklistItems } from "@/hooks/use-masters";
import {
  useErpStageAction,
  useErpStageChainForDesign,
} from "@/hooks/use-production";
import { canViewErpChain } from "@/lib/erp-rbac";
import {
  ErpStageOperator,
  floorProgressFromChain,
} from "@/features/production/ErpStageOperator";
import { ApiClientError } from "@/lib/api-client";
import { humanizeApiError } from "@/lib/humanize-api-error";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { PERMISSIONS } from "@/lib/permissions";
import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";
import { formatDuration } from "@/lib/services/time-calculation";
import { formatTaskDeadline, formatTaskStamp, resolveTaskAssignedAt } from "@/lib/task-action-display";
import { TaskDesignBrief } from "@/features/tasks/TaskDesignBrief";
import { workSubProcessCodeForApproval } from "@/lib/services/stage-approval-queue";
import {
  canControlTask,
  getTimerControlFlags,
} from "@/lib/task-control-capability";
import {
  getTaskEndDialogConfig,
  getTaskHoldDialogConfig,
  buildHandoffContextFromTask,
  handoffTimeFromSummary,
} from "@/lib/task-dialog-config";
import { findNextPeerForHandoff, findPriorPeerForHandoff } from "@/lib/services/stage-approval-queue";
import { nextStepHintForStageApproval } from "@/lib/stage-approval-rbac";
import { cn } from "@/lib/utils";

type TaskDetailViewProps = {
  taskId: string;
  designId?: string;
};

export function TaskDetailView({ taskId, designId }: TaskDetailViewProps) {
  const { data: session, status: sessionStatus } = useSession();
  const permissions = useMemo(
    () => session?.user?.permissions ?? [],
    [session?.user?.permissions],
  );
  const canExecute = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const canViewErp = canViewErpChain(permissions);
  const enabled = sessionStatus === "authenticated" && canExecute;

  const detailQuery = useTaskTimeDetail(taskId, enabled);
  const holdReasons = useHoldReasons(canExecute && enabled);
  const checklistQuery = useChecklistItems(canExecute && enabled);
  const { start, hold, resume, end, openWorkday } = useTaskMutations();

  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [holdReasonId, setHoldReasonId] = useState<number | "">("");
  const [holdRemark, setHoldRemark] = useState("");
  const [endRemark, setEndRemark] = useState("");
  const [endError, setEndError] = useState<string | null>(null);
  const [endStatus, setEndStatus] = useState<"CHECKING" | "COMPLETED">("CHECKING");
  const [checklistResults, setChecklistResults] = useState<Record<number, boolean>>({});
  const [checklistNote, setChecklistNote] = useState("");
  const [sampleOutcome, setSampleOutcome] = useState<
    "APPROVE" | "PASS" | "HOLD" | "REJECT" | "RESAMPLE" | ""
  >(
    "",
  );
  const [correctionRoute, setCorrectionRoute] = useState<SampleCorrectionRoute | "">("");
  const [costEntries, setCostEntries] = useState<
    Array<{ costType: "TIME" | "MATERIAL" | "MACHINE" | "CORRECTION"; description?: string; amount: number }>
  >([]);

  const task = detailQuery.data;
  const isProdReleaseTask = !!task
    ? resolveStageBehavior({
        code: task.subProcess.code,
        isApproval: task.subProcess.isApproval,
        capabilities: task.subProcess.capabilities,
      }).onComplete.includes("unlockErp")
    : false;
  const showErpOnTask =
    isProdReleaseTask &&
    canViewErp &&
    (task?.status === "RUNNING" || task?.status === "ON_HOLD" || task?.status === "ASSIGNED");
  const erpChainQuery = useErpStageChainForDesign(
    task?.design?.id ?? task?.designId,
    enabled && showErpOnTask,
  );
  const erpStageAction = useErpStageAction();
  const floorProgress = floorProgressFromChain(erpChainQuery.data);
  useBreadcrumbReplacement(
    taskId,
    task ? `${task.design.ideaRef} · ${task.subProcess.name}` : undefined,
  );
  const roleCode = session?.user?.roleCode;
  const canAssign = permissions.includes(PERMISSIONS.DESIGN_ASSIGN);
  const isStageApproval = isStageApprovalTask(task?.subProcess?.code, {
    isApproval: task?.subProcess?.isApproval,
    capabilities: task?.subProcess?.capabilities,
  });
  const ownerRoleCode = task?.subProcess?.defaultRole?.code ?? null;
  const canControl = task
    ? canControlTask({
        permissions,
        employeeId: session?.user?.employeeId,
        roleCode,
        task,
      })
    : false;
  const designMismatch =
    !!task && !!designId && task.designId !== designId && task.design.id !== designId;

  const liveSummary = useLiveTimeSummary(
    task?.timeline,
    task?.status === "RUNNING" || task?.status === "ON_HOLD",
  );
  const activeSeconds = liveSummary?.activeSeconds ?? task?.timeSummary.activeSeconds ?? 0;
  const holdSeconds = liveSummary?.holdSeconds ?? task?.timeSummary.holdSeconds ?? 0;
  const backHref = designId ? ROUTES.designs.detail(designId) : ROUTES.work.tasks;
  const backLabel = designId ? "Back to Design" : "Back to My Tasks";

  const fileRequired = !!task?.subProcess?.isFileRequired;
  const isSampleCheck = task?.subProcess?.code === "SAMPLE_CHECK";

  const linkedWorkTaskStatus = useMemo(() => {
    if (!task?.workflowPeers) return undefined;
    const peerCode = workSubProcessCodeForApproval(
      task.subProcess.code,
      task.subProcess.capabilities,
    );
    if (!peerCode) return undefined;
    return task.workflowPeers.find((peer) => peer.subProcess.code === peerCode)?.status;
  }, [task]);

  if (sessionStatus === "loading") {
    return (
      <div className="page-shell">
        <SkeletonRows variant="cards" />
      </div>
    );
  }

  if (sessionStatus === "authenticated" && !canExecute) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TASK_EXECUTE} />
      </div>
    );
  }

  async function handleHoldSubmit() {
    if (!task || !holdReasonId) return;
    await hold.mutateAsync({
      taskId: task.id,
      holdReasonId: Number(holdReasonId),
      remark: holdRemark || undefined,
      version: task.version,
    });
    setHoldModalOpen(false);
    setHoldRemark("");
  }

  const taskChecklistItems =
    checklistQuery.data?.filter((item) => item.subProcessId === task?.subProcess?.id) ?? [];

  const holdDialogConfig = task
    ? getTaskHoldDialogConfig({
        status: task.status,
        subProcess: task.subProcess,
        design: task.design,
        assignedEmployee: task.assignedEmployee,
      })
    : null;
  const endDialogConfig = task
    ? getTaskEndDialogConfig(
        {
          status: task.status,
          subProcess: task.subProcess,
          design: task.design,
          assignedEmployee: task.assignedEmployee,
        },
        roleCode,
      )
    : null;

  const timerFlags = task
    ? getTimerControlFlags(task, { endDialogMode: endDialogConfig?.mode })
    : null;
  const isRunning = timerFlags?.isRunning ?? false;
  const isOnHold = timerFlags?.isOnHold ?? false;

  const priorPeer = task
    ? findPriorPeerForHandoff(task.subProcess.code, task.workflowPeers)
    : null;
  const nextPeer = task
    ? findNextPeerForHandoff({ id: task.id, sequence: task.sequence }, task.workflowPeers)
    : null;
  const nextStage = nextPeer
    ? {
        code: nextPeer.subProcess.code,
        name: nextPeer.subProcess.name,
        status: nextPeer.status,
        assigneeName: nextPeer.assignedEmployee?.name ?? null,
      }
    : null;

  const holdHandoff = task && holdDialogConfig
    ? buildHandoffContextFromTask(
        {
          status: task.status,
          subProcess: task.subProcess,
            design: {
              ideaRef: task.design.ideaRef,
              collectionName: task.design.collectionName,
              productType: task.design.productType ?? undefined,
            },
            assignedEmployee: task.assignedEmployee,
          },
          {
            description: holdDialogConfig.description,
            nextStepHint: holdDialogConfig.nextStepHint,
            priorStage: priorPeer
              ? {
                  code: priorPeer.subProcess.code,
                  name: priorPeer.subProcess.name,
                  status: priorPeer.status,
                  outputRemark: priorPeer.outputRemark,
                  assigneeName: priorPeer.assignedEmployee?.name,
                }
              : null,
            ...handoffTimeFromSummary(
              { activeSeconds, holdSeconds },
              task.expectedMinutes,
            ),
            nextStage,
          },
        )
    : null;

  const endHandoff = task && endDialogConfig
    ? buildHandoffContextFromTask(
        {
          status: task.status,
          subProcess: task.subProcess,
          design: {
            ideaRef: task.design.ideaRef,
            collectionName: task.design.collectionName,
            productType: task.design.productType ?? undefined,
          },
          assignedEmployee: task.assignedEmployee,
        },
        {
          description: endDialogConfig.description,
          nextStepHint: endDialogConfig.nextStepHint,
          priorStage: priorPeer
            ? {
                code: priorPeer.subProcess.code,
                name: priorPeer.subProcess.name,
                status: priorPeer.status,
                outputRemark: priorPeer.outputRemark,
                assigneeName: priorPeer.assignedEmployee?.name,
              }
            : null,
          blockers: task.blockedMessage ? [task.blockedMessage] : undefined,
          ...handoffTimeFromSummary(
            { activeSeconds, holdSeconds },
            task.expectedMinutes,
          ),
          nextStage,
        },
      )
    : null;

  const stageApprovalHandoff =
    task && isStageApproval
      ? buildHandoffContextFromTask(
          {
            status: task.status,
            subProcess: task.subProcess,
            design: {
              ideaRef: task.design.ideaRef,
              collectionName: task.design.collectionName,
              productType: task.design.productType ?? undefined,
              priority: task.priority,
            },
            assignedEmployee: task.assignedEmployee,
          },
          {
            nextStepHint: nextStage ? null : nextStepHintForStageApproval(task.subProcess.code),
            nextStage,
            priorStage: priorPeer
              ? {
                  code: priorPeer.subProcess.code,
                  name: priorPeer.subProcess.name,
                  status: priorPeer.status,
                  outputRemark: priorPeer.outputRemark,
                  assigneeName: priorPeer.assignedEmployee?.name,
                }
              : null,
            activeSeconds: priorPeer?.activeSeconds ?? null,
            holdSeconds: priorPeer?.holdSeconds ?? null,
            expectedMinutes:
              priorPeer?.activeSeconds != null || priorPeer?.holdSeconds != null
                ? priorPeer.expectedMinutes ?? null
                : null,
            timeSectionTitle: priorPeer
              ? `${priorPeer.subProcess.name} time`
              : null,
          },
        )
      : null;

  async function handleEndSubmit() {
    if (!task) return;
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
    try {
      await end.mutateAsync({
        taskId: task.id,
        version: task.version,
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
    } catch (error) {
      setEndError(humanizeApiError(error, "Cannot end task").title);
      return;
    }
    setEndError(null);
    setEndModalOpen(false);
    setEndRemark("");
    setChecklistResults({});
    setChecklistNote("");
    setSampleOutcome("");
    setCorrectionRoute("");
    setCostEntries([]);
  }

  const viewerEmployeeId = session?.user?.employeeId;
  const openedSomeoneElsesTask =
    !!task &&
    viewerEmployeeId != null &&
    Number(task.assignedEmployeeId) !== Number(viewerEmployeeId);
  const notAssigned =
    openedSomeoneElsesTask ||
    (detailQuery.error instanceof ApiClientError &&
      detailQuery.error.code === APP_ERROR_CODES.TASK_NOT_ASSIGNED);

  if (notAssigned) {
    return (
      <div className="page-shell task-detail-page">
        <AppCard title="Task">
          <p className="text-sm" role="alert">
            This task isn&apos;t assigned to you.
          </p>
          <AppButtonLink href={ROUTES.work.tasks} appVariant="primary" className="mt-4">
            Back to My Tasks
          </AppButtonLink>
        </AppCard>
      </div>
    );
  }

  const hasContextPanels =
    !!task &&
    ((canControl && !!task.blockedMessage && !task.canStart) ||
      // Quality panel mounts for quality stages; may still render null while loading.
      task.subProcess.code === "SAMPLE_CHECK" ||
      task.subProcess.code === "PUNCH_CHECK");

  return (
    <div className="page-shell task-detail-page">
      <QueryState
        isLoading={detailQuery.isLoading}
        isError={detailQuery.isError}
        error={detailQuery.error}
        isEmpty={!task && !detailQuery.isLoading && !detailQuery.isError}
        emptyTitle="Task not found"
        emptyDescription="This task does not exist or you do not have access."
        emptyAction={
          <AppButtonLink href={backHref} appVariant="primary">
            {backLabel}
          </AppButtonLink>
        }
        onRetry={() => detailQuery.refetch()}
        notFoundHref={backHref}
        notFoundLabel={backLabel}
        skeletonVariant="cards"
      >
        {task && designMismatch && (
          <div className="alert alert-warning task-detail-page__alert" role="alert">
            This task belongs to design {task.design.ideaRef}.{" "}
            <Link href={ROUTES.designs.task(task.designId, task.id)} className="data-table-link">
              Open correct task URL
            </Link>
          </div>
        )}

        {task && (
          <>
            <PageHeader
              className="task-detail-page__header"
              title={`${task.design.ideaRef} · ${task.subProcess.name}`}
              subtitle={task.design.collectionName}
              actions={
                <>
                  <StatusBadge status={resolveListItemDisplayStatus(task)} />
                  {task.assignedEmployee ? (
                    <span className="text-caption-muted">
                      {task.assignedEmployee.name}
                    </span>
                  ) : (
                    <span className="text-caption-muted">
                      Unassigned
                    </span>
                  )}
                  <AppButtonLink
                    href={ROUTES.designs.detail(task.design.id)}
                    appVariant="secondary"
                    size="sm"
                  >
                    View Design
                  </AppButtonLink>
                  <AppButtonLink href={backHref} appVariant="ghost" size="sm">
                    {backLabel}
                  </AppButtonLink>
                </>
              }
            />

            {task.status === "CORRECTION_REQUIRED" && task.outputRemark?.trim() ? (
              <div className="alert alert-warning task-detail-page__alert" role="status">
                <p className="m-0 text-sm">
                  Correction from the reviewer: {task.outputRemark.trim()}
                </p>
              </div>
            ) : null}

            {hasContextPanels ? (
              <div className="task-detail-page__context">
                <TaskQualityContextPanel
                  designId={task.design.id}
                  subProcessCode={task.subProcess.code}
                />

                {canControl && task.blockedMessage && !task.canStart ? (
                  <ActionUnavailable reason={task.blockedMessage} />
                ) : null}
              </div>
            ) : null}

            {isStageApproval && canControl ? (
              <div className="task-detail-page__approval">
                <TaskStageApprovalPanel
                  taskId={task.id}
                  designId={task.design.id}
                  version={task.version}
                  status={task.status}
                  stageName={task.subProcess.name}
                  stageCode={task.subProcess.code}
                  assignedEmployeeId={task.assignedEmployeeId}
                  employeeId={session?.user?.employeeId}
                  roleCode={roleCode}
                  ownerRoleCode={ownerRoleCode}
                  capabilities={task.subProcess.capabilities}
                  isApproval={task.subProcess.isApproval}
                  canAssign={canAssign}
                  showCompare
                  workTaskStatus={linkedWorkTaskStatus}
                  handoff={stageApprovalHandoff}
                />
              </div>
            ) : null}

            <div className="task-detail-workspace">
              <aside className="task-detail-workspace__controls">
                {canControl ? (
                  <div className="task-detail-timer-block">
                    <TimerWidget
                      compact
                      status={isRunning ? "RUNNING" : isOnHold ? "ON_HOLD" : "IDLE"}
                      elapsedSeconds={activeSeconds}
                      taskLabel={`${task.process.name} - ${task.subProcess.name}`}
                      onStart={
                        timerFlags?.showStart
                          ? () => {
                              if (!task.canStart || start.isPending) return;
                              start.mutate(task.id);
                            }
                          : undefined
                      }
                      startDisabled={!task.canStart || start.isPending || !!task.workdayClosed}
                      startLabel={
                        task.status === "CORRECTION_REQUIRED" ? "Restart" : "Start Task"
                      }
                      startHint={
                        task.workdayClosed
                          ? "Open the workday before starting this task."
                          : timerFlags?.showStart && !task.canStart
                            ? task.startBlockedReason ?? task.blockedMessage ?? undefined
                            : undefined
                      }
                      onHold={
                        timerFlags?.showHold
                          ? () => {
                              setHoldModalOpen(true);
                              setHoldReasonId("");
                            }
                          : undefined
                      }
                      onResume={
                        timerFlags?.showResume
                          ? () => resume.mutate({ taskId: task.id, version: task.version })
                          : undefined
                      }
                      onEnd={
                        timerFlags?.showEnd
                          ? () => {
                              setEndModalOpen(true);
                              setEndError(null);
                              setEndRemark("");
                              setChecklistNote("");
                              setSampleOutcome("");
                              setChecklistResults({});
                              setEndStatus("CHECKING");
                            }
                          : undefined
                      }
                    />
                    {task.workdayClosed ? (
                      <div className="task-workday-reopen">
                        <p className="task-detail-timer-hint" role="status">
                          Today&apos;s workday is closed. Open it to start the timer again.
                        </p>
                        <AppButton
                          type="button"
                          size="sm"
                          disabled={openWorkday.isPending}
                          onClick={() => openWorkday.mutate()}
                        >
                          {openWorkday.isPending ? "Opening…" : "Open Workday"}
                        </AppButton>
                      </div>
                    ) : null}
                    {timerFlags?.blocksTimerEnd && (isRunning || isOnHold) ? (
                      <p className="task-detail-timer-hint" role="status">
                        Finish this stage with Approve / Request correction / Reject above - not
                        the timer End dialog. Hold and Resume still work for time tracking.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <AppCard title="Time summary" className="task-detail-meta-card">
                    <dl className="detail-list detail-list--compact">
                      <DetailItem label="Active work" value={formatDuration(activeSeconds)} />
                      <DetailItem label="Hold time" value={formatDuration(holdSeconds)} />
                      <DetailItem label="Expected" value={`${task.expectedMinutes} min`} />
                    </dl>
                  </AppCard>
                )}

                <AppCard
                  title="Task Details"
                  className="task-detail-meta-card"
                  contentClassName="task-detail-meta-card__content"
                >
                  <dl className="task-fact-list">
                    <DetailItem label="Process" value={task.process.name} />
                    <DetailItem label="Stage" value={task.subProcess.name} />
                    <DetailItem
                      label="Role"
                      value={task.subProcess.defaultRole?.name ?? "-"}
                    />
                    <DetailItem
                      label="Assignee"
                      value={task.assignedEmployee?.name ?? "-"}
                    />
                    <DetailItem
                      label="Assigned"
                      value={
                        formatTaskStamp(
                          resolveTaskAssignedAt({
                            startedAt: task.startedAt,
                            updatedAtUtc: task.updatedAtUtc,
                            design: { createdAtUtc: undefined },
                          }),
                        ) ?? "-"
                      }
                    />
                    <DetailItem label="Deadline" value={formatTaskDeadline(task.dueAt) ?? "Not set"} />
                    <DetailItem label="Expected" value={`${task.expectedMinutes} min`} />
                    <DetailItem label="Priority" value={<PriorityBadge priority={task.priority} />} />
                    <DetailItem label="Active work" value={formatDuration(activeSeconds)} />
                    <DetailItem label="Hold time" value={formatDuration(holdSeconds)} />
                  </dl>
                </AppCard>

                {showErpOnTask ? (
                  <AppCard
                    title="ERP Chain"
                    className="erp-chain-task-panel task-detail-erp-card"
                    contentClassName="task-detail-erp-card__content"
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
                        Start this task to seed Floor ERP stages.
                      </p>
                    )}
                  </AppCard>
                ) : null}
              </aside>

              <div className="task-detail-workspace__main">
                <TaskDesignBrief task={task} />
                <AppCard
                  title="Time"
                  className="task-detail-timeline-card"
                  contentClassName="task-detail-timeline-card__content"
                >
                  <TaskTimeTimeline events={task.timeline} summary={liveSummary ?? task.timeSummary} />
                </AppCard>
              </div>
            </div>
          </>
        )}
      </QueryState>

      {canControl && task && (
        <>
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
            open={
              endModalOpen && !!timerFlags?.showEnd
            }
            onClose={() => {
              setEndModalOpen(false);
              setEndError(null);
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
            taskId={task.id}
            designId={task.designId ?? task.design.id}
            subProcessCode={task.subProcess.code}
            subProcessName={task.subProcess.name}
            canUpload={canControl}
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
            priorPunching={task.priorPunching}
            designerStages={
              task.subProcess.code === "COSTING"
                ? earlierDesignerStages(task.workflowPeers, {
                    id: task.id,
                    sequence: task.sequence,
                  })
                : undefined
            }
            showStatusSelect={endDialogConfig?.showStatusSelect}
            costEntries={costEntries}
            onCostEntriesChange={setCostEntries}
            onSubmit={handleEndSubmit}
            isPending={end.isPending}
            submitError={endError}
          />
        </>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
