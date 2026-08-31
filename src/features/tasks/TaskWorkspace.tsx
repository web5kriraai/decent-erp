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
import type { DesignTask } from "@/lib/types/api";
import { computeElapsedSeconds } from "@/lib/types/api";

export function TaskWorkspace() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];

  const tasksQuery = useMyTasks(permissions.includes(PERMISSIONS.TASK_EXECUTE));
  const holdReasons = useHoldReasons(permissions.includes(PERMISSIONS.TASK_EXECUTE));
  const { start, hold, resume, end, closeWorkday, isPending } = useTaskMutations();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [holdReasonId, setHoldReasonId] = useState<number | "">("");
  const [holdRemark, setHoldRemark] = useState("");
  const [endRemark, setEndRemark] = useState("");
  const [endStatus, setEndStatus] = useState<"CHECKING" | "COMPLETED">("CHECKING");
  const [, tick] = useState(0);

  const tasks = tasksQuery.data ?? [];
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const runningTask = tasks.find((t) => t.status === "RUNNING");
  const onHoldTask = tasks.find((t) => t.status === "ON_HOLD");
  const activeTask = runningTask ?? onHoldTask ?? selectedTask;

  const elapsedSeconds = useMemo(() => {
    if (!activeTask?.timeEvents) return 0;
    return computeElapsedSeconds(activeTask.timeEvents);
  }, [activeTask?.timeEvents, activeTask?.status]);

  // Refresh timer display every second when running
  useEffect(() => {
    if (runningTask) {
      const id = setInterval(() => tick((n) => n + 1), 1000);
      return () => clearInterval(id);
    }
  }, [runningTask]);

  const tasksByStatus = useMemo(() => {
    const groups: Record<string, DesignTask[]> = {
      ASSIGNED: [],
      PENDING: [],
      RUNNING: [],
      ON_HOLD: [],
      CHECKING: [],
      CORRECTION_REQUIRED: [],
    };
    for (const task of tasks) {
      if (groups[task.status]) groups[task.status].push(task);
    }
    return groups;
  }, [tasks]);

  if (!permissions.includes(PERMISSIONS.TASK_EXECUTE)) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.TASK_EXECUTE} />
      </div>
    );
  }

  async function handleStart(task: DesignTask) {
    setSelectedTaskId(task.id);
    await start.mutateAsync(task.id);
  }

  async function handleHoldSubmit() {
    if (!activeTask || !holdReasonId) return;
    await hold.mutateAsync({
      taskId: activeTask.id,
      holdReasonId: Number(holdReasonId),
      remark: holdRemark || undefined,
    });
    setHoldModalOpen(false);
    setHoldRemark("");
  }

  async function handleEndSubmit() {
    if (!activeTask || !endRemark.trim()) return;
    await end.mutateAsync({
      taskId: activeTask.id,
      version: activeTask.version,
      outputRemark: endRemark.trim(),
      completionStatus: endStatus,
    });
    setEndModalOpen(false);
    setEndRemark("");
    setSelectedTaskId(null);
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="My Tasks"
        subtitle="Server-authoritative timer - all state changes are stamped on the server"
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => closeWorkday.mutate()}
            disabled={closeWorkday.isPending || !!runningTask}
            title={runningTask ? "Stop running task before closing workday" : undefined}
          >
            Close Workday
          </button>
        }
      />

      <QueryState
        isLoading={tasksQuery.isLoading}
        isError={tasksQuery.isError}
        error={tasksQuery.error}
        isEmpty={tasks.length === 0}
        emptyTitle="No tasks assigned"
        emptyDescription="When work is assigned to you, tasks appear here for execution."
        skeletonVariant="cards"
        onRetry={() => tasksQuery.refetch()}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 320px) 1fr",
            gap: "1.5rem",
            alignItems: "start",
          }}
        >
          <TimerWidget
            status={runningTask ? "RUNNING" : onHoldTask ? "ON_HOLD" : "IDLE"}
            elapsedSeconds={elapsedSeconds}
            taskLabel={
              activeTask
                ? `${activeTask.design.ideaRef} · ${activeTask.subProcess.name}`
                : undefined
            }
            onHold={
              runningTask
                ? () => {
                    setHoldModalOpen(true);
                    setHoldReasonId("");
                  }
                : undefined
            }
            onResume={onHoldTask ? () => resume.mutate(activeTask!.id) : undefined}
            onEnd={
              runningTask || onHoldTask
                ? () => {
                    setEndModalOpen(true);
                    setEndRemark("");
                  }
                : undefined
            }
          />

          <div className="kanban">
            {(
              [
                ["ASSIGNED", "Ready to Start"],
                ["RUNNING", "In Progress"],
                ["ON_HOLD", "On Hold"],
                ["CHECKING", "Checking"],
              ] as const
            ).map(([status, label]) => (
              <div key={status} className="kanban-column">
                <div className="kanban-column-header">
                  {label}
                  <span className="kanban-column-count">
                    {tasksByStatus[status]?.length ?? 0}
                  </span>
                </div>
                <div className="kanban-cards">
                  {(tasksByStatus[status] ?? []).map((task) => (
                    <article
                      key={task.id}
                      className={`task-card ${selectedTaskId === task.id ? "task-card--selected" : ""}`}
                      onClick={() => setSelectedTaskId(task.id)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedTaskId(task.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <p className="task-card-ref">
                        <Link
                          href={ROUTES.work.taskDetail(task.id)}
                          className="data-table-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.design.ideaRef}
                        </Link>
                      </p>
                      <p className="task-card-title">{task.subProcess.name}</p>
                      <p
                        style={{
                          margin: "0.25rem 0 0",
                          fontSize: "var(--font-size-caption)",
                          color: "var(--color-neutral-500)",
                        }}
                      >
                        {task.design.collectionName}
                      </p>
                      <div className="task-card-meta">
                        <StatusBadge status={task.status} />
                        {status === "ASSIGNED" && !runningTask && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStart(task);
                            }}
                          >
                            Start
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {(tasksByStatus[status] ?? []).length === 0 && (
                    <p className="kanban-empty">No tasks</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
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
