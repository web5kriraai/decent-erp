"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { TimerWidget } from "@/components/TimerWidget";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { SkeletonRows } from "@/components/SkeletonRows";
import { TaskTimeTimeline } from "@/components/time/TaskTimeTimeline";
import { TaskHoldDialog } from "@/components/tasks/TaskHoldDialog";
import { TaskEndDialog } from "@/components/tasks/TaskEndDialog";
import { TaskArtifactPanel, useTaskHasFiles } from "@/components/tasks/TaskArtifactPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { useTaskTimeDetail } from "@/hooks/use-time";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useHoldReasons, useChecklistItems } from "@/hooks/use-masters";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDuration } from "@/lib/services/time-calculation";

type TaskDetailViewProps = {
  taskId: string;
  designId?: string;
};

export function TaskDetailView({ taskId, designId }: TaskDetailViewProps) {
  const { data: session, status: sessionStatus } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canExecute = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const canViewTeam = permissions.includes(PERMISSIONS.TIME_VIEW_TEAM);
  const enabled = sessionStatus === "authenticated" && (canExecute || canViewTeam);

  const detailQuery = useTaskTimeDetail(taskId, enabled);
  const holdReasons = useHoldReasons(canExecute && enabled);
  const checklistQuery = useChecklistItems(canExecute && enabled);
  const { start, hold, resume, end, isPending } = useTaskMutations();

  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [holdReasonId, setHoldReasonId] = useState<number | "">("");
  const [holdRemark, setHoldRemark] = useState("");
  const [endRemark, setEndRemark] = useState("");
  const [endStatus, setEndStatus] = useState<"CHECKING" | "COMPLETED">("CHECKING");
  const [checklistResults, setChecklistResults] = useState<Record<number, boolean>>({});
  const [checklistNote, setChecklistNote] = useState("");

  const task = detailQuery.data;
  const isAssignee = task?.assignedEmployeeId === session?.user?.employeeId;
  const canControl = canExecute && isAssignee;
  const isRunning = task?.status === "RUNNING";
  const isOnHold = task?.status === "ON_HOLD";
  const designMismatch =
    !!task && !!designId && task.designId !== designId && task.design.id !== designId;

  // Server snapshot; TimerWidget ticks live while RUNNING.
  const activeSeconds = task?.timeSummary.activeSeconds ?? 0;
  const backHref = designId ? ROUTES.designs.detail(designId) : ROUTES.work.tasks;
  const backLabel = designId ? "Back to Design" : "Back to My Tasks";

  const { hasFiles } = useTaskHasFiles(
    taskId,
    task?.designId ?? task?.design.id ?? "",
    !!task && canControl,
  );

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
    });
    setHoldModalOpen(false);
    setHoldRemark("");
  }

  const taskChecklistItems =
    checklistQuery.data?.filter((item) => item.subProcessId === task?.subProcess?.id) ?? [];

  async function handleEndSubmit() {
    if (!task || !endRemark.trim()) return;
    const checklist = taskChecklistItems.map((item) => ({
      itemId: item.id,
      result: checklistResults[item.id] ?? false,
    }));
    const passed = checklist.filter((c) => c.result).length;
    const failed = checklist.length - passed;
    if (checklist.length > 0 && passed === 0) return;
    if (failed > 0 && !checklistNote.trim()) return;

    const note = checklistNote.trim() || undefined;
    await end.mutateAsync({
      taskId: task.id,
      version: task.version,
      outputRemark: endRemark.trim(),
      completionStatus: endStatus,
      checklist: checklist.length
        ? checklist.map((c) => (c.result ? c : { ...c, remark: note }))
        : undefined,
      checklistNote: note,
    });
    setEndModalOpen(false);
    setEndRemark("");
    setChecklistResults({});
    setChecklistNote("");
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
          <Link href={backHref} className="btn btn-primary">
            {backLabel}
          </Link>
        }
        onRetry={() => detailQuery.refetch()}
        skeletonVariant="cards"
      >
        {task && designMismatch && (
          <div className="alert alert-warning" style={{ marginBottom: "1rem" }} role="alert">
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
                  <StatusBadge status={task.status} />
                  {task.assignedEmployee ? (
                    <span style={{ fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
                      {task.assignedEmployee.name}
                    </span>
                  ) : (
                    <span style={{ fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
                      Unassigned
                    </span>
                  )}
                  <Link href={ROUTES.designs.detail(task.design.id)} className="btn btn-secondary btn-sm">
                    View Design
                  </Link>
                  <Link href={backHref} className="btn btn-ghost btn-sm">
                    {backLabel}
                  </Link>
                </>
              }
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(280px, 360px) 1fr",
                gap: "1.5rem",
                alignItems: "start",
              }}
            >
              {canControl ? (
                <TimerWidget
                  status={isRunning ? "RUNNING" : isOnHold ? "ON_HOLD" : "IDLE"}
                  elapsedSeconds={activeSeconds}
                  taskLabel={`${task.process.name} → ${task.subProcess.name}`}
                  onHold={
                    isRunning
                      ? () => {
                          setHoldModalOpen(true);
                          setHoldReasonId("");
                        }
                      : undefined
                  }
                  onResume={isOnHold ? () => resume.mutate(task.id) : undefined}
                  onEnd={
                    isRunning || isOnHold
                      ? () => {
                          setEndModalOpen(true);
                          setEndRemark("");
                          setChecklistNote("");
                        }
                      : undefined
                  }
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Time summary</CardTitle>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Task Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="detail-list">
                    <DetailItem label="Process" value={task.process.name} />
                    <DetailItem label="Sub-process" value={task.subProcess.name} />
                    <DetailItem label="Expected Time" value={`${task.expectedMinutes} min`} />
                    <DetailItem label="Priority" value={task.priority} />
                    <DetailItem label="Active work" value={formatDuration(task.timeSummary.activeSeconds)} />
                    <DetailItem label="Hold time" value={formatDuration(task.timeSummary.holdSeconds)} />
                  </dl>
                  {canControl && task.status === "ASSIGNED" && (
                    <Button
                      type="button"
                      className="mt-4"
                      disabled={isPending}
                      onClick={() => start.mutate(task.id)}
                    >
                      Start Task
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Task Files</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskArtifactPanel
                  taskId={task.id}
                  designId={task.designId ?? task.design.id}
                  canUpload={canControl}
                  subProcessCode={task.subProcess.code}
                />
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Time event timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskTimeTimeline events={task.timeline} summary={task.timeSummary} />
              </CardContent>
            </Card>
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
          />

          <TaskEndDialog
            open={endModalOpen}
            onClose={() => setEndModalOpen(false)}
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
            fileRequired={"isFileRequired" in task.subProcess && !!task.subProcess.isFileRequired}
            hasUploadedFiles={hasFiles}
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
