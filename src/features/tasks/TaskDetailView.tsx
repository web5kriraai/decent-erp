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
import { canRoleActOnStageApproval } from "@/lib/stage-approval-rbac";
import {
  getTaskEndDialogConfig,
  getTaskHoldDialogConfig,
} from "@/lib/task-dialog-config";

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
  const isStageApproval = isStageApprovalTask(task?.subProcess?.code);
  const roleCanActOnStage =
    !!roleCode &&
    !!task?.subProcess?.code &&
    canRoleActOnStageApproval(roleCode, task.subProcess.code);
  const canActOnStageApproval =
    isStageApproval &&
    roleCanActOnStage &&
    (isAssignee ||
      task?.assignedEmployeeId == null ||
      (canAssign && task?.assignedEmployeeId != null));
  const canControl = canExecute && (isAssignee || (isStageApproval && canActOnStageApproval));
  const showComparePanel =
    task?.subProcess?.code === "PUNCH_CHECK";
  const isRunning = task?.status === "RUNNING";
  const isOnHold = task?.status === "ON_HOLD";
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
    const peerCode = workSubProcessCodeForApproval(task.subProcess.code);
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
      })
    : null;
  const endDialogConfig = task
    ? getTaskEndDialogConfig(
        {
          status: task.status,
          subProcess: task.subProcess,
          design: task.design,
        },
        roleCode,
      )
    : null;

  async function handleEndSubmit() {
    if (!task || !endRemark.trim()) return;
    if (isSampleCheck && !sampleOutcome) return;
    const isCosting = task.subProcess?.code === "COSTING";
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
                canAssign={canAssign}
                showCompare={false}
                workTaskStatus={linkedWorkTaskStatus}
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
                <TimerWidget
                  status={isRunning ? "RUNNING" : isOnHold ? "ON_HOLD" : "IDLE"}
                  elapsedSeconds={activeSeconds}
                  taskLabel={`${task.process.name} → ${task.subProcess.name}`}
                  onHold={
                    !isStageApproval && isRunning
                      ? () => {
                          setHoldModalOpen(true);
                          setHoldReasonId("");
                        }
                      : undefined
                  }
                  onResume={
                    !isStageApproval && isOnHold
                      ? () => resume.mutate({ taskId: task.id, version: task.version })
                      : undefined
                  }
                  onEnd={
                    !isStageApproval && (isRunning || isOnHold)
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
          />

          <TaskEndDialog
            open={endModalOpen}
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
