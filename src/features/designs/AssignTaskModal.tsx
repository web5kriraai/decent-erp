"use client";

import { useState } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { AppButton } from "@/components/ui/AppButton";
import { useEmployeeOptions } from "@/hooks/use-corrections";
import { useAssignTask } from "@/hooks/use-tasks";
import type { DesignTask } from "@/lib/types/api";

type AssignTaskModalProps = {
  open: boolean;
  task: DesignTask | null;
  onClose: () => void;
};

export function AssignTaskModal({ open, task, onClose }: AssignTaskModalProps) {
  const employeesQuery = useEmployeeOptions(open);
  const assignTask = useAssignTask();
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  async function handleSubmit() {
    if (!task || !employeeId) return;
    await assignTask.mutateAsync({ taskId: task.id, employeeId: Number(employeeId) });
    onClose();
    setEmployeeId(null);
  }

  return (
    <Modal
      open={open}
      title={task ? `Assign: ${task.subProcess.name}` : "Assign Task"}
      onClose={onClose}
      size="sm"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            appVariant="primary"
            disabled={!employeeId || assignTask.isPending}
            onClick={handleSubmit}
          >
            {assignTask.isPending ? "Assigning…" : "Assign"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <FormSelect
          id="assignEmployee"
          label="Employee"
          required
          value={employeeId}
          onValueChange={setEmployeeId}
          placeholder="Select…"
          options={(employeesQuery.data ?? []).map((e) => ({
            value: String(e.id),
            label: `${e.name} (${e.role.name})`,
          }))}
        />
      </ModalForm>
    </Modal>
  );
}
