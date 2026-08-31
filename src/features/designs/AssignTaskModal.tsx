"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { Button } from "@/components/ui/button";
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
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!employeeId || assignTask.isPending}
            onClick={handleSubmit}
          >
            Assign
          </Button>
        </>
      }
    >
      <FormSelect
        id="assignEmployee"
        label="Employee"
        required
        value={employeeId}
        onValueChange={setEmployeeId}
        placeholder="Select employee…"
        options={(employeesQuery.data ?? []).map((e) => ({
          value: String(e.id),
          label: `${e.name} (${e.role.name})`,
        }))}
      />
    </Modal>
  );
}
