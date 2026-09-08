"use client";

import { useMemo, useState } from "react";
import {
  Modal,
  ModalAlert,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { Button } from "@/components/ui/button";
import { AppButton } from "@/components/ui/AppButton";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { useAdminRoles } from "@/hooks/use-admin-roles";
import { useProcessMasters, useProductTypes, useSkills } from "@/hooks/use-masters";
import type { CreateWorkflowPatternPayload, Priority, WorkflowPattern } from "@/lib/types/api";
import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";
import { parseStageCapabilities } from "@/lib/workflow/stage-capabilities";

type TaskDraft = {
  id: string;
  processId: number | "";
  subProcessId: number | "";
  defaultRoleId: number | "";
  defaultSkillId: number | "";
  expectedMinutes: string;
  /** YYYY-MM-DD deadline; stored as relative dayOffset on save. */
  deadline: string;
  priority: Priority | "";
  dependencySequence: string;
};

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const NO_SPINNER_CLASS =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addLocalDays(base: Date, days: number): Date {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function dayOffsetToDeadline(dayOffset: number): string {
  return toLocalDateString(addLocalDays(new Date(), Math.max(0, dayOffset)));
}

function deadlineToDayOffset(deadline: string): number {
  if (!deadline.trim()) return 0;
  const [year, month, day] = deadline.split("-").map(Number);
  if (!year || !month || !day) return 0;
  const target = new Date(year, month - 1, day);
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const end = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function emptyTask(index: number): TaskDraft {
  return {
    id: `task-${index}-${Date.now()}`,
    processId: "",
    subProcessId: "",
    defaultRoleId: "",
    defaultSkillId: "",
    expectedMinutes: "60",
    deadline: dayOffsetToDeadline(0),
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
  const skillsQuery = useSkills(open);

  const [name, setName] = useState("");
  const [productTypeId, setProductTypeId] = useState<number | "">("");
  const [versionNo, setVersionNo] = useState("1");
  const [tasks, setTasks] = useState<TaskDraft[]>(() => [emptyTask(0)]);
  const [formError, setFormError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const processes = processesQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const skills = skillsQuery.data ?? [];

  const stageOptions = useMemo(
    () =>
      processes.flatMap((process) =>
        (process.subProcesses ?? []).map((sub) => ({
          value: `${process.id}:${sub.id}`,
          label: `${sub.name} · ${process.name}`,
          processId: process.id,
          subProcessId: sub.id,
        })),
      ),
    [processes],
  );

  function resetForm() {
    setName("");
    setProductTypeId("");
    setVersionNo("1");
    setTasks([emptyTask(0)]);
    setFormError(null);
    setAttemptedSubmit(false);
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
          defaultSkillId: task.defaultSkillId ?? "",
          expectedMinutes: String(task.expectedMinutes),
          deadline: dayOffsetToDeadline(task.dayOffset ?? 0),
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
    if (!name.trim() || tasks.length === 0) return false;
    return tasks.every(
      (task) =>
        task.processId &&
        task.subProcessId &&
        task.defaultRoleId &&
        Number(task.expectedMinutes) > 0,
    );
  }, [name, tasks]);

  const capabilitySummary = useMemo(() => {
    const lines: string[] = [];
    const errors: string[] = [];
    tasks.forEach((task, index) => {
      if (!task.processId || !task.subProcessId) return;
      const process = processes.find((p) => p.id === task.processId);
      const sub = process?.subProcesses.find((sp) => sp.id === task.subProcessId);
      if (!sub) return;
      const behavior = resolveStageBehavior({
        code: sub.code,
        name: sub.name,
        isApproval: (sub as { isApproval?: boolean }).isApproval,
        isFileRequired: (sub as { isFileRequired?: boolean }).isFileRequired,
        capabilities:
          (sub as { capabilities?: unknown }).capabilities ??
          parseStageCapabilities((sub as { capabilities?: unknown }).capabilities),
      });
      const tags = [
        behavior.isApproval ? `approval:${behavior.approvalSurface}` : null,
        behavior.forcesChecking ? "checking" : null,
        behavior.machineOutput ? "machine" : null,
        behavior.costingEntry ? "costing" : null,
        behavior.unlockAfterDesignApproved ? "after approval" : null,
        behavior.autoAdvanceOnCreate ? "auto start" : null,
      ].filter(Boolean);
      lines.push(`Step ${index + 1} · ${sub.code}${tags.length ? ` (${tags.join(", ")})` : ""}`);
      if (behavior.isApproval && behavior.approvalSurface === "none") {
        errors.push(`Step ${index + 1} (${sub.code}): approval needs a surface.`);
      }
      if (
        behavior.isApproval &&
        behavior.workGateMode !== "always" &&
        !behavior.workPrecursorCode &&
        !task.dependencySequence
      ) {
        errors.push(
          `Step ${index + 1} (${sub.code}): approval needs workPrecursor or dependency.`,
        );
      }
    });
    return { lines, errors };
  }, [tasks, processes]);

  function handleClose() {
    resetForm();
    onClose();
  }

  function updateTask(id: string, patch: Partial<TaskDraft>) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }

  function handleStageChange(task: TaskDraft, stageValue: string | null) {
    if (!stageValue) {
      updateTask(task.id, {
        processId: "",
        subProcessId: "",
        defaultRoleId: "",
        defaultSkillId: "",
      });
      return;
    }

    const option = stageOptions.find((row) => row.value === stageValue);
    if (!option) return;

    const process = processes.find((p) => p.id === option.processId);
    const subProcess = process?.subProcesses.find((sp) => sp.id === option.subProcessId);
    const roleId = subProcess?.defaultRoleId ?? "";
    const matchingSkill =
      roleId !== "" ? skills.find((s) => s.defaultRoleId === roleId) : undefined;

    updateTask(task.id, {
      processId: option.processId,
      subProcessId: option.subProcessId,
      defaultRoleId: roleId,
      defaultSkillId: matchingSkill?.id ?? "",
    });
  }

  function handleRoleChange(task: TaskDraft, roleValue: string | null) {
    const roleId = roleValue ? Number(roleValue) : "";
    if (roleId === "") {
      updateTask(task.id, { defaultRoleId: "", defaultSkillId: "" });
      return;
    }

    const matchingSkill = skills.find((s) => s.defaultRoleId === roleId);
    const currentSkillStillValid =
      task.defaultSkillId !== "" &&
      skills.some((s) => s.id === task.defaultSkillId && s.defaultRoleId === roleId);

    updateTask(task.id, {
      defaultRoleId: roleId,
      defaultSkillId: currentSkillStillValid
        ? task.defaultSkillId
        : (matchingSkill?.id ?? ""),
    });
  }

  function skillsForRole(roleId: number | "") {
    if (roleId === "") return [];
    return skills.filter((skill) => skill.defaultRoleId === roleId);
  }

  function addTaskRow() {
    setTasks((prev) => [...prev, emptyTask(prev.length)]);
  }

  function removeTaskRow(id: string) {
    setTasks((prev) => (prev.length <= 1 ? prev : prev.filter((task) => task.id !== id)));
  }

  function moveTask(id: string, direction: "up" | "down") {
    setTasks((prev) => {
      const index = prev.findIndex((task) => task.id === id);
      if (index < 0) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];

      const seqMap = new Map([
        [String(index + 1), String(target + 1)],
        [String(target + 1), String(index + 1)],
      ]);

      return next.map((task) => {
        if (!task.dependencySequence) return task;
        const remapped = seqMap.get(task.dependencySequence);
        return remapped ? { ...task, dependencySequence: remapped } : task;
      });
    });
  }

  function handleSubmit() {
    setFormError(null);
    setAttemptedSubmit(true);

    if (!canSubmit) {
      setFormError("Complete all required fields before saving.");
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
          defaultSkillId: task.defaultSkillId === "" ? null : Number(task.defaultSkillId),
          expectedMinutes: Number(task.expectedMinutes),
          sequence,
          dayOffset: deadlineToDayOffset(task.deadline),
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
      onClose={handleClose}
      size="xl"
      footer={
        <ModalFooterActions>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitPending || capabilitySummary.errors.length > 0}
            onClick={handleSubmit}
          >
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
          <FormTextField
            id="patternNameEdit"
            label="Pattern Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={attemptedSubmit && !name.trim() ? "Pattern name is required" : undefined}
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
              error={attemptedSubmit && !name.trim() ? "Pattern name is required" : undefined}
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

        <div>
          <div className="form-row-header">
            <h3 className="pattern-task-list__title">Task Steps</h3>
            <AppButton type="button" appVariant="outline" size="sm" onClick={addTaskRow}>
              + Add Step
            </AppButton>
          </div>

          <div className="pattern-task-list">
            {tasks.map((task, index) => {
              const stageValue =
                task.processId && task.subProcessId
                  ? `${task.processId}:${task.subProcessId}`
                  : null;

              return (
                <div key={task.id} className="pattern-task-row">
                  <FormSelect
                    id={`task-${task.id}-stage`}
                    label="Stage"
                    required
                    value={stageValue}
                    onValueChange={(v) => handleStageChange(task, v)}
                    options={stageOptions.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    }))}
                    placeholder="Select stage…"
                    error={
                      attemptedSubmit && (!task.processId || !task.subProcessId)
                        ? "Stage is required"
                        : undefined
                    }
                  />
                  <FormSelect
                    id={`task-${task.id}-role`}
                    label="Role"
                    required
                    value={task.defaultRoleId === "" ? null : String(task.defaultRoleId)}
                    onValueChange={(v) => handleRoleChange(task, v)}
                    options={roles.map((role) => ({
                      value: String(role.id),
                      label: role.displayName,
                    }))}
                    placeholder="Select…"
                    error={
                      attemptedSubmit && !task.defaultRoleId ? "Role is required" : undefined
                    }
                  />
                  <FormSelect
                    id={`task-${task.id}-skill`}
                    label="Skill"
                    value={task.defaultSkillId === "" ? null : String(task.defaultSkillId)}
                    onValueChange={(v) =>
                      updateTask(task.id, {
                        defaultSkillId: v ? Number(v) : "",
                      })
                    }
                    options={skillsForRole(task.defaultRoleId).map((skill) => ({
                      value: String(skill.id),
                      label: skill.name,
                    }))}
                    placeholder={task.defaultRoleId ? "Any" : "Select role first"}
                    disabled={!task.defaultRoleId}
                  />
                  <FormTextField
                    id={`task-${task.id}-minutes`}
                    label="Mins"
                    required
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className={NO_SPINNER_CLASS}
                    value={task.expectedMinutes}
                    onChange={(e) => updateTask(task.id, { expectedMinutes: e.target.value })}
                    error={
                      attemptedSubmit &&
                      (!Number(task.expectedMinutes) || Number(task.expectedMinutes) <= 0)
                        ? "Required"
                        : undefined
                    }
                  />
                  <FormTextField
                    id={`task-${task.id}-deadline`}
                    label="Deadline"
                    type="date"
                    value={task.deadline}
                    onChange={(e) => updateTask(task.id, { deadline: e.target.value })}
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
                    label="Depends"
                    value={task.dependencySequence === "" ? null : task.dependencySequence}
                    onValueChange={(v) => updateTask(task.id, { dependencySequence: v ?? "" })}
                    options={Array.from({ length: index }, (_, i) => ({
                      value: String(i + 1),
                      label: `Step ${i + 1}`,
                    }))}
                    placeholder="None"
                  />
                  <div className="pattern-task-row__actions">
                    <TableIconActionGroup>
                      <TableIconAction
                        action="moveUp"
                        disabled={index === 0}
                        onClick={() => moveTask(task.id, "up")}
                        label={`Move step ${index + 1} up`}
                      />
                      <TableIconAction
                        action="moveDown"
                        disabled={index === tasks.length - 1}
                        onClick={() => moveTask(task.id, "down")}
                        label={`Move step ${index + 1} down`}
                      />
                      {tasks.length > 1 && (
                        <TableIconAction
                          action="remove"
                          onClick={() => removeTaskRow(task.id)}
                          label={`Remove step ${index + 1}`}
                        />
                      )}
                    </TableIconActionGroup>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ModalForm>
    </Modal>
  );
}
