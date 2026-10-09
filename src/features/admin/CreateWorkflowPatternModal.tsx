"use client";

import { useCallback, useMemo, useState } from "react";
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
import { DragHandle } from "@/components/ui/DragHandle";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { useAdminRoles } from "@/hooks/use-admin-roles";
import { useRowDragReorder } from "@/hooks/use-row-drag-reorder";
import {
  useProcessMasters,
  useProductTypes,
  useSkills,
  type ProcessMaster,
  type SkillOption,
} from "@/hooks/use-masters";
import { moveArrayItem } from "@/lib/reorder";
import type { CreateWorkflowPatternPayload, WorkflowPattern } from "@/lib/types/api";
import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";
import { parseStageCapabilities } from "@/lib/workflow/stage-capabilities";

type TaskDraft = {
  id: string;
  processId: number | "";
  subProcessId: number | "";
  defaultRoleId: number | "";
  defaultSkillId: number | "";
  dependencySequence: string;
};

/** Textile design chain used as the starting pattern (concept through final approval). */
const INDUSTRY_SAMPLE_STAGE_CODES = [
  "CONCEPT_REVIEW",
  "SKETCH",
  "SKETCH_APPROVAL",
  "PUNCH",
  "MACHINE_SAMPLE",
  "SAMPLE_CHECK",
  "COSTING",
  "FINAL_APPROVAL",
] as const;

const INDUSTRY_SAMPLE_SKILL: Record<string, string> = {
  CONCEPT_REVIEW: "DESIGN_LEAD",
  SKETCH: "SKETCH",
  SKETCH_APPROVAL: "DESIGN_LEAD",
  PUNCH: "PUNCH",
  MACHINE_SAMPLE: "MACHINE_SAMPLE",
  SAMPLE_CHECK: "SAMPLE_CHECK",
  COSTING: "COSTING",
  FINAL_APPROVAL: "DESIGN_LEAD",
};

const INDUSTRY_SAMPLE_NAME = "Standard Design Chain";

function emptyTask(index: number): TaskDraft {
  return {
    id: `task-${index}-${Date.now()}`,
    processId: "",
    subProcessId: "",
    defaultRoleId: "",
    defaultSkillId: "",
    dependencySequence: "",
  };
}

function buildIndustrySampleTasks(processes: ProcessMaster[], skills: SkillOption[]): TaskDraft[] {
  const byCode = new Map<
    string,
    { processId: number; subProcessId: number; defaultRoleId: number | "" }
  >();
  for (const process of processes) {
    for (const sub of process.subProcesses ?? []) {
      byCode.set(sub.code, {
        processId: process.id,
        subProcessId: sub.id,
        defaultRoleId: sub.defaultRoleId ?? "",
      });
    }
  }

  const drafts: TaskDraft[] = [];
  for (const code of INDUSTRY_SAMPLE_STAGE_CODES) {
    const stage = byCode.get(code);
    if (!stage) continue;
    const skillCode = INDUSTRY_SAMPLE_SKILL[code];
    const skill =
      skills.find((row) => row.code === skillCode) ??
      (stage.defaultRoleId !== ""
        ? skills.find((row) => row.defaultRoleId === stage.defaultRoleId)
        : undefined);
    drafts.push({
      id: `sample-${code}`,
      processId: stage.processId,
      subProcessId: stage.subProcessId,
      defaultRoleId: stage.defaultRoleId,
      defaultSkillId: skill?.id ?? "",
      dependencySequence: drafts.length === 0 ? "" : String(drafts.length),
    });
  }
  return drafts;
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
  const [samplePending, setSamplePending] = useState(false);

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

  function applyIndustrySample(options?: { fillName?: boolean }) {
    const sample = buildIndustrySampleTasks(processes, skills);
    if (sample.length === 0) {
      setTasks([emptyTask(0)]);
      setSamplePending(true);
      return;
    }
    setTasks(sample);
    setSamplePending(false);
    if (options?.fillName) setName(INDUSTRY_SAMPLE_NAME);
  }

  function resetForm() {
    setName("");
    setProductTypeId("");
    setVersionNo("1");
    setTasks([emptyTask(0)]);
    setFormError(null);
    setAttemptedSubmit(false);
    setSamplePending(false);
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
          dependencySequence:
            task.dependencySequence != null ? String(task.dependencySequence) : "",
        })),
      );
      setFormError(null);
      setSamplePending(false);
    } else if (formMode === "create") {
      setProductTypeId("");
      setVersionNo("1");
      setFormError(null);
      setAttemptedSubmit(false);
      const mastersReady = processesQuery.isSuccess && skillsQuery.isSuccess;
      const sample = mastersReady ? buildIndustrySampleTasks(processes, skills) : [];
      if (sample.length > 0) {
        setName(INDUSTRY_SAMPLE_NAME);
        setTasks(sample);
        setSamplePending(false);
      } else {
        setName("");
        setTasks([emptyTask(0)]);
        setSamplePending(!mastersReady);
      }
    } else {
      resetForm();
    }
  }

  if (
    formMode === "create" &&
    samplePending &&
    processesQuery.isSuccess &&
    skillsQuery.isSuccess
  ) {
    const sample = buildIndustrySampleTasks(processes, skills);
    setSamplePending(false);
    if (sample.length > 0) {
      setTasks(sample);
      setName((current) => (current.trim() ? current : INDUSTRY_SAMPLE_NAME));
    }
  }

  const canSubmit = useMemo(() => {
    if (!name.trim() || tasks.length === 0) return false;
    return tasks.every(
      (task) =>
        task.processId &&
        task.subProcessId &&
        task.defaultRoleId,
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

  const handleStepReorder = useCallback((fromIndex: number, toIndex: number) => {
    setTasks((prev) => {
      const next = moveArrayItem(prev, fromIndex, toIndex);
      if (next === prev) return prev;

      const seqMap = new Map<string, string>();
      prev.forEach((task, index) => {
        const newIndex = next.findIndex((row) => row.id === task.id);
        if (newIndex >= 0) seqMap.set(String(index + 1), String(newIndex + 1));
      });

      return next.map((task) => {
        if (!task.dependencySequence) return task;
        const remapped = seqMap.get(task.dependencySequence);
        return remapped ? { ...task, dependencySequence: remapped } : task;
      });
    });
  }, []);

  const { getHandleProps, getRowProps } = useRowDragReorder({
    enabled: tasks.length > 1,
    onReorder: handleStepReorder,
  });

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
          expectedMinutes: 60,
          sequence,
          dayOffset: 0,
          priority: "MEDIUM",
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
            <div className="inline-actions">
              <AppButton
                type="button"
                appVariant="outline"
                size="sm"
                onClick={() => applyIndustrySample()}
              >
                Industry sample
              </AppButton>
              <AppButton type="button" appVariant="outline" size="sm" onClick={addTaskRow}>
                + Add Step
              </AppButton>
            </div>
          </div>
          <p className="m-0 mb-2 text-xs text-muted-foreground">
            One line per step. New patterns start with the standard design chain. Hours, due date,
            and priority are entered when a design uses this pattern.
          </p>

          <div className="pattern-task-list">
            {tasks.map((task, index) => {
              const stageValue =
                task.processId && task.subProcessId
                  ? `${task.processId}:${task.subProcessId}`
                  : null;

              return (
                <div key={task.id} className="pattern-task-row" {...getRowProps(index)}>
                  <div className="pattern-task-row__drag">
                    <DragHandle
                      disabled={tasks.length <= 1}
                      label={`Drag to reorder step ${index + 1}`}
                      {...getHandleProps(index)}
                    />
                  </div>
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
                    placeholder="Select role…"
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
                    placeholder={task.defaultRoleId ? "Any" : "Role first"}
                    disabled={!task.defaultRoleId}
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
                    disabled={index === 0}
                  />
                  <div className="pattern-task-row__actions">
                    {tasks.length > 1 ? (
                      <TableIconActionGroup>
                        <TableIconAction
                          action="remove"
                          onClick={() => removeTaskRow(task.id)}
                          label={`Remove step ${index + 1}`}
                        />
                      </TableIconActionGroup>
                    ) : null}
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
