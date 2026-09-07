"use client";

import { useMemo, useState } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { AppButton } from "@/components/ui/AppButton";
import { ActionHandoffBanner } from "@/components/tasks/ActionHandoffBanner";
import { useEmployeeOptions } from "@/hooks/use-corrections";
import { useAssignTask } from "@/hooks/use-tasks";
import type { HandoffContext } from "@/lib/handoff-context";
import type { DesignTask } from "@/lib/types/api";

type TaskWithOptionalRole = DesignTask & {
  assignedRole?: { id?: number; name?: string; code?: string } | null;
  subProcess: DesignTask["subProcess"] & {
    defaultRole?: { id?: number; name?: string; code?: string } | null;
  };
};

type AssignTaskModalProps = {
  open: boolean;
  task: DesignTask | null;
  onClose: () => void;
};

export function AssignTaskModal({ open, task, onClose }: AssignTaskModalProps) {
  const employeesQuery = useEmployeeOptions(open);
  const assignTask = useAssignTask();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const employees = employeesQuery.data ?? [];
  const selectedEmployee = employees.find((e) => String(e.id) === employeeId);
  const employeeError = !employeeId ? "Employee is required" : undefined;

  const handoff = useMemo((): HandoffContext | null => {
    if (!task) return null;
    const enriched = task as TaskWithOptionalRole;
    const expectedRole =
      enriched.assignedRole?.name ??
      enriched.subProcess.defaultRole?.name ??
      null;

    const selectedLabel = selectedEmployee
      ? `${selectedEmployee.name} (${selectedEmployee.role.name})`
      : null;

    return {
      ideaRef: task.design?.ideaRef ?? null,
      collectionName: task.design?.collectionName ?? null,
      priority: task.design?.priority ?? task.priority ?? null,
      stageCode: task.subProcess.code,
      stageName: task.subProcess.name,
      assigneeName: task.assignedEmployee?.name ?? null,
      status: task.status,
      description: expectedRole ? `Expected role: ${expectedRole}` : null,
      nextStepHint: selectedLabel
        ? `Assigns this stage to ${selectedLabel}`
        : "Assigns this stage to the selected employee",
    };
  }, [task, selectedEmployee]);

  async function handleSubmit() {
    setAttemptedSubmit(true);
    if (!task || employeeError) return;
    await assignTask.mutateAsync({ taskId: task.id, employeeId: Number(employeeId) });
    setAttemptedSubmit(false);
    onClose();
    setEmployeeId(null);
  }

  function handleClose() {
    setEmployeeId(null);
    setAttemptedSubmit(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={task ? `Assign: ${task.subProcess.name}` : "Assign Task"}
      onClose={handleClose}
      size="sm"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={handleClose}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            appVariant="primary"
            disabled={assignTask.isPending}
            onClick={handleSubmit}
          >
            {assignTask.isPending ? "Assigning…" : "Assign"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <ActionHandoffBanner context={handoff} dense />
        <FormSelect
          id="assignEmployee"
          label="Employee"
          required
          value={employeeId}
          onValueChange={(v) => {
            setEmployeeId(v);
            setAttemptedSubmit(false);
          }}
          placeholder="Select…"
          options={employees.map((e) => ({
            value: String(e.id),
            label: `${e.name} (${e.role.name})`,
          }))}
          error={attemptedSubmit ? employeeError : undefined}
        />
      </ModalForm>
    </Modal>
  );
}
