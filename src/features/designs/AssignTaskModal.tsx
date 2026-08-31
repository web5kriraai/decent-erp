"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
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
  const [employeeId, setEmployeeId] = useState<number | "">("");

  async function handleSubmit() {
    if (!task || !employeeId) return;
    await assignTask.mutateAsync({ taskId: task.id, employeeId: Number(employeeId) });
    onClose();
    setEmployeeId("");
  }

  return (
    <Modal
      open={open}
      title={task ? `Assign: ${task.subProcess.name}` : "Assign Task"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!employeeId || assignTask.isPending}
            onClick={handleSubmit}
          >
            Assign
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label" htmlFor="assignEmployee">
          Employee *
        </label>
        <select
          id="assignEmployee"
          className="form-select"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select employee…</option>
          {employeesQuery.data?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.role.name})
            </option>
          ))}
        </select>
      </div>
    </Modal>
  );
}
