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
  buildHandoffContextFromTask,
} from "@/lib/task-dialog-config";
import { findPriorPeerForHandoff } from "@/lib/services/stage-approval-queue";
import {
  findControllableActiveTask,
  getTimerControlFlags,
} from "@/lib/task-control-capability";
import { resolveWorkOpenHref } from "@/lib/resolve-work-open-href";
import { AppButtonLink } from "@/components/ui/AppButton";
import type { DesignTask } from "@/lib/types/api";

type DesignActiveTaskTimerProps = {
  designId: string;
  employeeId?: number;
  tasks?: DesignTask[];
  roleCode?: string | null;
  permissions?: string[];
};

export function DesignActiveTaskTimer({
  designId,
  employeeId,
  tasks,
  roleCode,
  permissions = [],
}: DesignActiveTaskTimerProps) {
  const activeSummaryTask = useMemo(
    () =>
      findControllableActiveTask(tasks, {
        permissions,
        employeeId,
        roleCode,
      }),
    [tasks, permissions, employeeId, roleCode],
  );

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
  const [sampleOutcome, setSampleOutcome] = useState<
    "APPROVE" | "PASS" | "HOLD" | "REJECT" | "RESAMPLE" | ""
  >(
    "",
  );
  const [costEntries, setCostEntries] = useState<
    Array<{ costType: "TIME" | "MATERIAL" | "MACHINE" | "CORRECTION"; description?: string; amount: number }>
  >([]);

  if (!activeSummaryTask || !task || task.designId !== designId) {
    return null;
  }

  const activeTask = task;

  const endDialogConfig = getTaskEndDialogConfig(
    {
      status: activeTask.status,
      subProcess: activeTask.subProcess,
      design: activeTask.design,
      assignedEmployee: activeTask.assignedEmployee,
    },
    roleCode,
  );

  const timerFlags = getTimerControlFlags(activeTask, {
    endDialogMode: endDialogConfig.mode,
  });
  if (!timerFlags.isRunning && !timerFlags.isOnHold) return null;

  const fileRequired = !!activeTask.subProcess?.isFileRequired;
  const isSampleCheck = activeTask.subProcess?.code === "SAMPLE_CHECK";
  const taskChecklistItems =
    checklistQuery.data?.filter((item) => item.subProcessId === activeTask.subProcess?.id) ?? [];

  const holdDialogConfig = getTaskHoldDialogConfig({
    status: activeTask.status,
    subProcess: activeTask.subProcess,
    design: activeTask.design,
    assignedEmployee: activeTask.assignedEmployee,
  });

  const priorPeer = findPriorPeerForHandoff(
    activeTask.subProcess.code,
    activeTask.workflowPeers,
  );
  const priorStage = priorPeer
    ? {
        code: priorPeer.subProcess.code,
        name: priorPeer.subProcess.name,
        status: priorPeer.status,
        outputRemark: priorPeer.outputRemark,
        assigneeName: priorPeer.assignedEmployee?.name,
      }
    : null;

  const holdHandoff = buildHandoffContextFromTask(
    {
      status: activeTask.status,
      subProcess: activeTask.subProcess,
      design: {
        ideaRef: activeTask.design.ideaRef,
        collectionName: activeTask.design.collectionName,
        productType: activeTask.design.productType ?? undefined,
      },
      assignedEmployee: activeTask.assignedEmployee,
    },
    {
      description: holdDialogConfig.description,
      nextStepHint: holdDialogConfig.nextStepHint,
      priorStage,
    },
  );
  const endHandoff = buildHandoffContextFromTask(
    {
      status: activeTask.status,
      subProcess: activeTask.subProcess,
      design: {
        ideaRef: activeTask.design.ideaRef,
        collectionName: activeTask.design.collectionName,
        productType: activeTask.design.productType ?? undefined,
      },
      assignedEmployee: activeTask.assignedEmployee,
    },
    {
      description: endDialogConfig.description,
      nextStepHint: endDialogConfig.nextStepHint,
      priorStage,
    },
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
    const isCosting = endDialogConfig.costingEntry;
    const checklist = taskChecklistItems.map((item) => ({
      itemId: item.id,
      result: checklistResults[item.id] ?? false,
    }));
    const passed = checklist.filter((c) => c.result).length;
    const failed = checklist.length - passed;
    if (checklist.length > 0 && passed === 0) return;
    if (failed > 0 && !checklistNote.trim()) return;
    if (
      isSampleCheck &&
      (sampleOutcome === "APPROVE" || sampleOutcome === "PASS") &&
      failed > 0
    ) {
      return;
    }

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

  const taskOpenHref =
    resolveWorkOpenHref({ taskId: activeTask.id, designId, intent: "task" }) ??
    activeTask.id;

  return (
    <div>
      <TimerWidget
        status={timerFlags.isRunning ? "RUNNING" : "ON_HOLD"}
        elapsedSeconds={task.timeSummary.activeSeconds}
        taskLabel={`${task.process.name} → ${task.subProcess.name}`}
        onHold={
          timerFlags.showHold
            ? () => {
                setHoldModalOpen(true);
                setHoldReasonId("");
              }
            : undefined
        }
        onResume={
          timerFlags.showResume
            ? () => resume.mutate({ taskId: task.id, version: task.version })
            : undefined
        }
        onEnd={
          timerFlags.showEnd
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

      {timerFlags.blocksTimerEnd ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Finish with stage approval actions - not the timer End dialog. Hold still works.{" "}
          <AppButtonLink href={taskOpenHref} appVariant="ghost" size="sm">
            Open task approval
          </AppButtonLink>
        </p>
      ) : null}

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
        remarkLabel={holdDialogConfig.remarkLabel}
        remarkPlaceholder={holdDialogConfig.remarkPlaceholder}
        handoff={holdHandoff}
      />

      <TaskEndDialog
        open={endModalOpen && timerFlags.showEnd}
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
        remarkLabel={endDialogConfig.remarkLabel}
        remarkPlaceholder={endDialogConfig.remarkPlaceholder}
        handoff={endHandoff}
        showStatusSelect={endDialogConfig.showStatusSelect}
        costEntries={costEntries}
        onCostEntriesChange={setCostEntries}
        onSubmit={() => void handleEndSubmit()}
        isPending={end.isPending}
      />
    </div>
  );
}
