"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { Modal } from "@/components/ui/Modal";
import { TimerWidget } from "@/components/TimerWidget";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { SkeletonRows } from "@/components/SkeletonRows";
import { TaskTimeTimeline } from "@/components/time/TaskTimeTimeline";
import { ROUTES } from "@/config/routes";
import { useTaskTimeDetail } from "@/hooks/use-time";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useHoldReasons } from "@/hooks/use-masters";
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
  const { start, hold, resume, end, isPending } = useTaskMutations();

  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [holdReasonId, setHoldReasonId] = useState<number | "">("");
  const [holdRemark, setHoldRemark] = useState("");
  const [endRemark, setEndRemark] = useState("");
  const [endStatus, setEndStatus] = useState<"CHECKING" | "COMPLETED">("CHECKING");
  const [, tick] = useState(0);

  const task = detailQuery.data;
  const isAssignee = task?.assignedEmployeeId === session?.user?.employeeId;
  const canControl = canExecute && isAssignee;
  const isRunning = task?.status === "RUNNING";
  const isOnHold = task?.status === "ON_HOLD";
  const designMismatch =
    !!task && !!designId && task.designId !== designId && task.design.id !== designId;

  const activeSeconds = task?.timeSummary.activeSeconds ?? 0;
  const backHref = designId ? ROUTES.designs.detail(designId) : ROUTES.work.tasks;
  const backLabel = designId ? "Back to Design" : "Back to My Tasks";

  useEffect(() => {
    if (isRunning) {
      const id = setInterval(() => tick((n) => n + 1), 1000);
      return () => clearInterval(id);
    }
  }, [isRunning]);

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

  async function handleEndSubmit() {
    if (!task || !endRemark.trim()) return;
    await end.mutateAsync({
      taskId: task.id,
      version: task.version,
      outputRemark: endRemark.trim(),
      completionStatus: endStatus,
    });
    setEndModalOpen(false);
    setEndRemark("");
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
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>Time summary</h3>
                  {!isAssignee && canViewTeam && (
                    <p style={{ color: "var(--color-neutral-500)", marginTop: 0, marginBottom: "0.75rem" }}>
                      Read-only view — you are not the assignee for this task.
                    </p>
                  )}
                  {!isAssignee && !canViewTeam && (
                    <p style={{ color: "var(--color-neutral-500)", marginTop: 0, marginBottom: "0.75rem" }}>
                      This task is not assigned to you.
                    </p>
                  )}
                  <dl className="detail-list">
                    <DetailItem label="Active work" value={formatDuration(task.timeSummary.activeSeconds)} />
                    <DetailItem label="Hold time" value={formatDuration(task.timeSummary.holdSeconds)} />
                    <DetailItem label="Expected" value={`${task.expectedMinutes} min`} />
                  </dl>
                </div>
              )}

              <div className="card">
                <h3 style={{ marginTop: 0 }}>Task Details</h3>
                <dl className="detail-list">
                  <DetailItem label="Process" value={task.process.name} />
                  <DetailItem label="Sub-process" value={task.subProcess.name} />
                  <DetailItem label="Expected Time" value={`${task.expectedMinutes} min`} />
                  <DetailItem label="Priority" value={task.priority} />
                  <DetailItem label="Active work" value={formatDuration(task.timeSummary.activeSeconds)} />
                  <DetailItem label="Hold time" value={formatDuration(task.timeSummary.holdSeconds)} />
                </dl>
                {canControl && task.status === "ASSIGNED" && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isPending}
                    onClick={() => start.mutate(task.id)}
                    style={{ marginTop: "1rem" }}
                  >
                    Start Task
                  </button>
                )}
              </div>
            </div>

            <div className="card" style={{ marginTop: "1.5rem" }}>
              <span className="card-title">Time event timeline</span>
              <div style={{ marginTop: "1rem" }}>
                <TaskTimeTimeline events={task.timeline} summary={task.timeSummary} />
              </div>
            </div>
          </>
        )}
      </QueryState>

      {canControl && task && (
        <>
          <Modal
            open={holdModalOpen}
            title="Hold Task"
            onClose={() => setHoldModalOpen(false)}
            footer={
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setHoldModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!holdReasonId || hold.isPending}
                  onClick={handleHoldSubmit}
                >
                  Confirm Hold
                </button>
              </>
            }
          >
            <div className="form-group">
              <label className="form-label" htmlFor="holdReason">
                Hold Reason *
              </label>
              <select
                id="holdReason"
                className="form-select"
                value={holdReasonId}
                onChange={(e) => setHoldReasonId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select reason…</option>
                {holdReasons.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label className="form-label" htmlFor="holdRemark">
                Remark
              </label>
              <textarea
                id="holdRemark"
                className="form-textarea"
                rows={2}
                value={holdRemark}
                onChange={(e) => setHoldRemark(e.target.value)}
                placeholder="Optional note…"
              />
            </div>
          </Modal>

          <Modal
            open={endModalOpen}
            title="Complete Task"
            onClose={() => setEndModalOpen(false)}
            footer={
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setEndModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!endRemark.trim() || end.isPending}
                  onClick={handleEndSubmit}
                >
                  Submit Completion
                </button>
              </>
            }
          >
            <div className="form-group">
              <label className="form-label" htmlFor="endStatus">
                Completion Status
              </label>
              <select
                id="endStatus"
                className="form-select"
                value={endStatus}
                onChange={(e) => setEndStatus(e.target.value as "CHECKING" | "COMPLETED")}
              >
                <option value="CHECKING">Send for Checking</option>
                <option value="COMPLETED">Mark Completed</option>
              </select>
            </div>
            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label className="form-label" htmlFor="endRemark">
                Output Remark *
              </label>
              <textarea
                id="endRemark"
                className="form-textarea"
                rows={3}
                value={endRemark}
                onChange={(e) => setEndRemark(e.target.value)}
                placeholder="Describe work completed…"
              />
            </div>
          </Modal>
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
