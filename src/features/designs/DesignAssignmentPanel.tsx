"use client";

import { AppButton } from "@/components/ui/AppButton";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import type { Priority, WorkflowPattern } from "@/lib/types/api";
import { TASK_DATE_MODES, type TaskDateMode } from "@/lib/services/task-date-mode";
import { useWorkflowPatternPreview } from "@/hooks/use-masters";
import type { MasterEmployee } from "@/hooks/use-masters";

export type AssignmentMode = "AUTOMATIC" | "MANUAL";

export type ManualTaskDraft = {
  id: string;
  processId: number | "";
  subProcessId: number | "";
  hours: string;
  dueDate: string;
  priority: Priority;
  assignedEmployeeId: number | "";
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

const TASK_DATE_MODE_OPTIONS: { value: TaskDateMode; label: string }[] = [
  { value: "SEQUENTIAL", label: "Sequential by stage" },
  { value: "SAME_DAY", label: "Same day (all stages)" },
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
};

export function DesignAssignmentPanel({
  assignmentMode,
  onAssignmentModeChange,
  workflowPatternId,
  onWorkflowPatternIdChange,
  taskDateMode,
  onTaskDateModeChange,
  availablePatterns,
  designPriority,
  manualTasks,
  onManualTasksChange,
  stageOptions,
  employees,
  showErrors,
  validationErrors,
  fieldErrors = {},
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
    onManualTasksChange([...manualTasks, emptyManualTask(manualTasks.length, designPriority)]);
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
  const previewRows = preview.data?.tasks ?? [];

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
          <div className="form-grid form-grid--2">
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
            <FormSelect
              id="taskDateMode"
              label="Task Date Calculation"
              value={taskDateMode}
              onValueChange={(v) =>
                onTaskDateModeChange(
                  TASK_DATE_MODES.includes(v as TaskDateMode)
                    ? (v as TaskDateMode)
                    : "SEQUENTIAL",
                )
              }
              options={TASK_DATE_MODE_OPTIONS}
            />
          </div>

          {preview.isLoading ? (
            <p className="m-0 text-sm text-[var(--color-neutral-600)]">Loading workflow preview…</p>
          ) : previewRows.length > 0 ? (
            <div className="workflow-preview">
              <div className="workflow-preview__scroll">
                <table className="workflow-preview__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Task Stage</th>
                      <th>Assigned Person</th>
                      <th>Hours</th>
                      <th>Planned Date</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={`${row.sequence}-${row.subProcessId}`}>
                        <td>{row.sequence}</td>
                        <td>{row.stage}</td>
                        <td>{row.assigneeName}</td>
                        <td>{row.hours}</td>
                        <td>{row.plannedDate}</td>
                        <td>
                          <PriorityBadge priority={row.priority} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="workflow-preview__note">
                {previewRows.length} tasks will be created automatically
                {selectedPattern ? ` from “${selectedPattern.name}”` : ""} after saving the
                design.
              </p>
            </div>
          ) : (
            <p className="m-0 text-sm text-[var(--color-neutral-600)]">
              Select a workflow pattern to preview the automatic task list.
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
