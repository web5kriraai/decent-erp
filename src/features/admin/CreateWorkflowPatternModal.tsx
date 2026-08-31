"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useAdminRoles } from "@/hooks/use-admin-roles";
import { useProcessMasters, useProductTypes } from "@/hooks/use-masters";
import type { CreateWorkflowPatternPayload } from "@/lib/types/api";

type TaskDraft = {
  id: string;
  processId: number | "";
  subProcessId: number | "";
  defaultRoleId: number | "";
  expectedMinutes: string;
};

function emptyTask(index: number): TaskDraft {
  return {
    id: `task-${index}-${Date.now()}`,
    processId: "",
    subProcessId: "",
    defaultRoleId: "",
    expectedMinutes: "60",
  };
}

type CreateWorkflowPatternModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateWorkflowPatternPayload) => void;
  isPending: boolean;
};

export function CreateWorkflowPatternModal({
  open,
  onClose,
  onSubmit,
  isPending,
}: CreateWorkflowPatternModalProps) {
  const processesQuery = useProcessMasters(open);
  const productTypesQuery = useProductTypes(open);
  const rolesQuery = useAdminRoles(open);

  const [name, setName] = useState("");
  const [productTypeId, setProductTypeId] = useState<number | "">("");
  const [versionNo, setVersionNo] = useState("1");
  const [tasks, setTasks] = useState<TaskDraft[]>(() => [emptyTask(0)]);
  const [formError, setFormError] = useState<string | null>(null);

  const processes = processesQuery.data ?? [];
  const roles = rolesQuery.data ?? [];

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (tasks.length === 0) return false;
    return tasks.every(
      (task) =>
        task.processId &&
        task.subProcessId &&
        task.defaultRoleId &&
        Number(task.expectedMinutes) > 0,
    );
  }, [name, tasks]);

  function resetForm() {
    setName("");
    setProductTypeId("");
    setVersionNo("1");
    setTasks([emptyTask(0)]);
    setFormError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function updateTask(id: string, patch: Partial<TaskDraft>) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }

  function handleProcessChange(task: TaskDraft, processId: number | "") {
    updateTask(task.id, { processId, subProcessId: "", defaultRoleId: "" });
  }

  function handleSubProcessChange(task: TaskDraft, subProcessId: number | "") {
    if (!task.processId || !subProcessId) {
      updateTask(task.id, { subProcessId, defaultRoleId: "" });
      return;
    }

    const process = processes.find((p) => p.id === task.processId);
    const subProcess = process?.subProcesses.find((sp) => sp.id === subProcessId);
    updateTask(task.id, {
      subProcessId,
      defaultRoleId: subProcess?.defaultRoleId ?? task.defaultRoleId,
    });
  }

  function addTaskRow() {
    setTasks((prev) => [...prev, emptyTask(prev.length)]);
  }

  function removeTaskRow(id: string) {
    setTasks((prev) => (prev.length <= 1 ? prev : prev.filter((task) => task.id !== id)));
  }

  function handleSubmit() {
    setFormError(null);

    if (!canSubmit) {
      setFormError("Complete all task steps before saving.");
      return;
    }

    onSubmit({
      name: name.trim(),
      productTypeId: productTypeId === "" ? null : productTypeId,
      versionNo: Number(versionNo) || 1,
      tasks: tasks.map((task, index) => ({
        processId: Number(task.processId),
        subProcessId: Number(task.subProcessId),
        defaultRoleId: Number(task.defaultRoleId),
        expectedMinutes: Number(task.expectedMinutes),
        sequence: index + 1,
      })),
    });
  }

  return (
    <Modal
      open={open}
      title="Create Workflow Pattern"
      onClose={handleClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit || isPending}
            onClick={handleSubmit}
          >
            {isPending ? "Creating…" : "Create Pattern"}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: "1rem" }}>
        {formError && <p className="form-error">{formError}</p>}

        <div className="form-group">
          <label className="form-label" htmlFor="patternName">
            Pattern Name *
          </label>
          <input
            id="patternName"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard Saree Development"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "1rem" }}>
          <div className="form-group">
            <label className="form-label" htmlFor="patternProductType">
              Product Type
            </label>
            <select
              id="patternProductType"
              className="form-input"
              value={productTypeId}
              onChange={(e) =>
                setProductTypeId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Any product type</option>
              {(productTypesQuery.data ?? []).map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="patternVersion">
              Version
            </label>
            <input
              id="patternVersion"
              type="number"
              min={1}
              className="form-input"
              value={versionNo}
              onChange={(e) => setVersionNo(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <span className="form-label">Task Steps *</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addTaskRow}>
              Add Step
            </button>
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            {tasks.map((task, index) => {
              const process = processes.find((p) => p.id === task.processId);
              const subProcesses = process?.subProcesses ?? [];

              return (
                <div
                  key={task.id}
                  className="card"
                  style={{ padding: "0.75rem", display: "grid", gap: "0.5rem" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong>Step {index + 1}</strong>
                    {tasks.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeTaskRow(task.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Process</label>
                      <select
                        className="form-input"
                        value={task.processId}
                        onChange={(e) =>
                          handleProcessChange(
                            task,
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                      >
                        <option value="">Select process</option>
                        {processes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Sub-process</label>
                      <select
                        className="form-input"
                        value={task.subProcessId}
                        disabled={!task.processId}
                        onChange={(e) =>
                          handleSubProcessChange(
                            task,
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                      >
                        <option value="">Select sub-process</option>
                        {subProcesses.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "0.5rem" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Default Role</label>
                      <select
                        className="form-input"
                        value={task.defaultRoleId}
                        onChange={(e) =>
                          updateTask(task.id, {
                            defaultRoleId: e.target.value ? Number(e.target.value) : "",
                          })
                        }
                      >
                        <option value="">Select role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Minutes</label>
                      <input
                        type="number"
                        min={1}
                        className="form-input"
                        value={task.expectedMinutes}
                        onChange={(e) =>
                          updateTask(task.id, { expectedMinutes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
