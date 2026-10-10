"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { FormTextField } from "@/components/ui/form-text-field";
import { PermissionDenied } from "@/components/PermissionDenied";
import { ConceptMediaPanel } from "@/components/ConceptMediaPanel";
import { useApiToast } from "@/components/ui/ToastProvider";
import {
  uploadPendingConceptMedia,
  type ConceptMediaUploadProgress,
  type PendingConceptMedia,
} from "@/lib/concept-media-upload";
import { useCreateDesign } from "@/hooks/use-designs";
import {
  useComponentTypes,
  useMasterCatalog,
  useMasterEmployees,
  useProcessMasters,
  useProductTypes,
  useSeasons,
  useWorkflowPatterns,
} from "@/hooks/use-masters";
import { getFieldErrors, ApiClientError } from "@/lib/api-client";
import {
  WORK_TYPE_OPTIONS,
  isWorkTypeCode,
  type Priority,
  type WorkType,
} from "@/lib/types/api";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ROUTES } from "@/config/routes";
import { isBeforeToday, todayDateInput } from "@/lib/ui/date-input";
import { scrollToFirstFormError } from "@/lib/ui/scroll-to-form-error";
import { PERMISSIONS } from "@/lib/permissions";
import { filterWorkflowPatternsForProductType } from "@/lib/workflow-patterns";
import type { TaskDateMode } from "@/lib/services/task-date-mode";
import {
  DesignAssignmentPanel,
  emptyManualTask,
  hoursToMinutes,
  type AssignmentMode,
  type ManualTaskDraft,
  type PatternStepDraft,
} from "@/features/designs/DesignAssignmentPanel";
import { DesignComponentTypePicker } from "@/features/designs/DesignComponentTypePicker";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];


function hasPendingProductImage(items: PendingConceptMedia[]) {
  return items.some((item) => item.mediaKind === "IMAGE");
}

function buildComponentTypeIdMap(
  components: Array<{ id: string; componentTypeId?: number }> | undefined,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const c of components ?? []) {
    if (c.componentTypeId != null) map.set(c.componentTypeId, c.id);
  }
  return map;
}

export function DesignCreateForm() {
  const router = useRouter();
  const toast = useApiToast();
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canCreate = permissions.includes(PERMISSIONS.DESIGN_CREATE);
  const createDesign = useCreateDesign();

  const [collectionName, setCollectionName] = useState("");
  const [conceptNote, setConceptNote] = useState("");
  const [styleName, setStyleName] = useState("");
  const [workType, setWorkType] = useState<WorkType | "">("");
  const [trendReference, setTrendReference] = useState("");
  const [celebrityReference, setCelebrityReference] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [productTypeId, setProductTypeId] = useState<number | "">("");
  const [seasonId, setSeasonId] = useState<number | "">("");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("AUTOMATIC");
  const [workflowPatternId, setWorkflowPatternId] = useState<number | "">("");
  const [taskDateMode, setTaskDateMode] = useState<TaskDateMode>("SEQUENTIAL");
  const [patternSteps, setPatternSteps] = useState<PatternStepDraft[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTaskDraft[]>(() => [
    emptyManualTask(0, "MEDIUM"),
  ]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [errorScrollTick, setErrorScrollTick] = useState(0);
  const [pendingMedia, setPendingMedia] = useState<PendingConceptMedia[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState<ConceptMediaUploadProgress | null>(
    null,
  );
  const [componentTypeIds, setComponentTypeIds] = useState<number[]>([]);
  const [createdDate] = useState(todayDateInput);
  const [targetEndDate, setTargetEndDate] = useState("");

  const productTypes = useProductTypes();
  const seasons = useSeasons();
  const patterns = useWorkflowPatterns();
  const componentCategoryId =
    productTypeId === "" ? null : productTypeId;
  const componentTypes = useComponentTypes(true, componentCategoryId);
  const styles = useMasterCatalog("STYLE");
  const celebrities = useMasterCatalog("CELEBRITY");
  const themes = useMasterCatalog("THEME");
  const workTypesCatalog = useMasterCatalog("WORK_TYPE");
  const processes = useProcessMasters(assignmentMode === "MANUAL");
  const employees = useMasterEmployees(true);

  const workTypeOptions = useMemo(() => {
    const fromCatalog = (workTypesCatalog.data ?? [])
      .filter((w) => isWorkTypeCode(w.code))
      .map((w) => ({ value: w.code as WorkType, label: w.name }));
    return fromCatalog.length > 0 ? fromCatalog : WORK_TYPE_OPTIONS;
  }, [workTypesCatalog.data]);

  const queueComponentOptions = useMemo(
    () =>
      (componentTypes.data ?? [])
        .filter((c) => componentTypeIds.includes(c.id))
        .map((c) => ({ id: String(c.id), label: c.name })),
    [componentTypes.data, componentTypeIds],
  );

  useEffect(() => {
    if (productTypeId === "") {
      setComponentTypeIds([]);
      return;
    }
    const allowed = new Set((componentTypes.data ?? []).map((c) => c.id));
    setComponentTypeIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [productTypeId, componentTypes.data]);

  const mastersLoading =
    productTypes.isLoading ||
    seasons.isLoading ||
    patterns.isLoading ||
    componentTypes.isLoading ||
    employees.isLoading ||
    (assignmentMode === "MANUAL" && processes.isLoading);

  const mastersError =
    productTypes.isError ||
    seasons.isError ||
    patterns.isError ||
    componentTypes.isError ||
    employees.isError ||
    (assignmentMode === "MANUAL" && processes.isError);

  const mastersErrorObj =
    productTypes.error ??
    seasons.error ??
    patterns.error ??
    componentTypes.error ??
    employees.error ??
    (assignmentMode === "MANUAL" ? processes.error : undefined);

  const availablePatterns = useMemo(
    () => filterWorkflowPatternsForProductType(patterns.data ?? [], productTypeId),
    [patterns.data, productTypeId],
  );

  const effectiveWorkflowPatternId = useMemo(() => {
    if (assignmentMode !== "AUTOMATIC") return workflowPatternId;
    if (
      workflowPatternId &&
      availablePatterns.some((pattern) => pattern.id === workflowPatternId)
    ) {
      return workflowPatternId;
    }
    if (availablePatterns.length === 1) return availablePatterns[0].id;
    return "";
  }, [assignmentMode, workflowPatternId, availablePatterns]);

  const stageOptions = useMemo(() => {
    return (processes.data ?? []).flatMap((process) =>
      (process.subProcesses ?? []).map((sub) => ({
        value: `${process.id}:${sub.id}`,
        label: `${sub.name} · ${process.name}`,
        processId: process.id,
        subProcessId: sub.id,
      })),
    );
  }, [processes.data]);

  const validationErrors: Record<string, string> = {};
  if (!collectionName.trim()) validationErrors.collectionName = "Design name is required";
  if (!productTypeId) validationErrors.productTypeId = "Product type is required";
  if (!seasonId) validationErrors.seasonId = "Season is required";
  if (!conceptNote.trim()) validationErrors.conceptNote = "Concept note is required";
  if (!targetEndDate) validationErrors.targetEndDate = "End date is required";
  else if (isBeforeToday(targetEndDate)) {
    validationErrors.targetEndDate = "End date cannot be in the past";
  }
  if (!priority) validationErrors.priority = "Priority is required";
  if (!assignmentMode) validationErrors.assignmentMode = "Task assignment is required";
  if (!hasPendingProductImage(pendingMedia)) {
    validationErrors.productImage = "At least one product image is required";
  }
  if (assignmentMode === "AUTOMATIC" && !effectiveWorkflowPatternId) {
    validationErrors.workflowPatternId =
      availablePatterns.length === 0
        ? "No workflow pattern available"
        : "Workflow pattern is required";
  }
  if (assignmentMode === "AUTOMATIC" && effectiveWorkflowPatternId) {
    if (patternSteps.length === 0) {
      validationErrors.patternSteps = "Set hours, due date, and priority for each workflow step";
    }
    patternSteps.forEach((step, index) => {
      if (!Number(step.hours) || Number(step.hours) <= 0) {
        validationErrors[`patternSteps.${index}.expectedMinutes`] =
          "Hours must be greater than zero";
      }
      if (!step.dueDate) {
        validationErrors[`patternSteps.${index}.dueAt`] = "Due date is required";
      } else if (isBeforeToday(step.dueDate)) {
        validationErrors[`patternSteps.${index}.dueAt`] = "Due date cannot be in the past";
      } else if (targetEndDate && step.dueDate > targetEndDate) {
        validationErrors[`patternSteps.${index}.dueAt`] = "Due date must be on or before the end date";
      }
      if (!step.priority) {
        validationErrors[`patternSteps.${index}.priority`] = "Priority is required";
      }
      if (!step.assignedEmployeeId) {
        validationErrors[`patternSteps.${index}.assignedEmployeeId`] = "Assign a person";
      }
    });
    if (
      Object.keys(validationErrors).some((key) => key.startsWith("patternSteps.")) &&
      !validationErrors.patternSteps
    ) {
      validationErrors.patternSteps = "Complete hours, due date, and priority for each step";
    }
  }
  if (assignmentMode === "MANUAL") {
    if (manualTasks.length === 0) {
      validationErrors.manualTasks = "Add at least one task";
    }
    manualTasks.forEach((task, index) => {
      if (!task.processId || !task.subProcessId) {
        validationErrors[`manualTasks.${index}.subProcessId`] = "Task stage is required";
      }
      if (!Number(task.hours) || Number(task.hours) <= 0) {
        validationErrors[`manualTasks.${index}.expectedMinutes`] =
          "Hours must be greater than zero";
      }
      if (!task.dueDate) {
        validationErrors[`manualTasks.${index}.dueAt`] = "Due date is required";
      } else if (isBeforeToday(task.dueDate)) {
        validationErrors[`manualTasks.${index}.dueAt`] = "Due date cannot be in the past";
      } else if (targetEndDate && task.dueDate > targetEndDate) {
        validationErrors[`manualTasks.${index}.dueAt`] =
          "Due date must be on or before the end date";
      }
      if (!task.priority) {
        validationErrors[`manualTasks.${index}.priority`] = "Priority is required";
      }
    });
    if (
      Object.keys(validationErrors).some((key) => key.startsWith("manualTasks.")) &&
      !validationErrors.manualTasks
    ) {
      validationErrors.manualTasks = "Complete all required task fields";
    }
  }

  const showErrors = attemptedSubmit;

  useEffect(() => {
    if (!errorScrollTick) return;
    const frame = requestAnimationFrame(() => scrollToFirstFormError("design-create-form"));
    return () => cancelAnimationFrame(frame);
  }, [errorScrollTick]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttemptedSubmit(true);
    setFieldErrors({});

    if (Object.keys(validationErrors).length > 0) {
      setErrorScrollTick((tick) => tick + 1);
      return;
    }

    try {
      const design = await createDesign.mutateAsync({
        productTypeId: Number(productTypeId),
        seasonId: Number(seasonId),
        collectionName: collectionName.trim(),
        conceptNote: conceptNote.trim(),
        targetEndDate,
        styleName: styleName.trim() || undefined,
        workType: workType || undefined,
        trendReference: trendReference.trim() || undefined,
        celebrityReference: celebrityReference.trim() || undefined,
        priority,
        assignmentMode,
        taskDateMode: assignmentMode === "AUTOMATIC" ? taskDateMode : undefined,
        workflowPatternId:
          assignmentMode === "AUTOMATIC" ? Number(effectiveWorkflowPatternId) : undefined,
        patternSteps:
          assignmentMode === "AUTOMATIC"
            ? patternSteps.map((step) => ({
                sequence: step.sequence,
                expectedMinutes: hoursToMinutes(step.hours),
                dueAt: step.dueDate,
                priority: step.priority,
                assignedEmployeeId: step.assignedEmployeeId
                  ? Number(step.assignedEmployeeId)
                  : undefined,
                instructionNote: step.note.trim() || undefined,
              }))
            : undefined,
        componentTypeIds: componentTypeIds.length ? componentTypeIds : undefined,
        manualTasks:
          assignmentMode === "MANUAL"
            ? manualTasks.map((task, index) => ({
                processId: Number(task.processId),
                subProcessId: Number(task.subProcessId),
                expectedMinutes: hoursToMinutes(task.hours),
                sequence: index + 1,
                assignedEmployeeId: task.assignedEmployeeId
                  ? Number(task.assignedEmployeeId)
                  : undefined,
                instructionNote: task.note.trim() || undefined,
                dueAt: task.dueDate,
                priority: task.priority,
              }))
            : undefined,
      });

      setMediaUploading(true);
      setMediaProgress(null);
      const queued = pendingMedia;
      const componentMap = buildComponentTypeIdMap(design.components);
      try {
        const { uploaded, failed } = await uploadPendingConceptMedia({
          designId: design.id,
          items: queued,
          componentTypeIdToDesignComponentId: componentMap,
          onProgress: setMediaProgress,
        });
        for (const item of queued) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
        setPendingMedia([]);

        const failedIndexes = new Set(failed.map((f) => f.index));
        const imageUploaded = queued.some(
          (m, i) => m.mediaKind === "IMAGE" && !failedIndexes.has(i),
        );

        if (!imageUploaded) {
          toast.error(
            "Image upload failed",
            "Design was created, but the required product image did not upload. Add it on the design page.",
          );
          router.push(`${ROUTES.designs.detail(design.id)}?setup=images`);
          return;
        }

        if (failed.length > 0) {
          toast.error(
            "Some media failed",
            `${failed.length} of ${queued.length} uploads failed. You can retry on the design page.`,
          );
        } else if (uploaded > 0) {
          toast.success(uploaded === 1 ? "Media uploaded" : `${uploaded} files uploaded`);
        }

        router.push(ROUTES.designs.detail(design.id));
      } finally {
        setMediaUploading(false);
        setMediaProgress(null);
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.details) {
        setFieldErrors(getFieldErrors(error.details));
      }
      setErrorScrollTick((tick) => tick + 1);
    }
  }

  if (!canCreate) {
    return (
      <div className="page-shell">
        <PageHeader title="Create Design Concept" />
        <PermissionDenied permission={PERMISSIONS.DESIGN_CREATE} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        className="create-concept-header"
        title="Create Design Concept"
        actions={
          <>
            <AppButtonLink href={ROUTES.designs.list} appVariant="ghost" size="sm">
              Cancel
            </AppButtonLink>
            <AppButton
              type="submit"
              form="design-create-form"
              appVariant="primary"
              size="sm"
              disabled={createDesign.isPending || mediaUploading}
            >
              {mediaUploading
                ? mediaProgress
                  ? `Uploading media ${mediaProgress.index + 1}/${mediaProgress.total}…`
                  : "Uploading media…"
                : createDesign.isPending
                  ? "Creating…"
                  : "Save Design & Create Tasks"}
            </AppButton>
          </>
        }
      />

      <QueryState
        isLoading={mastersLoading}
        isError={mastersError}
        error={mastersErrorObj}
        onRetry={() => {
          productTypes.refetch();
          seasons.refetch();
          patterns.refetch();
          componentTypes.refetch();
          if (assignmentMode === "MANUAL") {
            processes.refetch();
            employees.refetch();
          }
        }}
        skeletonVariant="table"
      >
        <form
          id="design-create-form"
          onSubmit={handleSubmit}
          noValidate
          className="form-card vstack vstack--loose"
        >
          {createDesign.isError && createDesign.error instanceof ApiClientError && (
            <ErrorBanner
              message={createDesign.error.message}
              correlationId={createDesign.error.correlationId}
            />
          )}

          <div className="form-layout">
            <AppCard title="Basics">
              <div className="form-grid">
                <FormTextField
                  id="collection"
                  label="Design name"
                  required
                  hint="The name of this one design. It shows on the board and in approvals. The idea number is created for you."
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  error={
                    showErrors
                      ? (validationErrors.collectionName ?? fieldErrors.collectionName?.[0])
                      : undefined
                  }
                />
                <div className="form-grid form-grid--2">
                  <FormTextField
                    id="createdDate"
                    label="Created"
                    type="date"
                    value={createdDate}
                    readOnly
                  />
                  <FormTextField
                    id="endDate"
                    label="End date"
                    required
                    type="date"
                    min={todayDateInput()}
                    value={targetEndDate}
                    onChange={(event) => setTargetEndDate(event.target.value)}
                    hint="Task due dates follow this date."
                    error={showErrors ? validationErrors.targetEndDate : undefined}
                  />
                </div>
                <div className="form-grid form-grid--2">
                  <FormSelect
                    id="productType"
                    label="Product Type"
                    required
                    value={productTypeId ? String(productTypeId) : null}
                    onValueChange={(v) => {
                      const next = v ? Number(v) : "";
                      setProductTypeId(next);
                      if (!next) setComponentTypeIds([]);
                    }}
                    options={(productTypes.data ?? []).map((pt) => ({
                      value: String(pt.id),
                      label: pt.name,
                    }))}
                    placeholder="Select…"
                    error={showErrors ? validationErrors.productTypeId : undefined}
                  />
                  <FormSelect
                    id="season"
                    label="Season"
                    required
                    value={seasonId ? String(seasonId) : null}
                    onValueChange={(v) => setSeasonId(v ? Number(v) : "")}
                    options={(seasons.data ?? []).map((s) => ({
                      value: String(s.id),
                      label: s.name,
                    }))}
                    placeholder="Select…"
                    error={showErrors ? validationErrors.seasonId : undefined}
                  />
                </div>
                <div className="form-grid form-grid--2">
                  <FormSelect
                    id="styleName"
                    label="Style"
                    value={styleName || null}
                    onValueChange={(v) => setStyleName(v ?? "")}
                    options={(styles.data ?? []).map((s) => ({ value: s.name, label: s.name }))}
                    placeholder="Select style…"
                  />
                  <FormSelect
                    id="workType"
                    label="Work Type"
                    value={workType || null}
                    onValueChange={(v) => setWorkType(v as WorkType)}
                    options={workTypeOptions}
                    placeholder="Select…"
                  />
                  <FormSelect
                    id="trendReference"
                    label="Theme / Trend"
                    value={trendReference || null}
                    onValueChange={(v) => setTrendReference(v ?? "")}
                    options={(themes.data ?? []).map((t) => ({ value: t.name, label: t.name }))}
                    placeholder="Select theme…"
                  />
                  <FormSelect
                    id="celebrityReference"
                    label="Celebrity"
                    value={celebrityReference || null}
                    onValueChange={(v) => setCelebrityReference(v ?? "")}
                    options={(celebrities.data ?? []).map((c) => ({
                      value: c.name,
                      label: c.name,
                    }))}
                    placeholder="Select…"
                  />
                </div>
                <FormTextArea
                  id="concept"
                  label="Concept Note"
                  required
                  rows={3}
                  value={conceptNote}
                  onChange={(e) => setConceptNote(e.target.value)}
                  placeholder="Short note about the idea"
                  error={showErrors ? validationErrors.conceptNote : undefined}
                  onEnterSubmit={
                    createDesign.isPending || mediaUploading
                      ? undefined
                      : () => {
                          const form = document.getElementById("design-create-form");
                          if (form instanceof HTMLFormElement) form.requestSubmit();
                        }
                  }
                />
                <DesignComponentTypePicker
                  requiresProductType
                  productTypeSelected={productTypeId !== ""}
                  options={componentTypes.data ?? []}
                  value={componentTypeIds}
                  onChange={(ids) => {
                    setComponentTypeIds(ids);
                    setPendingMedia((prev) =>
                      prev.map((item) =>
                        item.componentTypeId != null && !ids.includes(item.componentTypeId)
                          ? { ...item, componentTypeId: null }
                          : item,
                      ),
                    );
                  }}
                />
              </div>
            </AppCard>

            <AppCard title="Product Image">
              <div className="form-grid">
                <div className="form-group">
                  <span className="form-label text-sm font-medium">
                    Product Image{" "}
                    <span className="font-semibold text-[var(--color-danger)]" aria-hidden="true">
                      *
                    </span>
                    <span className="sr-only">(required)</span>
                  </span>
                  <ConceptMediaPanel
                    queueMode
                    pendingItems={pendingMedia}
                    onPendingChange={setPendingMedia}
                    components={queueComponentOptions}
                    canUpload
                    compact
                    showIntro
                    requiredImage
                    error={showErrors ? validationErrors.productImage : undefined}
                  />
                  {mediaUploading && mediaProgress ? (
                    <div className="vstack vstack--tight mt-2">
                      <p className="m-0 text-sm text-[var(--color-neutral-600)]">
                        Uploading {mediaProgress.fileName} ({mediaProgress.index + 1}/
                        {mediaProgress.total})
                      </p>
                      <div
                        role="progressbar"
                        aria-valuenow={mediaProgress.index + 1}
                        aria-valuemin={0}
                        aria-valuemax={mediaProgress.total}
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: "var(--border)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round(
                              ((mediaProgress.index +
                                (mediaProgress.status === "done" ? 1 : 0.5)) /
                                mediaProgress.total) *
                                100,
                            )}%`,
                            height: "100%",
                            background: "var(--color-primary)",
                            transition: "width 0.2s ease",
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </AppCard>

            <div className="form-layout-span">
              <AppCard title="Task Assignment System">
                <div className="form-grid form-grid--2">
                  <FormSelect
                    id="priority"
                    label="Priority"
                    required
                    value={priority}
                    onValueChange={(v) => setPriority(v as Priority)}
                    options={PRIORITY_OPTIONS}
                    error={showErrors ? validationErrors.priority : undefined}
                  />
                </div>
                <DesignAssignmentPanel
                    assignmentMode={assignmentMode}
                    onAssignmentModeChange={setAssignmentMode}
                    workflowPatternId={workflowPatternId || effectiveWorkflowPatternId || ""}
                    onWorkflowPatternIdChange={setWorkflowPatternId}
                    taskDateMode={taskDateMode}
                    onTaskDateModeChange={setTaskDateMode}
                    availablePatterns={availablePatterns}
                    designPriority={priority}
                    manualTasks={manualTasks}
                    onManualTasksChange={setManualTasks}
                    stageOptions={stageOptions}
                    employees={employees.data ?? []}
                    onPatternStepsChange={setPatternSteps}
                    showErrors={showErrors}
                    validationErrors={validationErrors}
                    fieldErrors={fieldErrors}
                    targetEndDate={targetEndDate}
                  />
              </AppCard>
            </div>
          </div>
        </form>
      </QueryState>
    </div>
  );
}
