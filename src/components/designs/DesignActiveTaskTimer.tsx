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

  const isRunning = task.status === "RUNNING";
  const isOnHold = task.status === "ON_HOLD";
  if (!isRunning && !isOnHold) return null;

  const fileRequired = !!task.subProcess?.isFileRequired;
  const isSampleCheck = task.subProcess?.code === "SAMPLE_CHECK";
  const taskChecklistItems =
    checklistQuery.data?.filter((item) => item.subProcessId === task.subProcess?.id) ?? [];

  const holdDialogConfig = getTaskHoldDialogConfig({
    status: task.status,
    subProcess: task.subProcess,
    design: task.design,
  });
  const endDialogConfig = getTaskEndDialogConfig(
    {
      status: task.status,
      subProcess: task.subProcess,
      design: task.design,
    },
    roleCode,
  );

  async function handleHoldSubmit() {
    if (!holdReasonId) return;
    await hold.mutateAsync({
      taskId: task.id,
      holdReasonId: Number(holdReasonId),
      remark: holdRemark || undefined,
      version: task.version,
    });
    setHoldModalOpen(false);
    setHoldRemark("");
  }

  async function handleEndSubmit() {
    if (!endRemark.trim()) return;
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
