"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBreadcrumbReplacement } from "@/components/layout/BreadcrumbProvider";
import { QueryState } from "@/components/ui/QueryState";
import { TimerWidget } from "@/components/TimerWidget";
import { StatusBadge } from "@/components/StatusBadge";
import { resolveListItemDisplayStatus } from "@/lib/task-action-display";
import { PermissionDenied } from "@/components/PermissionDenied";
import { SkeletonRows } from "@/components/SkeletonRows";
import { TaskTimeTimeline } from "@/components/time/TaskTimeTimeline";
import { TaskHoldDialog } from "@/components/tasks/TaskHoldDialog";
import { TaskEndDialog } from "@/components/tasks/TaskEndDialog";
import { TaskQualityContextPanel } from "@/components/tasks/TaskQualityContextPanel";
import {
  isStageApprovalTask,
  TaskStageApprovalPanel,
} from "@/components/tasks/TaskStageApprovalPanel";
import { TaskCompareVersionsPanel } from "@/components/tasks/TaskCompareVersionsPanel";
import { TaskMachineOutputPanel } from "@/components/tasks/TaskMachineOutputPanel";
import { ActionUnavailable } from "@/components/ui/ActionUnavailable";
import { AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ROUTES } from "@/config/routes";
import { useTaskTimeDetail } from "@/hooks/use-time";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useHoldReasons, useChecklistItems } from "@/hooks/use-masters";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDuration } from "@/lib/services/time-calculation";
import { isMachineOutputTask } from "@/lib/services/task-machine-output-utils";
import { workSubProcessCodeForApproval } from "@/lib/services/stage-approval-queue";
import {
  canControlTask,
  getTimerControlFlags,
} from "@/lib/task-control-capability";
import {
  getTaskEndDialogConfig,
  getTaskHoldDialogConfig,
  buildHandoffContextFromTask,
} from "@/lib/task-dialog-config";
import { findPriorPeerForHandoff } from "@/lib/services/stage-approval-queue";

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
  const canViewTeam = permissions.includes(PERMISSIONS.TIME_VIEW_TEAM);
  const enabled = sessionStatus === "authenticated" && (canExecute || canViewTeam);

  const detailQuery = useTaskTimeDetail(taskId, enabled);
  const holdReasons = useHoldReasons(canExecute && enabled);
  const checklistQuery = useChecklistItems(canExecute && enabled);
  const { hold, resume, end } = useTaskMutations();

  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [holdReasonId, setHoldReasonId] = useState<number | "">("");
  const [holdRemark, setHoldRemark] = useState("");
  const [endRemark, setEndRemark] = useState("");
  const [endStatus, setEndStatus] = useState<"CHECKING" | "COMPLETED">("CHECKING");
  const [checklistResults, setChecklistResults] = useState<Record<number, boolean>>({});
  const [checklistNote, setChecklistNote] = useState("");
  const [sampleOutcome, setSampleOutcome] = useState<"APPROVE" | "REJECT" | "RESAMPLE" | "">(
    "",
  );
  const [costEntries, setCostEntries] = useState<
    Array<{ costType: "TIME" | "MATERIAL" | "MACHINE" | "CORRECTION"; description?: string; amount: number }>
  >([]);

  const task = detailQuery.data;
  useBreadcrumbReplacement(
    taskId,
    task ? `${task.design.ideaRef} · ${task.subProcess.name}` : undefined,
  );
  const isAssignee = task?.assignedEmployeeId === session?.user?.employeeId;
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
  const showComparePanel =
    task?.subProcess?.code === "PUNCH_CHECK";
  const designMismatch =
    !!task && !!designId && task.designId !== designId && task.design.id !== designId;

  // Server snapshot; TimerWidget ticks live while RUNNING.
  const activeSeconds = task?.timeSummary.activeSeconds ?? 0;
  const backHref = designId ? ROUTES.designs.detail(designId) : ROUTES.work.tasks;
  const backLabel = designId ? "Back to Design" : "Back to My Tasks";

  const fileRequired = !!task?.subProcess?.isFileRequired;
  const isSampleCheck = task?.subProcess?.code === "SAMPLE_CHECK";
  const showMachineOutput = isMachineOutputTask(task?.subProcess?.code);

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

  if (sessionStatus === "authenticated" && !canExecute && !canViewTeam) {
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
            nextStepHint:
              task.subProcess.code === "PUNCH_CHECK"
                ? "Material / fabric issue toward sample"
                : task.subProcess.code === "LIVE_REVIEW"
                  ? "Design goes LIVE · ERP chain unlocks"
                  : "Advances the workflow to the next stage",
            priorStage: priorPeer
              ? {
                  code: priorPeer.subProcess.code,
                  name: priorPeer.subProcess.name,
                  status: priorPeer.status,
                  outputRemark: priorPeer.outputRemark,
                  assigneeName: priorPeer.assignedEmployee?.name,
                }
              : null,
          },
        )
      : null;

  async function handleEndSubmit() {
    if (!task || !endRemark.trim()) return;
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
    if (isSampleCheck && sampleOutcome === "APPROVE" && failed > 0) return;

    const note = checklistNote.trim() || undefined;
    await end.mutateAsync({
      taskId: task.id,
      version: task.version,
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
  }

  return (
    <div className="page-shell">
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
          <div className="alert alert-warning stack-section" role="alert">
            This task belongs to design {task.design.ideaRef}.{" "}
            <Link href={ROUTES.designs.task(task.designId, task.id)} className="data-table-link">
              Open correct task URL
            </Link>
          </div>
        )}

        {task && (
          <>
            <PageHeader
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

            <TaskQualityContextPanel
              designId={task.design.id}
              subProcessCode={task.subProcess.code}
            />

            {showComparePanel ? (
              <TaskCompareVersionsPanel designId={task.design.id} />
            ) : null}

            {showMachineOutput ? (
              <TaskMachineOutputPanel taskId={task.id} canEdit={canControl} />
            ) : null}

            {isStageApproval && canControl ? (
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
                showCompare={false}
                workTaskStatus={linkedWorkTaskStatus}
                handoff={stageApprovalHandoff}
              />
            ) : null}

            {canControl && task.blockedMessage && !task.canStart ? (
              <ActionUnavailable
                reason={task.blockedMessage}
                className="mb-4"
              />
            ) : null}

            <div className="task-detail-layout">
              {canControl ? (
                <div className="stack-section">
                  <TimerWidget
                    status={isRunning ? "RUNNING" : isOnHold ? "ON_HOLD" : "IDLE"}
                    elapsedSeconds={activeSeconds}
                    taskLabel={`${task.process.name} → ${task.subProcess.name}`}
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
                            setEndRemark("");
                            setChecklistNote("");
                            setSampleOutcome("");
                            setChecklistResults({});
                            setEndStatus("CHECKING");
                          }
                        : undefined
                    }
                  />
                  {timerFlags?.blocksTimerEnd && (isRunning || isOnHold) ? (
                    <p className="mt-2 text-sm text-muted-foreground" role="status">
                      Finish this stage with Approve / Request correction / Reject above — not
                      the timer End dialog. Hold and Resume still work for time tracking.
                    </p>
                  ) : null}
                </div>
              ) : (
                <AppCard title="Time summary">
                  {!isAssignee && canViewTeam && (
                    <p className="mb-3 text-sm text-muted-foreground">
                      Read-only view - you are not the assignee for this task.
                    </p>
                  )}
                  {!isAssignee && !canViewTeam && (
                    <p className="mb-3 text-sm text-muted-foreground">
                      This task is not assigned to you.
                    </p>
                  )}
                  <dl className="detail-list">
                    <DetailItem label="Active work" value={formatDuration(task.timeSummary.activeSeconds)} />
                    <DetailItem label="Hold time" value={formatDuration(task.timeSummary.holdSeconds)} />
                    <DetailItem label="Expected" value={`${task.expectedMinutes} min`} />
                  </dl>
                </AppCard>
              )}

              <AppCard title="Task Details">
                <dl className="detail-list">
                  <DetailItem label="Process" value={task.process.name} />
                  <DetailItem label="Sub-process" value={task.subProcess.name} />
                  <DetailItem label="Expected Time" value={`${task.expectedMinutes} min`} />
                  <DetailItem label="Priority" value={task.priority} />
                  <DetailItem label="Active work" value={formatDuration(task.timeSummary.activeSeconds)} />
                  <DetailItem label="Hold time" value={formatDuration(task.timeSummary.holdSeconds)} />
                </dl>
              </AppCard>
            </div>

            <AppCard title="Time event timeline" className="mt-6">
              <TaskTimeTimeline events={task.timeline} summary={task.timeSummary} />
            </AppCard>
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
        </>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
