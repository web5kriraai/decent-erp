"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { AppButton } from "@/components/ui/AppButton";
import { ActionHandoffBanner } from "@/components/tasks/ActionHandoffBanner";
import {
  isDesignClosedForOverride,
  isOpenTaskStatus,
  isQcCheckTask,
} from "@/lib/services/workflow-override-utils";
import {
  useBypassDesignPhase,
  useSendDesignToQc,
} from "@/hooks/use-designs";
import type { HandoffContext } from "@/lib/handoff-context";
import type { DesignSummary, DesignTask } from "@/lib/types/api";

type WorkflowOverrideActionsProps = {
  designId: string;
  design: DesignSummary;
  /** `inline` embeds forms in the right drawer (no nested centered dialog). */
  presentation?: "modal" | "inline";
};

function taskLabel(task: DesignTask) {
  return `#${task.sequence} ${task.subProcess.name} (${task.status.replace(/_/g, " ")})`;
}

function stagesSkippedBeforeTarget(
  tasks: DesignTask[],
  targetTaskId: string | null,
): DesignTask[] {
  if (!targetTaskId) return [];
  const target = tasks.find((t) => t.id === targetTaskId);
  if (!target) return [];
  return tasks.filter(
    (t) =>
      t.id !== target.id &&
      t.sequence < target.sequence &&
      isOpenTaskStatus(t.status),
  );
}

function buildOverrideHandoff(
  design: DesignSummary,
  target: DesignTask | undefined,
  skipped: DesignTask[],
  kind: "qc" | "bypass",
): HandoffContext {
  const targetLabel = target
    ? `${target.subProcess.name}${
        target.assignedEmployee?.name ? ` → ${target.assignedEmployee.name}` : ""
      }`
    : null;

  const skipNames = skipped.map((t) => t.subProcess.name);
  const blockers =
    skipNames.length > 0
      ? [
          `Will skip ${skipNames.length} open stage${skipNames.length === 1 ? "" : "s"}: ${skipNames.join(", ")}`,
        ]
      : undefined;

  return {
    ideaRef: design.ideaRef,
    collectionName: design.collectionName,
    productType: design.productType?.name ?? null,
    priority: design.priority,
    stageCode: target?.subProcess.code ?? null,
    stageName: target?.subProcess.name ?? null,
    assigneeName: target?.assignedEmployee?.name ?? null,
    status: target?.status ?? design.status,
    description:
      kind === "qc"
        ? "Jumps ahead to a QC / check phase. Open stages before the target will be skipped."
        : "Bypasses to a chosen phase. Open stages before the target will be skipped.",
    nextStepHint: targetLabel
      ? kind === "qc"
        ? `Send to QC phase: ${targetLabel}`
        : `Bypass to phase: ${targetLabel}`
      : "Select a target phase",
    blockers,
  };
}

function InlineShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mt-2 w-full space-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ModalForm className="gap-3">{children}</ModalForm>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
    </div>
  );
}

export function WorkflowOverrideActions({
  designId,
  design,
  presentation = "modal",
}: WorkflowOverrideActionsProps) {
  const [sendQcOpen, setSendQcOpen] = useState(false);
  const [bypassOpen, setBypassOpen] = useState(false);
  const [targetTaskId, setTargetTaskId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const sendQc = useSendDesignToQc(designId);
  const bypass = useBypassDesignPhase(designId);

  const tasks = design.tasks ?? [];

  const qcTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        isQcCheckTask({
          code: t.subProcess.code,
          isApproval: t.subProcess.isApproval,
        }) && t.status !== "COMPLETED",
    );
  }, [tasks]);

  const bypassTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== "COMPLETED");
  }, [tasks]);

  const reasonOk = reason.trim().length >= 10;
  const isPending = sendQc.isPending || bypass.isPending;
  const designClosed = isDesignClosedForOverride(design.status);
  const inline = presentation === "inline";

  const skippedForTarget = useMemo(
    () => stagesSkippedBeforeTarget(tasks, targetTaskId),
    [tasks, targetTaskId],
  );
  const targetTask = tasks.find((t) => t.id === targetTaskId);

  const sendQcHandoff = useMemo(
    () => buildOverrideHandoff(design, targetTask, skippedForTarget, "qc"),
    [design, targetTask, skippedForTarget],
  );
  const bypassHandoff = useMemo(
    () => buildOverrideHandoff(design, targetTask, skippedForTarget, "bypass"),
    [design, targetTask, skippedForTarget],
  );

  if (designClosed) {
    return null;
  }

  function resetAndClose() {
    setSendQcOpen(false);
    setBypassOpen(false);
    setTargetTaskId(null);
    setReason("");
  }

  async function submitSendQc() {
    if (!targetTaskId || !reasonOk) return;
    await sendQc.mutateAsync({ targetTaskId, reason: reason.trim() });
    resetAndClose();
  }

  async function submitBypass() {
    if (!targetTaskId || !reasonOk) return;
    await bypass.mutateAsync({ targetTaskId, reason: reason.trim() });
    resetAndClose();
  }

  const qcOptions = qcTasks.map((t) => ({
    value: t.id,
    label: taskLabel(t),
  }));

  const bypassOptions = bypassTasks.map((t) => ({
    value: t.id,
    label: taskLabel(t),
  }));

  const formFields = (kind: "qc" | "bypass") => (
    <>
      <ActionHandoffBanner
        context={kind === "qc" ? sendQcHandoff : bypassHandoff}
        dense={inline}
      />
      <ModalFormGrid>
        <FormSelect
          id={kind === "qc" ? "qcTarget" : "bypassTarget"}
          label={kind === "qc" ? "QC phase" : "Target phase"}
          required
          value={targetTaskId}
          onValueChange={setTargetTaskId}
          options={kind === "qc" ? qcOptions : bypassOptions}
          placeholder="Select…"
          disabled={isPending}
        />
        <FormTextArea
          id={kind === "qc" ? "qcReason" : "bypassReason"}
          label="Reason"
          required
          rows={inline ? 2 : 3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={isPending}
          onEnterSubmit={
            targetTaskId && reasonOk && !isPending
              ? () => void (kind === "qc" ? submitSendQc() : submitBypass())
              : undefined
          }
          error={reason.length > 0 && !reasonOk ? "Minimum 10 characters" : undefined}
        />
      </ModalFormGrid>
    </>
  );

  const footerFor = (kind: "qc" | "bypass") => (
    <>
      <AppButton type="button" appVariant="outline" size="sm" onClick={resetAndClose} disabled={isPending}>
        Cancel
      </AppButton>
      <AppButton
        type="button"
        appVariant="primary"
        size="sm"
        disabled={!targetTaskId || !reasonOk || isPending}
        onClick={() => void (kind === "qc" ? submitSendQc() : submitBypass())}
      >
        {kind === "qc"
          ? sendQc.isPending
            ? "Sending…"
            : "Send to QC"
          : bypass.isPending
            ? "Bypassing…"
            : "Bypass to phase"}
      </AppButton>
    </>
  );

  return (
    <div className="w-full space-y-2">
      {!sendQcOpen && !bypassOpen ? (
        <div className="flex flex-wrap gap-2">
          <AppButton
            type="button"
            appVariant="outline"
            size="sm"
            disabled={qcOptions.length === 0 || isPending}
            onClick={() => {
              setTargetTaskId(qcOptions[0]?.value ?? null);
              setBypassOpen(false);
              setSendQcOpen(true);
            }}
          >
            Send to QC phase
          </AppButton>
          <AppButton
            type="button"
            appVariant="outline"
            size="sm"
            disabled={bypassOptions.length === 0 || isPending}
            onClick={() => {
              setTargetTaskId(bypassOptions[0]?.value ?? null);
              setSendQcOpen(false);
              setBypassOpen(true);
            }}
          >
            Bypass to phase
          </AppButton>
        </div>
      ) : null}

      {inline && sendQcOpen ? (
        <InlineShell title="Send to QC phase" footer={footerFor("qc")}>
          {formFields("qc")}
        </InlineShell>
      ) : null}

      {inline && bypassOpen ? (
        <InlineShell title="Bypass to phase" footer={footerFor("bypass")}>
          {formFields("bypass")}
        </InlineShell>
      ) : null}

      {!inline ? (
        <>
          <Modal
            open={sendQcOpen}
            title="Send to QC phase"
            onClose={resetAndClose}
            footer={<ModalFooterActions>{footerFor("qc")}</ModalFooterActions>}
          >
            <ModalForm>{formFields("qc")}</ModalForm>
          </Modal>

          <Modal
            open={bypassOpen}
            title="Bypass to phase"
            onClose={resetAndClose}
            footer={<ModalFooterActions>{footerFor("bypass")}</ModalFooterActions>}
          >
            <ModalForm>{formFields("bypass")}</ModalForm>
          </Modal>
        </>
      ) : null}
    </div>
  );
}
