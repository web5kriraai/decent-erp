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
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import {
  useActionCenter,
  useTaskMutations,
  type ActionCenterBlockedItem,
  type ActionCenterWaitingItem,
} from "@/hooks/use-tasks";
import { useHoldReasons, useChecklistItems } from "@/hooks/use-masters";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignTask } from "@/lib/types/api";
import { computeElapsedSeconds } from "@/lib/types/api";
import { cn } from "@/lib/utils";

const KANBAN_COLUMNS = [
  ["ASSIGNED", "Ready to Start"],
  ["RUNNING", "In Progress"],
  ["ON_HOLD", "On Hold"],
  ["CHECKING", "Checking"],
] as const;

type ActionTab = "actionRequired" | "waitingForOthers" | "blocked" | "upcoming" | "completed";

const ACTION_TABS: { id: ActionTab; label: string }[] = [
  { id: "actionRequired", label: "Action required" },
  { id: "waitingForOthers", label: "Waiting for others" },
  { id: "blocked", label: "Blocked" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

function formatCollectionLabel(name: string) {
  if (/workday\s+\d{10,}/i.test(name)) return null;
  return name;
}

function WaitingList({ items }: { items: ActionCenterWaitingItem[] }) {
  if (items.length === 0) {
    return <p className="action-center-empty">Nothing waiting on others right now.</p>;
  }
  return (
    <ul className="action-center-list">
      {items.map((item) => (
        <li key={item.taskId} className="action-center-list-item">
          <div>
            <Link href={ROUTES.designs.detail(item.design.id)} className="data-table-link">
              {item.design.ideaRef}
            </Link>
            <p className="action-center-list-meta">
              {item.myStage} · {item.myStatus.replace(/_/g, " ")}
            </p>
            <p className="action-center-list-detail">
              Waiting for <strong>{item.waitingFor}</strong> — {item.nextAction}
            </p>
          </div>
          {item.nextTaskId ? (
            <Link href={ROUTES.work.taskDetail(item.nextTaskId)} className="btn btn-ghost btn-sm">
              View next
            </Link>
          ) : null}
          <Link href={ROUTES.work.taskDetail(item.taskId)} className="btn btn-ghost btn-sm">
            My task
          </Link>
          <Link href={ROUTES.designs.detail(item.design.id)} className="btn btn-ghost btn-sm">
            Design
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
          <Link href={ROUTES.work.taskDetail(item.taskId)} className="btn btn-ghost btn-sm">
            View
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TaskList({ tasks, emptyMessage }: { tasks: DesignTask[]; emptyMessage: string }) {
  if (tasks.length === 0) {
    return <p className="action-center-empty">{emptyMessage}</p>;
  }
  return (
    <ul className="action-center-list">
      {tasks.map((task) => (
        <li key={task.id} className="action-center-list-item">
          <div>
            <Link href={ROUTES.work.taskDetail(task.id)} className="data-table-link">
              {task.design.ideaRef} · {task.subProcess.name}
            </Link>
            {formatCollectionLabel(task.design.collectionName) ? (
              <p className="action-center-list-meta">{task.design.collectionName}</p>
            ) : null}
          </div>
          <StatusBadge status={task.status} />
        </li>
      ))}
    </ul>
  );
}

export function TaskWorkspace() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canExecute = permissions.includes(PERMISSIONS.TASK_EXECUTE);

  const centerQuery = useActionCenter(canExecute);
  const holdReasons = useHoldReasons(canExecute);
  const checklistQuery = useChecklistItems(canExecute);
  const { start, hold, resume, end, closeWorkday, isPending } = useTaskMutations();

  const [activeTab, setActiveTab] = useState<ActionTab>("actionRequired");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [holdReasonId, setHoldReasonId] = useState<number | "">("");
  const [holdRemark, setHoldRemark] = useState("");
  const [endRemark, setEndRemark] = useState("");
  const [endStatus, setEndStatus] = useState<"CHECKING" | "COMPLETED">("CHECKING");
  const [checklistResults, setChecklistResults] = useState<Record<number, boolean>>({});
  const [checklistNote, setChecklistNote] = useState("");
  const [sampleOutcome, setSampleOutcome] = useState<"APPROVE" | "REJECT" | "RESAMPLE" | "">("");

  const center = centerQuery.data;
  const tasks = center?.actionRequired ?? [];
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const runningTask = tasks.find((t) => t.status === "RUNNING");
  const onHoldTask = tasks.find((t) => t.status === "ON_HOLD");
  const activeTask = runningTask ?? onHoldTask ?? selectedTask;
  const isTimerActive = !!(runningTask || onHoldTask);

  const fileRequired = !!activeTask?.subProcess?.isFileRequired;
  const isSampleCheck = activeTask?.subProcess?.code === "SAMPLE_CHECK";

  const elapsedSeconds = useMemo(() => {
    if (!activeTask?.timeEvents) return 0;
    return computeElapsedSeconds(activeTask.timeEvents);
  }, [activeTask?.timeEvents, activeTask?.status]);

  const tasksByStatus = useMemo(() => {
    const groups: Record<string, DesignTask[]> = {
      ASSIGNED: [],
      RUNNING: [],
      ON_HOLD: [],
      CHECKING: [],
    };
    for (const task of tasks) {
      if (groups[task.status]) groups[task.status].push(task);
    }
    return groups;
  }, [tasks]);

  const tabCounts = useMemo(
    () => ({
      actionRequired: center?.actionRequired.length ?? 0,
      waitingForOthers: center?.waitingForOthers.length ?? 0,
      blocked: center?.blocked.length ?? 0,
      upcoming: center?.upcoming.length ?? 0,
      completed: center?.completed.length ?? 0,
    }),
    [center],
  );

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

  const hasAnyWork =
    tabCounts.actionRequired +
      tabCounts.waitingForOthers +
      tabCounts.blocked +
      tabCounts.upcoming +
      tabCounts.completed >
    0;

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="My Action Center"
        subtitle="Work you can act on now, what you are waiting on, and what is still queued."
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
        isLoading={centerQuery.isLoading}
        isError={centerQuery.isError}
        error={centerQuery.error}
        isEmpty={!hasAnyWork}
        emptyTitle="No tasks assigned yet"
        emptyDescription="Tasks appear when workflow stages are assigned to you."
        skeletonVariant="cards"
        onRetry={() => centerQuery.refetch()}
      >
        <div className="action-center-tabs" role="tablist" aria-label="Action center sections">
          {ACTION_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={cn("action-center-tab", activeTab === tab.id && "action-center-tab--active")}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className="action-center-tab-count">{tabCounts[tab.id]}</span>
            </button>
          ))}
        </div>

        {activeTab === "actionRequired" ? (
          <div className="task-workspace-layout">
            <TimerWidget
              status={runningTask ? "RUNNING" : onHoldTask ? "ON_HOLD" : "IDLE"}
              elapsedSeconds={elapsedSeconds}
              taskLabel={
                activeTask && isTimerActive
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

            {tasks.length === 0 ? (
              <p className="action-center-empty action-center-empty--inline">
                No tasks ready for you right now. Check Waiting, Blocked, or Upcoming tabs.
              </p>
            ) : (
              <div className="kanban">
                {KANBAN_COLUMNS.map(([status, label]) => (
                  <div key={status} className="kanban-column">
                    <div className="kanban-column-header">
                      {label}
                      <span className="kanban-column-count">
                        {tasksByStatus[status]?.length ?? 0}
                      </span>
                    </div>
                    <div className="kanban-cards">
                      {(tasksByStatus[status] ?? []).map((task) => {
                        const isActiveCard = task.id === activeTask?.id && isTimerActive;
                        const collectionLabel = formatCollectionLabel(task.design.collectionName);
                        return (
                          <article
                            key={task.id}
                            className={cn(
                              "task-card",
                              selectedTaskId === task.id && "task-card--selected",
                              isActiveCard && "task-card--active",
                            )}
                            onClick={() => setSelectedTaskId(task.id)}
                            onKeyDown={(e) => handleTaskCardKeyDown(e, task)}
                            role="button"
                            tabIndex={0}
                            aria-label={`${task.design.ideaRef} ${task.subProcess.name}`}
                            aria-current={isActiveCard ? "true" : undefined}
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
                            {collectionLabel ? (
                              <p className="task-card-subtitle">{collectionLabel}</p>
                            ) : null}
                            <div className="task-card-meta">
                              <StatusBadge status={task.status} />
                              {status === "ASSIGNED" && !runningTask ? (
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
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                      {(tasksByStatus[status] ?? []).length === 0 ? (
                        <p className="kanban-empty">No tasks</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "waitingForOthers" ? (
          <WaitingList items={center?.waitingForOthers ?? []} />
        ) : null}

        {activeTab === "blocked" ? (
          <BlockedList items={center?.blocked ?? []} />
        ) : null}

        {activeTab === "upcoming" ? (
          <TaskList
            tasks={center?.upcoming ?? []}
            emptyMessage="No upcoming tasks — prior stages will unlock work for you."
          />
        ) : null}

        {activeTab === "completed" ? (
          <TaskList
            tasks={center?.completed ?? []}
            emptyMessage="No recently completed tasks."
          />
        ) : null}

        {selectedTask && !isTimerActive && activeTab === "actionRequired" ? (
          <p className="task-workspace-selected">
            Selected:{" "}
            <Link href={ROUTES.work.taskDetail(selectedTask.id)} className="data-table-link">
              {selectedTask.design.ideaRef} · {selectedTask.subProcess.name}
            </Link>
          </p>
        ) : null}
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
        taskId={activeTask?.id}
        designId={activeTask?.design.id}
        subProcessCode={activeTask?.subProcess.code}
        subProcessName={activeTask?.subProcess.name}
        isSampleCheck={isSampleCheck}
        sampleOutcome={sampleOutcome || undefined}
        onSampleOutcomeChange={setSampleOutcome}
        onSubmit={handleEndSubmit}
        isPending={end.isPending}
      />
    </div>
  );
}
