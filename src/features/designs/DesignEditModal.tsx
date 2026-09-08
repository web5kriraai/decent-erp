"use client";

import { useMemo, useState } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { FormTextField } from "@/components/ui/form-text-field";
import { AppButton } from "@/components/ui/AppButton";
import { useUpdateDesign, useUpdateDesignTaskSchedule } from "@/hooks/use-designs";
import {
  useDesignGrades,
  useFabrics,
  useMachines,
  useMasterCatalog,
  useMasterEmployees,
  useStitchingTypes,
} from "@/hooks/use-masters";
import {
  WORK_TYPE_OPTIONS,
  isWorkTypeCode,
  type DesignSummary,
  type DesignTask,
  type Priority,
  type WorkType,
} from "@/lib/types/api";
import { expectedMinutesToHoursLabel } from "@/lib/services/task-date-mode";

type DesignEditModalProps = {
  design: DesignSummary;
  open: boolean;
  onClose: () => void;
};

type TaskScheduleDraft = {
  taskId: string;
  stage: string;
  status: string;
  hours: string;
  dueDate: string;
  priority: Priority;
  assignedEmployeeId: number | "";
  editable: boolean;
};

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const EDITABLE_STATUSES = new Set([
  "PENDING",
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CORRECTION_REQUIRED",
]);

function toDateInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function draftsFromTasks(tasks: DesignTask[] | undefined): TaskScheduleDraft[] {
  return (tasks ?? [])
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((task) => ({
      taskId: task.id,
      stage: task.subProcess?.name ?? `Step ${task.sequence}`,
      status: task.status,
      hours: expectedMinutesToHoursLabel(task.expectedMinutes),
      dueDate: toDateInput(task.dueAt),
      priority: task.priority,
      assignedEmployeeId: task.assignedEmployeeId ?? "",
      editable: EDITABLE_STATUSES.has(task.status),
    }));
}

export function DesignEditModal({ design, open, onClose }: DesignEditModalProps) {
  const updateDesign = useUpdateDesign();
  const updateSchedule = useUpdateDesignTaskSchedule(design.id);
  const fabrics = useFabrics(open);
  const machines = useMachines(open);
  const stitchingTypes = useStitchingTypes(open);
  const designGrades = useDesignGrades(open);
  const styles = useMasterCatalog("STYLE", open);
  const celebrities = useMasterCatalog("CELEBRITY", open);
  const themes = useMasterCatalog("THEME", open);
  const workTypesCatalog = useMasterCatalog("WORK_TYPE", open);
  const employees = useMasterEmployees(open);

  const workTypeOptions = useMemo(() => {
    const fromCatalog = (workTypesCatalog.data ?? [])
      .filter((w) => isWorkTypeCode(w.code))
      .map((w) => ({ value: w.code as WorkType, label: w.name }));
    return fromCatalog.length > 0 ? fromCatalog : WORK_TYPE_OPTIONS;
  }, [workTypesCatalog.data]);

  const [collectionName, setCollectionName] = useState(design.collectionName);
  const [conceptNote, setConceptNote] = useState(design.conceptNote ?? "");
  const [styleName, setStyleName] = useState(design.styleName ?? "");
  const [workType, setWorkType] = useState<WorkType | "">(design.workType ?? "");
  const [trendReference, setTrendReference] = useState(design.trendReference ?? "");
  const [celebrityReference, setCelebrityReference] = useState(design.celebrityReference ?? "");
  const [fabricId, setFabricId] = useState<number | "">(design.fabricId ?? "");
  const [machineId, setMachineId] = useState<number | "">(design.machineId ?? "");
  const [stitchingTypeId, setStitchingTypeId] = useState<number | "">(
    design.stitchingTypeId ?? "",
  );
  const [designGradeId, setDesignGradeId] = useState<number | "">(design.designGradeId ?? "");
  const [taskDrafts, setTaskDrafts] = useState<TaskScheduleDraft[]>(() =>
    draftsFromTasks(design.tasks),
  );
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const formKey = `${open}:${design.id}:${design.version ?? 0}:${design.tasks?.length ?? 0}`;
  const [loadedKey, setLoadedKey] = useState(formKey);

  if (open && formKey !== loadedKey) {
    setLoadedKey(formKey);
    setCollectionName(design.collectionName);
    setConceptNote(design.conceptNote ?? "");
    setStyleName(design.styleName ?? "");
    setWorkType(design.workType ?? "");
    setTrendReference(design.trendReference ?? "");
    setCelebrityReference(design.celebrityReference ?? "");
    setFabricId(design.fabricId ?? "");
    setMachineId(design.machineId ?? "");
    setStitchingTypeId(design.stitchingTypeId ?? "");
    setDesignGradeId(design.designGradeId ?? "");
    setTaskDrafts(draftsFromTasks(design.tasks));
    setAttemptedSubmit(false);
  }

  const collectionError = !collectionName.trim() ? "Collection name is required" : undefined;
  const taskErrors: Record<string, string> = {};
  taskDrafts.forEach((task) => {
    if (!task.editable) return;
    if (!Number(task.hours) || Number(task.hours) <= 0) {
      taskErrors[`${task.taskId}.hours`] = "Hours must be greater than zero";
    }
    if (!task.dueDate) {
      taskErrors[`${task.taskId}.dueDate`] = "Due date is required";
    }
  });

  function updateTaskDraft(taskId: string, patch: Partial<TaskScheduleDraft>) {
    setTaskDrafts((prev) =>
      prev.map((row) => (row.taskId === taskId ? { ...row, ...patch } : row)),
    );
  }

  async function handleSave() {
    setAttemptedSubmit(true);
    if (collectionError || Object.keys(taskErrors).length > 0) return;
    if (updateDesign.isPending || updateSchedule.isPending) return;

    const grade = (designGrades.data ?? []).find((g) => g.id === designGradeId);
    await updateDesign.mutateAsync({
      designId: design.id,
      version: design.version ?? 1,
      collectionName: collectionName.trim(),
      conceptNote: conceptNote.trim() || undefined,
      styleName: styleName.trim() || undefined,
      workType: workType || undefined,
      trendReference: trendReference.trim() || undefined,
      celebrityReference: celebrityReference.trim() || undefined,
      fabricId: fabricId === "" ? null : Number(fabricId),
      machineId: machineId === "" ? null : Number(machineId),
      stitchingTypeId: stitchingTypeId === "" ? null : Number(stitchingTypeId),
      designGradeId: designGradeId === "" ? null : Number(designGradeId),
      targetGrade: grade?.name ?? design.targetGrade ?? null,
    });

    const editable = taskDrafts.filter((t) => t.editable);
    if (editable.length > 0) {
      await updateSchedule.mutateAsync({
        tasks: editable.map((task) => ({
          taskId: task.taskId,
          dueAt: task.dueDate || null,
          priority: task.priority,
          assignedEmployeeId:
            task.assignedEmployeeId === "" ? null : Number(task.assignedEmployeeId),
          expectedMinutes: Math.round(Number(task.hours) * 60),
        })),
      });
    }

    setAttemptedSubmit(false);
    onClose();
  }

  const saving = updateDesign.isPending || updateSchedule.isPending;

  return (
    <Modal
      open={open}
      title="Edit Design"
      onClose={onClose}
      size="xl"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            appVariant="primary"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <ModalFormGrid>
          <FormTextField
            id="editCollection"
            label="Collection Name"
            required
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            error={attemptedSubmit ? collectionError : undefined}
          />
          <FormSelect
            id="editStyleName"
            label="Style"
            value={styleName || null}
            onValueChange={(v) => setStyleName(v ?? "")}
            options={(styles.data ?? []).map((s) => ({ value: s.name, label: s.name }))}
            placeholder="Select style…"
          />
        </ModalFormGrid>
        <ModalFormGrid>
          <FormSelect
            id="editWorkType"
            label="Work Type"
            value={workType || null}
            onValueChange={(v) => setWorkType(v as WorkType)}
            options={workTypeOptions}
            placeholder="Select…"
          />
          <FormSelect
            id="editTheme"
            label="Theme"
            value={trendReference || null}
            onValueChange={(v) => setTrendReference(v ?? "")}
            options={(themes.data ?? []).map((t) => ({ value: t.name, label: t.name }))}
            placeholder="Select theme…"
          />
        </ModalFormGrid>
        <ModalFormGrid>
          <FormSelect
            id="editCelebrity"
            label="Celebrity"
            value={celebrityReference || null}
            onValueChange={(v) => setCelebrityReference(v ?? "")}
            options={(celebrities.data ?? []).map((c) => ({ value: c.name, label: c.name }))}
            placeholder="Select…"
          />
          <FormSelect
            id="editGrade"
            label="Design Grade"
            value={designGradeId === "" ? null : String(designGradeId)}
            onValueChange={(v) => setDesignGradeId(v ? Number(v) : "")}
            options={(designGrades.data ?? []).map((g) => ({
              value: String(g.id),
              label: g.name,
            }))}
            placeholder="Select…"
          />
        </ModalFormGrid>
        <ModalFormGrid>
          <FormSelect
            id="editFabric"
            label="Fabric"
            value={fabricId === "" ? null : String(fabricId)}
            onValueChange={(v) => setFabricId(v ? Number(v) : "")}
            options={(fabrics.data ?? []).map((f) => ({
              value: String(f.id),
              label: f.name,
            }))}
            placeholder="Select…"
          />
          <FormSelect
            id="editMachine"
            label="Machine"
            value={machineId === "" ? null : String(machineId)}
            onValueChange={(v) => setMachineId(v ? Number(v) : "")}
            options={(machines.data ?? []).map((m) => ({
              value: String(m.id),
              label: m.name,
            }))}
            placeholder="Select…"
          />
        </ModalFormGrid>
        <FormSelect
          id="editStitching"
          label="Stitching Type"
          value={stitchingTypeId === "" ? null : String(stitchingTypeId)}
          onValueChange={(v) => setStitchingTypeId(v ? Number(v) : "")}
          options={(stitchingTypes.data ?? []).map((s) => ({
            value: String(s.id),
            label: s.name,
          }))}
          placeholder="Select…"
        />
        <FormTextArea
          id="editConcept"
          label="Concept Note"
          rows={3}
          value={conceptNote}
          onChange={(e) => setConceptNote(e.target.value)}
        />

        <div className="form-section-label">Task Assignment / Schedule</div>
        {taskDrafts.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-neutral-600)]">
            No workflow tasks on this design yet.
          </p>
        ) : (
          <div className="manual-task-list">
            {taskDrafts.map((task) => (
              <div key={task.taskId} className="manual-task-row manual-task-row--edit">
                <FormTextField
                  id={`${task.taskId}-stage`}
                  label="Task Stage"
                  value={`${task.stage} (${task.status})`}
                  readOnly
                  disabled
                />
                <FormSelect
                  id={`${task.taskId}-assignee`}
                  label="Assign Person"
                  value={
                    task.assignedEmployeeId === ""
                      ? "__none__"
                      : String(task.assignedEmployeeId)
                  }
                  onValueChange={(v) =>
                    updateTaskDraft(task.taskId, {
                      assignedEmployeeId: !v || v === "__none__" ? "" : Number(v),
                    })
                  }
                  options={[
                    { value: "__none__", label: "Unassigned" },
                    ...(employees.data ?? []).map((emp) => ({
                      value: String(emp.id),
                      label: emp.name,
                    })),
                  ]}
                  disabled={!task.editable}
                />
                <FormTextField
                  id={`${task.taskId}-hours`}
                  label="Hours"
                  type="number"
                  min={0.25}
                  step="0.25"
                  value={task.hours}
                  onChange={(e) => updateTaskDraft(task.taskId, { hours: e.target.value })}
                  disabled={!task.editable}
                  error={attemptedSubmit ? taskErrors[`${task.taskId}.hours`] : undefined}
                />
                <FormTextField
                  id={`${task.taskId}-due`}
                  label="Due Date"
                  type="date"
                  value={task.dueDate}
                  onChange={(e) => updateTaskDraft(task.taskId, { dueDate: e.target.value })}
                  disabled={!task.editable}
                  error={attemptedSubmit ? taskErrors[`${task.taskId}.dueDate`] : undefined}
                />
                <FormSelect
                  id={`${task.taskId}-priority`}
                  label="Priority"
                  value={task.priority}
                  onValueChange={(v) =>
                    updateTaskDraft(task.taskId, {
                      priority: (v as Priority) || "MEDIUM",
                    })
                  }
                  options={PRIORITY_OPTIONS}
                  disabled={!task.editable}
                />
              </div>
            ))}
          </div>
        )}
      </ModalForm>
    </Modal>
  );
}
