"use client";

import { useMemo, useState } from "react";
import {
  Modal,
  ModalAlert,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
  ModalSection,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { Button } from "@/components/ui/button";
import { useAdminRoles } from "@/hooks/use-admin-roles";
import { useProcessMasters, useProductTypes } from "@/hooks/use-masters";
import type { CreateWorkflowPatternPayload, Priority, WorkflowPattern } from "@/lib/types/api";

type TaskDraft = {
  id: string;
  processId: number | "";
  subProcessId: number | "";
  defaultRoleId: number | "";
  expectedMinutes: string;
  dayOffset: string;
  priority: Priority | "";
  dependencySequence: string;
};

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

function emptyTask(index: number): TaskDraft {
  return {
    id: `task-${index}-${Date.now()}`,
    processId: "",
    subProcessId: "",
    defaultRoleId: "",
    expectedMinutes: "60",
    dayOffset: "0",
    priority: "MEDIUM",
    dependencySequence: "",
  };
}

type CreateWorkflowPatternModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateWorkflowPatternPayload) => void;
  isPending: boolean;
  editPattern?: WorkflowPattern | null;
  onSubmitEdit?: (
    patternId: number,
    payload: { name: string; tasks: CreateWorkflowPatternPayload["tasks"] },
  ) => void;
  isEditPending?: boolean;
};

export function CreateWorkflowPatternModal({
  open,
  onClose,
  onSubmit,
  isPending,
  editPattern = null,
  onSubmitEdit,
  isEditPending = false,
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

  function resetForm() {
    setName("");
    setProductTypeId("");
    setVersionNo("1");
    setTasks([emptyTask(0)]);
    setFormError(null);
  }

  const formMode = open ? (editPattern ? `edit-${editPattern.id}` : "create") : "closed";
  const [loadedMode, setLoadedMode] = useState("closed");

  if (formMode !== loadedMode) {
    setLoadedMode(formMode);
    if (editPattern && formMode.startsWith("edit-")) {
      setName(editPattern.name);
      setProductTypeId(editPattern.productTypeId ?? "");
      setVersionNo(String(editPattern.versionNo));
      setTasks(
        editPattern.tasks.map((task, index) => ({
          id: `edit-${task.id}-${index}`,
          processId: task.processId,
          subProcessId: task.subProcessId,
          defaultRoleId: task.defaultRoleId,
          expectedMinutes: String(task.expectedMinutes),
          dayOffset: String(task.dayOffset ?? 0),
          priority: task.priority ?? "MEDIUM",
          dependencySequence:
            task.dependencySequence != null ? String(task.dependencySequence) : "",
        })),
      );
      setFormError(null);
    } else if (formMode === "create") {
      resetForm();
    } else {
      resetForm();
    }
  }

  const canSubmit = useMemo(() => {
    if (editPattern) {
      if (!name.trim() || tasks.length === 0) return false;
      return tasks.every(
        (task) =>
          task.processId &&
          task.subProcessId &&
          task.defaultRoleId &&
          Number(task.expectedMinutes) > 0,
      );
    }
    if (!name.trim()) return false;
    if (tasks.length === 0) return false;
    return tasks.every(
      (task) =>
        task.processId &&
        task.subProcessId &&
        task.defaultRoleId &&
        Number(task.expectedMinutes) > 0,
    );
  }, [name, tasks, editPattern]);

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

    let taskPayload: CreateWorkflowPatternPayload["tasks"];
    try {
      taskPayload = tasks.map((task, index) => {
        const sequence = index + 1;
        const dependencySequence =
          task.dependencySequence.trim() === "" ? null : Number(task.dependencySequence);
        if (
          dependencySequence != null &&
          (dependencySequence >= sequence || dependencySequence < 1)
        ) {
          throw new Error(`Step ${sequence}: dependency must be a prior step number.`);
        }
        return {
          processId: Number(task.processId),
          subProcessId: Number(task.subProcessId),
          defaultRoleId: Number(task.defaultRoleId),
          expectedMinutes: Number(task.expectedMinutes),
          sequence,
          dayOffset: Number(task.dayOffset) || 0,
          priority: (task.priority || "MEDIUM") as Priority,
          dependencySequence,
        };
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invalid task configuration.");
      return;
    }

    if (editPattern && onSubmitEdit) {
      onSubmitEdit(editPattern.id, { name: name.trim(), tasks: taskPayload });
      return;
    }

    onSubmit({
      name: name.trim(),
      productTypeId: productTypeId === "" ? null : productTypeId,
      versionNo: Number(versionNo) || 1,
      tasks: taskPayload,
    });
  }

  const isEditMode = !!editPattern;
  const submitPending = isEditMode ? isEditPending : isPending;

  return (
    <Modal
      open={open}
      title={isEditMode ? "Edit workflow pattern" : "Create Workflow Pattern"}
      description={
        isEditMode
          ? "Update the pattern name and task steps. In-flight designs keep their existing tasks."
          : "Define a reusable sequence of process steps for new designs."
      }
      onClose={handleClose}
      size="xl"
      footer={
        <ModalFooterActions>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit || submitPending} onClick={handleSubmit}>
            {submitPending
              ? isEditMode
                ? "Saving…"
                : "Creating…"
              : isEditMode
                ? "Save changes"
                : "Create Pattern"}
          </Button>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        {formError ? <ModalAlert variant="error">{formError}</ModalAlert> : null}
        {isEditMode ? (
          <ModalAlert variant="warning">
            Changes apply to new designs only. Designs already in progress are not modified.
          </ModalAlert>
        ) : null}

        {isEditMode ? (
          <FormTextField
            id="patternNameEdit"
            label="Pattern Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        ) : (
          <>
            <FormTextField
              id="patternName"
              label="Pattern Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Saree Development"
            />

            <ModalFormGrid>
              <FormSelect
                id="patternProductType"
                label="Product Type"
                value={productTypeId === "" ? null : String(productTypeId)}
                onValueChange={(v) => setProductTypeId(v ? Number(v) : "")}
                options={(productTypesQuery.data ?? []).map((pt) => ({
                  value: String(pt.id),
                  label: pt.name,
                }))}
                placeholder="Any product type"
              />
              <FormTextField
                id="patternVersion"
                label="Version"
                type="number"
                min={1}
                value={versionNo}
                onChange={(e) => setVersionNo(e.target.value)}
              />
            </ModalFormGrid>
          </>
        )}

        <ModalSection
          title="Task Steps"
          description="Add each process step in execution order."
          action={
            <Button type="button" variant="outline" size="sm" onClick={addTaskRow}>
              Add Step
            </Button>
          }
        >
          <div className="space-y-3">
            {tasks.map((task, index) => {
              const process = processes.find((p) => p.id === task.processId);
              const subProcesses = process?.subProcesses ?? [];

              return (
                <div
                  key={task.id}
                  className="space-y-3 rounded-lg border border-border bg-muted/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Step {index + 1}</p>
                    {tasks.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => removeTaskRow(task.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <ModalFormGrid>
                    <FormSelect
                      id={`task-${task.id}-process`}
                      label="Process"
                      required
                      value={task.processId === "" ? null : String(task.processId)}
                      onValueChange={(v) =>
                        handleProcessChange(task, v ? Number(v) : "")
                      }
                      options={processes.map((p) => ({
                        value: String(p.id),
                        label: p.name,
                      }))}
                      placeholder="Select process"
                    />
                    <FormSelect
                      id={`task-${task.id}-subprocess`}
                      label="Sub-process"
                      required
                      value={task.subProcessId === "" ? null : String(task.subProcessId)}
                      onValueChange={(v) =>
                        handleSubProcessChange(task, v ? Number(v) : "")
                      }
                      options={subProcesses.map((sp) => ({
                        value: String(sp.id),
                        label: sp.name,
                      }))}
                      placeholder="Select sub-process"
                      disabled={!task.processId}
                    />
                  </ModalFormGrid>

                  <ModalFormGrid>
                    <FormSelect
                      id={`task-${task.id}-role`}
                      label="Default Role"
                      required
                      value={task.defaultRoleId === "" ? null : String(task.defaultRoleId)}
                      onValueChange={(v) =>
                        updateTask(task.id, {
                          defaultRoleId: v ? Number(v) : "",
                        })
                      }
                      options={roles.map((role) => ({
                        value: String(role.id),
                        label: role.displayName,
                      }))}
                      placeholder="Select role"
                    />
                    <FormTextField
                      id={`task-${task.id}-minutes`}
                      label="Minutes"
                      required
                      type="number"
                      min={1}
                      value={task.expectedMinutes}
                      onChange={(e) =>
                        updateTask(task.id, { expectedMinutes: e.target.value })
                      }
                    />
                  </ModalFormGrid>

                  <ModalFormGrid>
                    <FormTextField
                      id={`task-${task.id}-dayOffset`}
                      label="Day Offset"
                      type="number"
                      min={0}
                      value={task.dayOffset}
                      onChange={(e) => updateTask(task.id, { dayOffset: e.target.value })}
                    />
                    <FormSelect
                      id={`task-${task.id}-priority`}
                      label="Priority"
                      value={task.priority || "MEDIUM"}
                      onValueChange={(v) =>
                        updateTask(task.id, { priority: (v as Priority) || "MEDIUM" })
                      }
                      options={PRIORITY_OPTIONS.map((p) => ({
                        value: p.value,
                        label: p.label,
                      }))}
                    />
                    <FormSelect
                      id={`task-${task.id}-dependency`}
                      label="Depends On Step"
                      value={task.dependencySequence === "" ? null : task.dependencySequence}
                      onValueChange={(v) =>
                        updateTask(task.id, { dependencySequence: v ?? "" })
                      }
                      options={Array.from({ length: index }, (_, i) => ({
                        value: String(i + 1),
                        label: `Step ${i + 1}`,
                      }))}
                      placeholder="None"
                    />
                  </ModalFormGrid>
                </div>
              );
            })}
          </div>
        </ModalSection>
      </ModalForm>
    </Modal>
  );
}
