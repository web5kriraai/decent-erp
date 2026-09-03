"use client";

import { useMemo, useState } from "react";
import { TimerWidget } from "@/components/TimerWidget";
import { TaskHoldDialog } from "@/components/tasks/TaskHoldDialog";
import { TaskEndDialog } from "@/components/tasks/TaskEndDialog";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useHoldReasons, useChecklistItems } from "@/hooks/use-masters";
import { useTaskTimeDetail } from "@/hooks/use-time";
import {
  getTaskEndDialogConfig,
  getTaskHoldDialogConfig,
} from "@/lib/task-dialog-config";
import type { DesignTask } from "@/lib/types/api";

type DesignActiveTaskTimerProps = {
  designId: string;
  employeeId?: number;
  tasks?: DesignTask[];
  roleCode?: string | null;
};

export function DesignActiveTaskTimer({
  designId,
  employeeId,
  tasks,
  roleCode,
}: DesignActiveTaskTimerProps) {
  const activeSummaryTask = useMemo(() => {
    if (employeeId == null) return null;
    return (
      (tasks ?? []).find(
        (t) =>
          t.assignedEmployeeId === employeeId &&
          (t.status === "RUNNING" || t.status === "ON_HOLD"),
      ) ?? null
    );
  }, [employeeId, tasks]);

  const detailQuery = useTaskTimeDetail(activeSummaryTask?.id ?? "", !!activeSummaryTask);
  const task = detailQuery.data;
  const holdReasons = useHoldReasons(!!activeSummaryTask);
  const checklistQuery = useChecklistItems(!!activeSummaryTask);
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

  if (!activeSummaryTask || !task || task.designId !== designId) {
    return null;
  }

  // Capture narrowed task for nested async handlers (TS control-flow).
  const activeTask = task;

  const isRunning = activeTask.status === "RUNNING";
  const isOnHold = activeTask.status === "ON_HOLD";
  if (!isRunning && !isOnHold) return null;

  const fileRequired = !!activeTask.subProcess?.isFileRequired;
  const isSampleCheck = activeTask.subProcess?.code === "SAMPLE_CHECK";
  const taskChecklistItems =
    checklistQuery.data?.filter((item) => item.subProcessId === activeTask.subProcess?.id) ?? [];

  const holdDialogConfig = getTaskHoldDialogConfig({
    status: activeTask.status,
    subProcess: activeTask.subProcess,
    design: activeTask.design,
  });
  const endDialogConfig = getTaskEndDialogConfig(
    {
      status: activeTask.status,
      subProcess: activeTask.subProcess,
      design: activeTask.design,
    },
    roleCode,
  );

  async function handleHoldSubmit() {
    if (!holdReasonId) return;
    await hold.mutateAsync({
      taskId: activeTask.id,
      holdReasonId: Number(holdReasonId),
      remark: holdRemark || undefined,
      version: activeTask.version,
    });
    setHoldModalOpen(false);
    setHoldRemark("");
  }

  async function handleEndSubmit() {
    if (!endRemark.trim()) return;
    if (isSampleCheck && !sampleOutcome) return;
    const isCosting = activeTask.subProcess?.code === "COSTING";
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
        : isCosting || endDialogConfig.forceChecking
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
    <div className="mb-4">
      <TimerWidget
        status={isRunning ? "RUNNING" : "ON_HOLD"}
        elapsedSeconds={task.timeSummary.activeSeconds}
        taskLabel={`${task.process.name} → ${task.subProcess.name}`}
        onHold={
          isRunning
            ? () => {
                setHoldModalOpen(true);
                setHoldReasonId("");
              }
            : undefined
        }
        onResume={
          isOnHold
            ? () => resume.mutate({ taskId: task.id, version: task.version })
            : undefined
        }
        onEnd={() => {
          setEndModalOpen(true);
          setEndRemark("");
          setChecklistNote("");
          setSampleOutcome("");
          setChecklistResults({});
          setEndStatus("CHECKING");
        }}
      />

      <TaskHoldDialog
        open={holdModalOpen}
        onClose={() => setHoldModalOpen(false)}
        holdReasons={holdReasons.data ?? []}
        holdReasonId={holdReasonId}
        onHoldReasonChange={setHoldReasonId}
        holdRemark={holdRemark}
        onHoldRemarkChange={setHoldRemark}
        onSubmit={() => void handleHoldSubmit()}
        isPending={hold.isPending}
        title={holdDialogConfig.title}
        description={holdDialogConfig.description}
        preferredHoldReasonCodes={holdDialogConfig.preferredHoldReasonCodes}
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
        fileRequired={endDialogConfig.fileRequired ?? fileRequired}
        taskId={task.id}
        designId={task.designId ?? designId}
        subProcessCode={task.subProcess.code}
        subProcessName={task.subProcess.name}
        canUpload
        isSampleCheck={endDialogConfig.showSampleOutcomes ?? isSampleCheck}
        sampleOutcome={sampleOutcome || undefined}
        onSampleOutcomeChange={setSampleOutcome}
        gateForcesChecking={endDialogConfig.forceChecking}
        dialogTitle={endDialogConfig.title}
        dialogDescription={endDialogConfig.description}
        costEntries={costEntries}
        onCostEntriesChange={setCostEntries}
        onSubmit={() => void handleEndSubmit()}
        isPending={end.isPending}
      />
    </div>
  );
}
