"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { TimerWidget } from "@/components/TimerWidget";
import { PermissionDenied } from "@/components/PermissionDenied";
import { TaskActionCard, TaskActionListItem } from "@/components/tasks/TaskActionCard";
import { TaskHoldDialog } from "@/components/tasks/TaskHoldDialog";
import { TaskEndDialog } from "@/components/tasks/TaskEndDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/config/routes";
import {
  useActionCenter,
  useTaskMutations,
  type ActionCenterBlockedItem,
} from "@/hooks/use-tasks";
import { useHoldReasons, useChecklistItems } from "@/hooks/use-masters";
import { PERMISSIONS } from "@/lib/permissions";
import type { DesignTask } from "@/lib/types/api";
import { computeElapsedSeconds } from "@/lib/types/api";
import { groupActionCenterTasks } from "@/lib/task-priority";

const KANBAN_COLUMNS = [
  ["READY", "Ready to Start"],
  ["CORRECTION_REQUIRED", "Rework"],
  ["RUNNING", "In Progress"],
  ["ON_HOLD", "On Hold"],
] as const;

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
        <TaskActionListItem key={task.id} task={task} />
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

  const kanbanGroups = useMemo(() => groupActionCenterTasks(tasks), [tasks]);

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
        subtitle="Work you can act on now, blocked items, and upcoming stages."
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
                  No tasks ready for you right now. Check Blocked or Upcoming tabs.
                </p>
              ) : (
                <div className="kanban">
                  {KANBAN_COLUMNS.map(([bucket, label]) => (
                    <div key={bucket} className="kanban-column">
                      <div className="kanban-column-header">
                        {label}
                        <span className="kanban-column-count">
                          {kanbanGroups[bucket]?.length ?? 0}
                        </span>
                      </div>
                      <div className="kanban-cards scroll-region">
                        {(kanbanGroups[bucket] ?? []).map((task) => {
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
                        {(kanbanGroups[bucket] ?? []).length === 0 ? (
                          <p className="kanban-empty">No tasks</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
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
              emptyMessage="No upcoming tasks — prior stages will unlock work for you."
            />
          </TabsContent>

          <TabsContent value="completed">
            <TaskList
              tasks={center?.completed ?? []}
              emptyMessage="No recently completed tasks."
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
