"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { Modal } from "@/components/ui/Modal";
import { TimerWidget } from "@/components/TimerWidget";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { ROUTES } from "@/config/routes";
import { useMyTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useHoldReasons } from "@/hooks/use-masters";
import { PERMISSIONS } from "@/lib/permissions";
import { computeElapsedSeconds } from "@/lib/types/api";

type TaskDetailViewProps = { taskId: string };

export function TaskDetailView({ taskId }: TaskDetailViewProps) {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.TASK_EXECUTE);

  const tasksQuery = useMyTasks(enabled);
  const holdReasons = useHoldReasons(enabled);
  const { start, hold, resume, end, isPending } = useTaskMutations();

  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [holdReasonId, setHoldReasonId] = useState<number | "">("");
  const [holdRemark, setHoldRemark] = useState("");
  const [endRemark, setEndRemark] = useState("");
  const [endStatus, setEndStatus] = useState<"CHECKING" | "COMPLETED">("CHECKING");
  const [, tick] = useState(0);

  const task = tasksQuery.data?.find((t) => t.id === taskId) ?? null;
  const isRunning = task?.status === "RUNNING";
  const isOnHold = task?.status === "ON_HOLD";

  const elapsedSeconds = useMemo(() => {
    if (!task?.timeEvents) return 0;
    return computeElapsedSeconds(task.timeEvents);
  }, [task?.timeEvents, task?.status]);

  useEffect(() => {
    if (isRunning) {
      const id = setInterval(() => tick((n) => n + 1), 1000);
      return () => clearInterval(id);
    }
  }, [isRunning]);

  if (!enabled) {
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
        isLoading={tasksQuery.isLoading}
        isError={tasksQuery.isError}
        error={tasksQuery.error}
        isEmpty={!task && !tasksQuery.isLoading}
        emptyTitle="Task not found"
        emptyDescription="This task is not assigned to you or may have been completed."
        emptyAction={
          <Link href={ROUTES.work.tasks} className="btn btn-primary">
            Back to My Tasks
          </Link>
        }
        onRetry={() => tasksQuery.refetch()}
        skeletonVariant="cards"
      >
        {task && (
          <>
            <PageHeader
              title={`${task.design.ideaRef} · ${task.subProcess.name}`}
              subtitle={task.design.collectionName}
              actions={
                <>
                  <StatusBadge status={task.status} />
                  <Link href={ROUTES.designs.detail(task.design.id)} className="btn btn-secondary btn-sm">
                    View Design
                  </Link>
                  <Link href={ROUTES.work.tasks} className="btn btn-ghost btn-sm">
                    Task Board
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
              <TimerWidget
                status={isRunning ? "RUNNING" : isOnHold ? "ON_HOLD" : "IDLE"}
                elapsedSeconds={elapsedSeconds}
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

              <div className="card">
                <h3 style={{ marginTop: 0 }}>Task Details</h3>
                <dl className="detail-list">
                  <DetailItem label="Process" value={task.process.name} />
                  <DetailItem label="Sub-process" value={task.subProcess.name} />
                  <DetailItem label="Expected Time" value={`${task.expectedMinutes} min`} />
                  <DetailItem label="Priority" value={task.priority} />
                </dl>
                {task.status === "ASSIGNED" && (
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
          </>
        )}
      </QueryState>

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
