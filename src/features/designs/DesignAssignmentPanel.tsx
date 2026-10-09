"use client";

import { useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { FormTextField } from "@/components/ui/form-text-field";
import type { Priority, WorkflowPattern } from "@/lib/types/api";
import type { TaskDateMode } from "@/lib/services/task-date-mode";
import { useWorkflowPatternPreview } from "@/hooks/use-masters";
import type { MasterEmployee } from "@/hooks/use-masters";
import { todayDateInput } from "@/lib/ui/date-input";

export type AssignmentMode = "AUTOMATIC" | "MANUAL";

export type PatternStepDraft = {
  sequence: number;
  hours: string;
  dueDate: string;
  priority: Priority;
  assignedEmployeeId: number | "";
  note: string;
};

export type ManualTaskDraft = {
  id: string;
  processId: number | "";
  subProcessId: number | "";
  hours: string;
  dueDate: string;
  priority: Priority;
  assignedEmployeeId: number | "";
  note: string;
};

export type StageOption = {
  value: string;
  label: string;
  processId: number;
  subProcessId: number;
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export function emptyManualTask(index: number, priority: Priority = "MEDIUM"): ManualTaskDraft {
  return {
    id: `manual-task-${index}-${Date.now()}`,
    processId: "",
    subProcessId: "",
    hours: "2",
    dueDate: "",
    priority,
    assignedEmployeeId: "",
    note: "",
  };
}

export function hoursToMinutes(hours: string): number {
  const value = Number(hours);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 60);
}

type DesignAssignmentPanelProps = {
  assignmentMode: AssignmentMode;
  onAssignmentModeChange: (mode: AssignmentMode) => void;
  workflowPatternId: number | "";
  onWorkflowPatternIdChange: (id: number | "") => void;
  taskDateMode: TaskDateMode;
  onTaskDateModeChange: (mode: TaskDateMode) => void;
  availablePatterns: WorkflowPattern[];
  designPriority: Priority;
  manualTasks: ManualTaskDraft[];
  onManualTasksChange: (tasks: ManualTaskDraft[]) => void;
  stageOptions: StageOption[];
  employees: MasterEmployee[];
  showErrors: boolean;
  validationErrors: Record<string, string>;
  fieldErrors?: Record<string, string[]>;
  onPatternStepsChange?: (steps: PatternStepDraft[]) => void;
  /** Concept end date. Empty step due dates follow this value. */
  targetEndDate?: string;
};

export function DesignAssignmentPanel({
  assignmentMode,
  onAssignmentModeChange,
  workflowPatternId,
  onWorkflowPatternIdChange,
  taskDateMode,
  availablePatterns,
  designPriority,
  manualTasks,
  onManualTasksChange,
  stageOptions,
  employees,
  showErrors,
  validationErrors,
  fieldErrors = {},
  onPatternStepsChange,
  targetEndDate = "",
}: DesignAssignmentPanelProps) {
  const effectivePatternId =
    workflowPatternId && availablePatterns.some((p) => p.id === workflowPatternId)
      ? workflowPatternId
      : availablePatterns.length === 1
        ? availablePatterns[0].id
        : workflowPatternId;

  const preview = useWorkflowPatternPreview(
    assignmentMode === "AUTOMATIC" ? effectivePatternId : "",
    taskDateMode,
    designPriority,
    assignmentMode === "AUTOMATIC" && !!effectivePatternId,
  );
  const previewRows = preview.data?.tasks ?? [];
  const stepSignature = previewRows.map((row) => row.sequence).join(",");
  const [patternSteps, setPatternSteps] = useState<PatternStepDraft[]>([]);

  useEffect(() => {
    if (assignmentMode !== "AUTOMATIC" || !stepSignature) {
      setPatternSteps([]);
      return;
    }
    setPatternSteps(
      previewRows.map((row) => ({
        sequence: row.sequence,
        hours: "",
        dueDate: targetEndDate,
        priority: designPriority,
        assignedEmployeeId: row.assignedEmployeeId ?? "",
        note: "",
      })),
    );
    // Reset schedule fields when the selected pattern steps change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentMode, effectivePatternId, stepSignature]);

  useEffect(() => {
    onPatternStepsChange?.(patternSteps);
  }, [onPatternStepsChange, patternSteps]);

  const appliedEndDate = useRef(targetEndDate);
  const manualTasksRef = useRef(manualTasks);
  manualTasksRef.current = manualTasks;
  const onManualTasksChangeRef = useRef(onManualTasksChange);
  onManualTasksChangeRef.current = onManualTasksChange;

  useEffect(() => {
    const previous = appliedEndDate.current;
    if (previous === targetEndDate) return;
    appliedEndDate.current = targetEndDate;
    if (!targetEndDate) return;

    setPatternSteps((current) =>
      current.map((step) =>
        !step.dueDate || step.dueDate === previous ? { ...step, dueDate: targetEndDate } : step,
      ),
    );

    const currentManual = manualTasksRef.current;
    const nextManual = currentManual.map((task) =>
      !task.dueDate || task.dueDate === previous ? { ...task, dueDate: targetEndDate } : task,
    );
    if (nextManual.some((task, index) => task.dueDate !== currentManual[index]?.dueDate)) {
      onManualTasksChangeRef.current(nextManual);
    }
  }, [targetEndDate]);

  function updatePatternStep(sequence: number, patch: Partial<PatternStepDraft>) {
    setPatternSteps((current) =>
      current.map((step) => (step.sequence === sequence ? { ...step, ...patch } : step)),
    );
  }

  function updateManualTask(id: string, patch: Partial<ManualTaskDraft>) {
    onManualTasksChange(
      manualTasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  }

  function handleManualStageChange(task: ManualTaskDraft, stageValue: string | null) {
    if (!stageValue) {
      updateManualTask(task.id, { processId: "", subProcessId: "" });
      return;
    }
    const option = stageOptions.find((row) => row.value === stageValue);
    if (!option) return;
    updateManualTask(task.id, {
      processId: option.processId,
      subProcessId: option.subProcessId,
    });
  }

  function addManualTaskRow() {
    onManualTasksChange([
      ...manualTasks,
      { ...emptyManualTask(manualTasks.length, designPriority), dueDate: targetEndDate },
    ]);
  }

  function removeManualTaskRow(id: string) {
    if (manualTasks.length <= 1) return;
    onManualTasksChange(manualTasks.filter((task) => task.id !== id));
  }

  function moveManualTask(id: string, direction: "up" | "down") {
    const index = manualTasks.findIndex((t) => t.id === id);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= manualTasks.length) return;
    const next = [...manualTasks];
    [next[index], next[target]] = [next[target], next[index]];
    onManualTasksChange(next);
  }

  const selectedPattern = availablePatterns.find((p) => p.id === effectivePatternId);

  return (
    <div className="form-grid">
      <div
        className="assignment-mode-grid"
        role="radiogroup"
        aria-label="Task assignment system"
      >
        <button
          type="button"
          role="radio"
          aria-checked={assignmentMode === "AUTOMATIC"}
          className={
            assignmentMode === "AUTOMATIC"
              ? "assignment-mode-card assignment-mode-card--active"
              : "assignment-mode-card"
          }
          onClick={() => onAssignmentModeChange("AUTOMATIC")}
        >
          <span className="assignment-mode-card__title">Automatic Workflow</span>
          <span className="assignment-mode-card__desc">
            Create all tasks automatically from a saved design pattern.
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={assignmentMode === "MANUAL"}
          className={
            assignmentMode === "MANUAL"
              ? "assignment-mode-card assignment-mode-card--active"
              : "assignment-mode-card"
          }
          onClick={() => onAssignmentModeChange("MANUAL")}
        >
          <span className="assignment-mode-card__title">Manual Assignment</span>
          <span className="assignment-mode-card__desc">
            Create and assign each task manually during design registration.
          </span>
        </button>
      </div>
      {showErrors && validationErrors.assignmentMode && (
        <span className="form-error text-xs text-destructive">
          {validationErrors.assignmentMode}
        </span>
      )}

      {assignmentMode === "AUTOMATIC" && (
        <>
          <FormSelect
            id="pattern"
            label="Design Workflow Pattern"
            required
            value={
              availablePatterns.length === 0
                ? null
                : effectivePatternId
                  ? String(effectivePatternId)
                  : null
            }
            onValueChange={(v) => onWorkflowPatternIdChange(v ? Number(v) : "")}
            options={availablePatterns.map((p) => ({
              value: String(p.id),
              label: `${p.name} (v${p.versionNo})${p.productType ? ` · ${p.productType.name}` : ""}`,
            }))}
            placeholder="Select…"
            disabled={availablePatterns.length === 0}
            error={
              showErrors
                ? (validationErrors.workflowPatternId ?? fieldErrors.workflowPatternId?.[0])
                : undefined
            }
          />

          {preview.isLoading ? (
            <p className="m-0 text-sm text-muted-foreground">Loading workflow steps…</p>
          ) : previewRows.length > 0 ? (
            <div className="vstack vstack--tight">
              <p className="m-0 text-xs text-muted-foreground">
                This design uses {selectedPattern ? `“${selectedPattern.name}”` : "the pattern"}.
                Choose who does each step, then set hours, due date, priority, and any note.
              </p>
              {showErrors && validationErrors.patternSteps ? (
                <span className="form-error text-xs text-destructive">
                  {validationErrors.patternSteps}
                </span>
              ) : null}
              <div className="manual-task-list">
                {previewRows.map((row, index) => {
                  const draft = patternSteps.find((step) => step.sequence === row.sequence);
                  return (
                    <div key={`${row.sequence}-${row.subProcessId}`} className="manual-task-row">
                      <div className="form-field">
                        <span className="form-label">Stage</span>
                        <p className="m-0 text-sm text-foreground">{row.stage}</p>
                        <p className="m-0 text-xs text-muted-foreground">
                          {row.roleName || "Role from pattern"}
                        </p>
                      </div>
                      <FormSelect
                        id={`pattern-step-${row.sequence}-person`}
                        label="Assign person"
                        required
                        value={
                          draft?.assignedEmployeeId
                            ? String(draft.assignedEmployeeId)
                            : null
                        }
                        onValueChange={(value) =>
                          updatePatternStep(row.sequence, {
                            assignedEmployeeId: value ? Number(value) : "",
                          })
                        }
                        options={(() => {
                          const all = employees ?? [];
                          const forRole = all.filter(
                            (employee) =>
                              employee.roleId === row.roleId || employee.role?.id === row.roleId,
                          );
                          const people = row.roleId == null || forRole.length === 0 ? all : forRole;
                          return people.map((employee) => ({
                            value: String(employee.id),
                            label: employee.name,
                          }));
                        })()}
                        placeholder="Select person…"
                        error={
                          showErrors
                            ? validationErrors[`patternSteps.${index}.assignedEmployeeId`]
                            : undefined
                        }
                      />
                      <FormTextField
                        id={`pattern-step-${row.sequence}-hours`}
                        label="Hours"
                        required
                        type="number"
                        min={0.25}
                        step="0.25"
                        value={draft?.hours ?? ""}
                        onChange={(event) =>
                          updatePatternStep(row.sequence, { hours: event.target.value })
                        }
                        error={
                          showErrors
                            ? validationErrors[`patternSteps.${index}.expectedMinutes`]
                            : undefined
                        }
                      />
                      <FormTextField
                        id={`pattern-step-${row.sequence}-due`}
                        label="Due date"
                        required
                        type="date"
                        min={todayDateInput()}
                        max={targetEndDate || undefined}
                        value={draft?.dueDate ?? ""}
                        onChange={(event) =>
                          updatePatternStep(row.sequence, { dueDate: event.target.value })
                        }
                        error={
                          showErrors
                            ? validationErrors[`patternSteps.${index}.dueAt`]
                            : undefined
                        }
                      />
                      <FormSelect
                        id={`pattern-step-${row.sequence}-priority`}
                        label="Priority"
                        required
                        value={draft?.priority ?? designPriority}
                        onValueChange={(value) =>
                          updatePatternStep(row.sequence, {
                            priority: (value as Priority) || "MEDIUM",
                          })
                        }
                        options={PRIORITY_OPTIONS}
                        error={
                          showErrors
                            ? validationErrors[`patternSteps.${index}.priority`]
                            : undefined
                        }
                      />
                      <FormTextArea
                        id={`pattern-step-${row.sequence}-note`}
                        label="Note"
                        rows={2}
                        value={draft?.note ?? ""}
                        onChange={(event) =>
                          updatePatternStep(row.sequence, { note: event.target.value })
                        }
                        placeholder="Optional instruction for this step"
                        fieldClassName="pattern-step-note"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              Select a workflow pattern, then set hours, due date, and priority for its steps.
            </p>
          )}
        </>
      )}

      {assignmentMode === "MANUAL" && (
        <div>
          <div className="form-row-header">
            <h3 className="manual-task-list__title">
              Manual Task List{" "}
              <span className="font-semibold text-[var(--color-danger)]" aria-hidden="true">
                *
              </span>
              <span className="sr-only">(required)</span>
            </h3>
            <AppButton type="button" appVariant="outline" size="sm" onClick={addManualTaskRow}>
              + Add Task
            </AppButton>
          </div>

          {showErrors && (validationErrors.manualTasks || fieldErrors.manualTasks) && (
            <span className="form-error form-error-block text-xs text-destructive">
              {validationErrors.manualTasks ?? fieldErrors.manualTasks?.[0]}
            </span>
          )}

          <div className="manual-task-list">
            {manualTasks.map((task, index) => {
              const stageValue =
                task.processId && task.subProcessId
                  ? `${task.processId}:${task.subProcessId}`
                  : null;

              return (
                <div key={task.id} className="manual-task-row">
                  <FormSelect
                    id={`${task.id}-stage`}
                    label="Task Stage"
                    required
                    value={stageValue}
                    onValueChange={(v) => handleManualStageChange(task, v)}
                    options={stageOptions.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    }))}
                    placeholder="Select stage…"
                    error={
                      showErrors
                        ? validationErrors[`manualTasks.${index}.subProcessId`]
                        : undefined
                    }
                  />
                  <FormSelect
                    id={`${task.id}-assignee`}
                    label="Assign Person"
                    value={
                      task.assignedEmployeeId ? String(task.assignedEmployeeId) : "__auto__"
                    }
                    onValueChange={(v) =>
                      updateManualTask(task.id, {
                        assignedEmployeeId: !v || v === "__auto__" ? "" : Number(v),
                      })
                    }
                    options={[
                      { value: "__auto__", label: "Auto by role" },
                      ...employees.map((emp) => ({
                        value: String(emp.id),
                        label: emp.name,
                      })),
                    ]}
                    placeholder="Select…"
                  />
                  <FormTextField
                    id={`${task.id}-hours`}
                    label="Hours"
                    required
                    type="number"
                    min={0.25}
                    step="0.25"
                    value={task.hours}
                    onChange={(e) => updateManualTask(task.id, { hours: e.target.value })}
                    error={
                      showErrors
                        ? (validationErrors[`manualTasks.${index}.expectedMinutes`] ??
                          fieldErrors[`manualTasks.${index}.expectedMinutes`]?.[0])
                        : undefined
                    }
                  />
                  <FormTextField
                    id={`${task.id}-due`}
                    label="Due Date"
                    required
                    type="date"
                    min={todayDateInput()}
                    max={targetEndDate || undefined}
                    value={task.dueDate}
                    onChange={(e) => updateManualTask(task.id, { dueDate: e.target.value })}
                    error={
                      showErrors
                        ? (validationErrors[`manualTasks.${index}.dueAt`] ??
                          fieldErrors[`manualTasks.${index}.dueAt`]?.[0])
                        : undefined
                    }
                  />
                  <FormSelect
                    id={`${task.id}-priority`}
                    label="Priority"
                    required
                    value={task.priority}
                    onValueChange={(v) =>
                      updateManualTask(task.id, {
                        priority: (v as Priority) || "MEDIUM",
                      })
                    }
                    options={PRIORITY_OPTIONS}
                    error={
                      showErrors
                        ? validationErrors[`manualTasks.${index}.priority`]
                        : undefined
                    }
                  />
                  <FormTextArea
                    id={`${task.id}-note`}
                    label="Note"
                    rows={2}
                    value={task.note}
                    onChange={(event) => updateManualTask(task.id, { note: event.target.value })}
                    placeholder="Optional instruction for this task"
                    fieldClassName="pattern-step-note"
                  />
                  <div className="manual-task-row__actions">
                    <TableIconActionGroup>
                      <TableIconAction
                        action="moveUp"
                        disabled={index === 0}
                        onClick={() => moveManualTask(task.id, "up")}
                        label={`Move task ${index + 1} up`}
                      />
                      <TableIconAction
                        action="moveDown"
                        disabled={index === manualTasks.length - 1}
                        onClick={() => moveManualTask(task.id, "down")}
                        label={`Move task ${index + 1} down`}
                      />
                      {manualTasks.length > 1 && (
                        <TableIconAction
                          action="remove"
                          onClick={() => removeManualTaskRow(task.id)}
                          label={`Remove task ${index + 1}`}
                        />
                      )}
                    </TableIconActionGroup>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
