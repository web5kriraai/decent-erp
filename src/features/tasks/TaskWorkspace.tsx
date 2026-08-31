"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { TimerWidget } from "@/components/TimerWidget";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { TaskHoldDialog } from "@/components/tasks/TaskHoldDialog";
import { TaskEndDialog } from "@/components/tasks/TaskEndDialog";
import { TaskArtifactPanel, useTaskHasFiles } from "@/components/tasks/TaskArtifactPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { useMyTasks, useTaskMutations } from "@/hooks/use-tasks";
import { useHoldReasons, useChecklistItems } from "@/hooks/use-masters";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignTask } from "@/lib/types/api";
import { computeElapsedSeconds } from "@/lib/types/api";

export function TaskWorkspace() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];

  const tasksQuery = useMyTasks(permissions.includes(PERMISSIONS.TASK_EXECUTE));
  const holdReasons = useHoldReasons(permissions.includes(PERMISSIONS.TASK_EXECUTE));
  const checklistQuery = useChecklistItems(permissions.includes(PERMISSIONS.TASK_EXECUTE));
  const { start, hold, resume, end, closeWorkday, isPending } = useTaskMutations();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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

  const tasks = tasksQuery.data ?? [];
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const runningTask = tasks.find((t) => t.status === "RUNNING");
  const onHoldTask = tasks.find((t) => t.status === "ON_HOLD");
  const activeTask = runningTask ?? onHoldTask ?? selectedTask;

  const { hasFiles, isLoading: filesLoading } = useTaskHasFiles(
    activeTask?.id ?? "",
    activeTask?.design.id ?? "",
    !!activeTask,
  );
  const fileRequired = !!activeTask?.subProcess?.isFileRequired;
  const isSampleCheck = activeTask?.subProcess?.code === "SAMPLE_CHECK";

  // Snapshot from server events; TimerWidget ticks live while RUNNING.
  const elapsedSeconds = useMemo(() => {
    if (!activeTask?.timeEvents) return 0;
    return computeElapsedSeconds(activeTask.timeEvents);
  }, [activeTask?.timeEvents, activeTask?.status]);

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

  const taskChecklistItems =
    checklistQuery.data?.filter((item) => item.subProcessId === activeTask?.subProcess?.id) ?? [];

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
    if (fileRequired && !hasFiles) return;
    if (isSampleCheck && !sampleOutcome) return;
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
      taskId: activeTask.id,
      version: activeTask.version,
      outputRemark: endRemark.trim(),
      completionStatus: isSampleCheck
        ? sampleOutcome === "REJECT"
          ? "CHECKING"
          : "COMPLETED"
        : endStatus,
      checklist: checklist.length
        ? checklist.map((c) => (c.result ? c : { ...c, remark: note }))
        : undefined,
      checklistNote: note,
      sampleOutcome: isSampleCheck && sampleOutcome ? sampleOutcome : undefined,
    });
    setEndModalOpen(false);
    setEndRemark("");
    setChecklistResults({});
    setChecklistNote("");
    setSampleOutcome("");
    setSelectedTaskId(null);
  }

  function handleTaskCardKeyDown(e: React.KeyboardEvent, task: DesignTask) {
    if (e.key === "Enter" && task.status === "ASSIGNED" && !runningTask) {
      e.preventDefault();
      void handleStart(task);
    } else if (e.key === "Enter") {
      setSelectedTaskId(task.id);
    }
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="My Tasks"
        subtitle="Server-authoritative timer - all state changes are stamped on the server"
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => closeWorkday.mutate()}
            disabled={closeWorkday.isPending || !!runningTask}
            title={runningTask ? "Stop running task before closing workday" : undefined}
          >
            Close Workday
          </Button>
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
                    setChecklistNote("");
                    setSampleOutcome("");
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
                      onKeyDown={(e) => handleTaskCardKeyDown(e, task)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${task.design.ideaRef} ${task.subProcess.name}`}
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
                          <Button
                            type="button"
                            size="sm"
                            disabled={isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleStart(task);
                            }}
                          >
                            Start
                          </Button>
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

        {activeTask && (runningTask || onHoldTask) && fileRequired && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">
                Task Files{!hasFiles ? " — required before completion" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!hasFiles && (
                <p className="mb-3 text-sm text-amber-800">
                  This sub-process requires at least one uploaded file before you can complete the
                  task.
                </p>
              )}
              <TaskArtifactPanel
                taskId={activeTask.id}
                designId={activeTask.design.id}
                canUpload
                subProcessCode={activeTask.subProcess.code}
              />
            </CardContent>
          </Card>
        )}

        {activeTask && (
          <p className="mt-4 text-sm text-muted-foreground">
            Selected:{" "}
            <Link href={ROUTES.work.taskDetail(activeTask.id)} className="data-table-link">
              {activeTask.design.ideaRef} · {activeTask.subProcess.name}
            </Link>
          </p>
        )}
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
        fileRequired={fileRequired}
        hasUploadedFiles={hasFiles}
        filesLoading={filesLoading}
        taskId={activeTask?.id}
        designId={activeTask?.design.id}
        subProcessCode={activeTask?.subProcess.code}
        isSampleCheck={isSampleCheck}
        sampleOutcome={sampleOutcome || undefined}
        onSampleOutcomeChange={setSampleOutcome}
        onSubmit={handleEndSubmit}
        isPending={end.isPending}
      />
    </div>
  );
}
