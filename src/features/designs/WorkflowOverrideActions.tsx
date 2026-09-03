"use client";

import { useMemo, useState } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { AppButton } from "@/components/ui/AppButton";
import {
  isDesignClosedForOverride,
  isQcCheckTask,
} from "@/lib/services/workflow-override-utils";
import {
  useBypassDesignPhase,
  useSendDesignToQc,
} from "@/hooks/use-designs";
import type { DesignSummary, DesignTask } from "@/lib/types/api";

type WorkflowOverrideActionsProps = {
  designId: string;
  design: DesignSummary;
};

function taskLabel(task: DesignTask) {
  return `#${task.sequence} ${task.subProcess.name} (${task.status.replace(/_/g, " ")})`;
}

export function WorkflowOverrideActions({ designId, design }: WorkflowOverrideActionsProps) {
  const [sendQcOpen, setSendQcOpen] = useState(false);
  const [bypassOpen, setBypassOpen] = useState(false);
  const [targetTaskId, setTargetTaskId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const sendQc = useSendDesignToQc(designId);
  const bypass = useBypassDesignPhase(designId);

  const qcTasks = useMemo(() => {
    const tasks = design.tasks ?? [];
    return tasks.filter(
      (t) =>
        isQcCheckTask({
          code: t.subProcess.code,
          isApproval: t.subProcess.isApproval,
        }) && t.status !== "COMPLETED",
    );
  }, [design.tasks]);

  const bypassTasks = useMemo(() => {
    const tasks = design.tasks ?? [];
    return tasks.filter((t) => t.status !== "COMPLETED");
  }, [design.tasks]);

  const reasonOk = reason.trim().length >= 10;
  const isPending = sendQc.isPending || bypass.isPending;
  const designClosed = isDesignClosedForOverride(design.status);

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

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <AppButton
          type="button"
          appVariant="outline"
          size="sm"
          disabled={qcOptions.length === 0 || isPending}
          onClick={() => {
            setTargetTaskId(qcOptions[0]?.value ?? null);
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
            setBypassOpen(true);
          }}
        >
          Bypass to phase
        </AppButton>
      </div>

      <Modal
        open={sendQcOpen}
        title="Send to QC phase"
        onClose={resetAndClose}
        footer={
          <ModalFooterActions>
            <AppButton type="button" appVariant="outline" onClick={resetAndClose} disabled={isPending}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              appVariant="primary"
              disabled={!targetTaskId || !reasonOk || isPending}
              onClick={submitSendQc}
            >
              {sendQc.isPending ? "Sending…" : "Send to QC"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <FormSelect
            id="qcTarget"
            label="QC phase"
            required
            value={targetTaskId}
            onValueChange={setTargetTaskId}
            options={qcOptions}
            placeholder="Select…"
            disabled={isPending}
          />
          <FormTextArea
            id="qcReason"
            label="Reason"
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
            error={
              reason.length > 0 && !reasonOk
                ? "Minimum 10 characters"
                : undefined
            }
          />
        </ModalForm>
      </Modal>

      <Modal
        open={bypassOpen}
        title="Bypass to phase"
        onClose={resetAndClose}
        footer={
          <ModalFooterActions>
            <AppButton type="button" appVariant="outline" onClick={resetAndClose} disabled={isPending}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              appVariant="primary"
              disabled={!targetTaskId || !reasonOk || isPending}
              onClick={submitBypass}
            >
              {bypass.isPending ? "Bypassing…" : "Bypass to phase"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <FormSelect
            id="bypassTarget"
            label="Target phase"
            required
            value={targetTaskId}
            onValueChange={setTargetTaskId}
            options={bypassOptions}
            placeholder="Select…"
            disabled={isPending}
          />
          <FormTextArea
            id="bypassReason"
            label="Reason"
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
            error={
              reason.length > 0 && !reasonOk
                ? "Minimum 10 characters"
                : undefined
            }
          />
        </ModalForm>
      </Modal>
    </>
  );
}
