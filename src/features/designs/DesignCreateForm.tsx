"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
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
  useDesignGrades,
  useFabrics,
  useMachines,
  useMasterCatalog,
  useMasterEmployees,
  useProcessMasters,
  useProductTypes,
  useSeasons,
  useStitchingTypes,
  useWorkflowPatterns,
} from "@/hooks/use-masters";
import { getFieldErrors, ApiClientError } from "@/lib/api-client";
import type { Priority, WorkType } from "@/lib/types/api";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { filterWorkflowPatternsForProductType } from "@/lib/workflow-patterns";

type AssignmentMode = "AUTOMATIC" | "MANUAL";

type ManualTaskDraft = {
  id: string;
  processId: number | "";
  subProcessId: number | "";
  expectedMinutes: string;
  assignedEmployeeId: number | "";
};

function emptyManualTask(index: number): ManualTaskDraft {
  return {
    id: `manual-task-${index}-${Date.now()}`,
    processId: "",
    subProcessId: "",
    expectedMinutes: "60",
    assignedEmployeeId: "",
  };
}

const WORK_TYPE_OPTIONS: { value: WorkType; label: string }[] = [
  { value: "NEW_DESIGN", label: "New Design" },
  { value: "REPEAT", label: "Repeat" },
  { value: "REVIVAL", label: "Revival" },
  { value: "CUSTOM", label: "Custom" },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const ASSIGNMENT_MODE_OPTIONS: { value: AssignmentMode; label: string }[] = [
  { value: "AUTOMATIC", label: "Automatic" },
  { value: "MANUAL", label: "Manual" },
];

export function DesignCreateForm() {
  const router = useRouter();
  const toast = useApiToast();
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canCreate = permissions.includes(PERMISSIONS.DESIGN_CREATE);
  const createDesign = useCreateDesign();

  const [collectionName, setCollectionName] = useState("");
  const [styleName, setStyleName] = useState("");
  const [conceptNote, setConceptNote] = useState("");
  const [workType, setWorkType] = useState<WorkType | "">("");
  const [trendReference, setTrendReference] = useState("");
  const [celebrityReference, setCelebrityReference] = useState("");
  const [themeName, setThemeName] = useState("");
  const [targetGrade, setTargetGrade] = useState("");
  const [designGradeId, setDesignGradeId] = useState<number | "">("");
  const [fabricId, setFabricId] = useState<number | "">("");
  const [machineId, setMachineId] = useState<number | "">("");
  const [stitchingTypeId, setStitchingTypeId] = useState<number | "">("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [productTypeId, setProductTypeId] = useState<number | "">("");
  const [seasonId, setSeasonId] = useState<number | "">("");
  const [componentTypeIds, setComponentTypeIds] = useState<number[]>([]);
  const [componentSpecs, setComponentSpecs] = useState<Record<number, string>>({});
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("AUTOMATIC");
  const [workflowPatternId, setWorkflowPatternId] = useState<number | "">("");
  const [manualTasks, setManualTasks] = useState<ManualTaskDraft[]>(() => [emptyManualTask(0)]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingConceptMedia[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState<ConceptMediaUploadProgress | null>(
    null,
  );

  const productTypes = useProductTypes();
  const seasons = useSeasons();
  const patterns = useWorkflowPatterns();
  const componentTypes = useComponentTypes();
  const fabrics = useFabrics();
  const machines = useMachines();
  const stitchingTypes = useStitchingTypes();
  const designGrades = useDesignGrades();
  const styles = useMasterCatalog("STYLE");
  const celebrities = useMasterCatalog("CELEBRITY");
  const themes = useMasterCatalog("THEME");
  const workTypesCatalog = useMasterCatalog("WORK_TYPE");
  const processes = useProcessMasters(assignmentMode === "MANUAL");
  const employees = useMasterEmployees(assignmentMode === "MANUAL");

  const mastersLoading =
    productTypes.isLoading ||
    seasons.isLoading ||
    patterns.isLoading ||
    componentTypes.isLoading ||
    (assignmentMode === "MANUAL" && (processes.isLoading || employees.isLoading));

  const mastersError =
    productTypes.isError ||
    seasons.isError ||
    patterns.isError ||
    componentTypes.isError ||
    (assignmentMode === "MANUAL" && (processes.isError || employees.isError));

  const mastersErrorObj =
    productTypes.error ??
    seasons.error ??
    patterns.error ??
    componentTypes.error ??
    (assignmentMode === "MANUAL" ? processes.error ?? employees.error : undefined);

  const availableComponentTypes = useMemo(() => {
    const types = componentTypes.data ?? [];
    if (!productTypeId) return types;
    return types.filter(
      (ct) => ct.productTypeId == null || ct.productTypeId === productTypeId,
    );
  }, [componentTypes.data, productTypeId]);

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

  const validationErrors: Record<string, string> = {};
  if (!collectionName.trim()) validationErrors.collectionName = "Collection name is required";
  if (!productTypeId) validationErrors.productTypeId = "Product type is required";
  if (!seasonId) validationErrors.seasonId = "Season is required";
  if (!priority) validationErrors.priority = "Priority is required";
  if (!assignmentMode) validationErrors.assignmentMode = "Task assignment is required";
  if (assignmentMode === "AUTOMATIC" && !effectiveWorkflowPatternId) {
    validationErrors.workflowPatternId =
      availablePatterns.length === 0
        ? "No workflow pattern available"
        : "Workflow pattern is required";
  }
  if (assignmentMode === "MANUAL") {
    if (manualTasks.length === 0) {
      validationErrors.manualTasks = "Add at least one task";
    }
    manualTasks.forEach((task, index) => {
      if (!task.processId) {
        validationErrors[`manualTasks.${index}.processId`] = "Process is required";
      }
      if (!task.subProcessId) {
        validationErrors[`manualTasks.${index}.subProcessId`] = "Sub-process is required";
      }
      if (!Number(task.expectedMinutes) || Number(task.expectedMinutes) <= 0) {
        validationErrors[`manualTasks.${index}.expectedMinutes`] =
          "Expected minutes must be greater than zero";
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

  function toggleComponentType(id: number) {
    setComponentTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function updateManualTask(id: string, patch: Partial<ManualTaskDraft>) {
    setManualTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  }

  function handleManualProcessChange(task: ManualTaskDraft, processId: number | "") {
    updateManualTask(task.id, { processId, subProcessId: "" });
  }

  function addManualTaskRow() {
    setManualTasks((prev) => [...prev, emptyManualTask(prev.length)]);
  }

  function removeManualTaskRow(id: string) {
    setManualTasks((prev) => (prev.length <= 1 ? prev : prev.filter((task) => task.id !== id)));
  }

  function moveManualTask(id: string, direction: "up" | "down") {
    setManualTasks((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      if (index < 0) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttemptedSubmit(true);
    setFieldErrors({});

    if (Object.keys(validationErrors).length > 0) return;

    try {
      const design = await createDesign.mutateAsync({
        productTypeId: Number(productTypeId),
        seasonId: Number(seasonId),
        collectionName: collectionName.trim(),
        styleName: styleName.trim() || undefined,
        conceptNote: conceptNote.trim() || undefined,
        workType: workType || undefined,
        trendReference: themeName.trim() || trendReference.trim() || undefined,
        celebrityReference: celebrityReference.trim() || undefined,
        targetGrade: targetGrade.trim() || undefined,
        designGradeId: designGradeId ? Number(designGradeId) : undefined,
        fabricId: fabricId ? Number(fabricId) : undefined,
        machineId: machineId ? Number(machineId) : undefined,
        stitchingTypeId: stitchingTypeId ? Number(stitchingTypeId) : undefined,
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
        priority,
        componentTypeIds: componentTypeIds.length > 0 ? componentTypeIds : undefined,
        componentSpecs:
          componentTypeIds.length > 0
            ? Object.fromEntries(
                componentTypeIds
                  .filter((id) => componentSpecs[id]?.trim())
                  .map((id) => [String(id), componentSpecs[id].trim()]),
              )
            : undefined,
        assignmentMode,
        workflowPatternId:
          assignmentMode === "AUTOMATIC" ? Number(effectiveWorkflowPatternId) : undefined,
        manualTasks:
          assignmentMode === "MANUAL"
            ? manualTasks.map((task, index) => ({
                processId: Number(task.processId),
                subProcessId: Number(task.subProcessId),
                expectedMinutes: Number(task.expectedMinutes),
                sequence: index + 1,
                assignedEmployeeId: task.assignedEmployeeId
                  ? Number(task.assignedEmployeeId)
                  : undefined,
              }))
            : undefined,
      });

      let hasPrimaryImage = false;
      if (pendingMedia.length > 0) {
        setMediaUploading(true);
        setMediaProgress(null);
        const queued = pendingMedia;
        try {
          const { uploaded, failed } = await uploadPendingConceptMedia({
            designId: design.id,
            items: queued,
            onProgress: setMediaProgress,
          });
          for (const item of queued) {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          }
          setPendingMedia([]);
          const failedIndexes = new Set(failed.map((f) => f.index));
          hasPrimaryImage = queued.some(
            (m, i) => m.mediaKind === "IMAGE" && !failedIndexes.has(i),
          );
          if (failed.length > 0) {
            toast.error(
              "Some media failed",
              `${failed.length} of ${queued.length} uploads failed. You can retry on the design page.`,
            );
          } else if (uploaded > 0) {
            toast.success(
              uploaded === 1 ? "Media uploaded" : `${uploaded} files uploaded`,
            );
          }
        } finally {
          setMediaUploading(false);
          setMediaProgress(null);
        }
      }

      const setupQuery = hasPrimaryImage ? "" : "?setup=images";
      router.push(`${ROUTES.designs.detail(design.id)}${setupQuery}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.details) {
        setFieldErrors(getFieldErrors(error.details));
      }
    }
  }

  const processList = processes.data ?? [];

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
                  : "Create & Generate Tasks"}
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

          <div className="form-layout form-layout--split">
            <AppCard title="Basics">
              <div className="form-grid">
                <FormTextField
                  id="collection"
                  label="Collection Name"
                  required
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  error={
                    showErrors
                      ? (validationErrors.collectionName ?? fieldErrors.collectionName?.[0])
                      : undefined
                  }
                />

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
                    id="designGradeId"
                    label="Design Grade"
                    value={designGradeId ? String(designGradeId) : null}
                    onValueChange={(v) => {
                      const id = v ? Number(v) : "";
                      setDesignGradeId(id);
                      const grade = (designGrades.data ?? []).find((g) => g.id === id);
                      setTargetGrade(grade?.name ?? "");
                    }}
                    options={(designGrades.data ?? []).map((g) => ({
                      value: String(g.id),
                      label: g.name,
                    }))}
                    placeholder="Select grade…"
                  />
                </div>

                <div className="form-grid form-grid--2">
                  <FormSelect
                    id="fabricId"
                    label="Fabric"
                    value={fabricId ? String(fabricId) : null}
                    onValueChange={(v) => setFabricId(v ? Number(v) : "")}
                    options={(fabrics.data ?? []).map((f) => ({
                      value: String(f.id),
                      label: f.name,
                    }))}
                    placeholder="Select fabric…"
                  />
                  <FormSelect
                    id="machineId"
                    label="Machine"
                    value={machineId ? String(machineId) : null}
                    onValueChange={(v) => setMachineId(v ? Number(v) : "")}
                    options={(machines.data ?? []).map((m) => ({
                      value: String(m.id),
                      label: m.name,
                    }))}
                    placeholder="Select machine…"
                  />
                </div>

                <FormSelect
                  id="stitchingTypeId"
                  label="Stitching Type"
                  value={stitchingTypeId ? String(stitchingTypeId) : null}
                  onValueChange={(v) => setStitchingTypeId(v ? Number(v) : "")}
                  options={(stitchingTypes.data ?? []).map((s) => ({
                    value: String(s.id),
                    label: s.name,
                  }))}
                  placeholder="Select stitching…"
                />

                <div className="form-grid form-grid--2">
                  <FormSelect
                    id="workType"
                    label="Work Type"
                    value={workType || null}
                    onValueChange={(v) => setWorkType(v as WorkType)}
                    options={
                      (workTypesCatalog.data ?? []).length > 0
                        ? (workTypesCatalog.data ?? []).map((w) => ({
                            value: w.code as WorkType,
                            label: w.name,
                          }))
                        : WORK_TYPE_OPTIONS
                    }
                    placeholder="Select…"
                  />
                  <FormTextField
                    id="estimatedCost"
                    label="Estimated Cost (₹)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                  />
                </div>

                <div className="form-grid form-grid--2">
                  <FormSelect
                    id="themeName"
                    label="Theme"
                    value={themeName || null}
                    onValueChange={(v) => {
                      setThemeName(v ?? "");
                      setTrendReference(v ?? "");
                    }}
                    options={(themes.data ?? []).map((t) => ({
                      value: t.name,
                      label: t.name,
                    }))}
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
                    placeholder="Select celebrity…"
                  />
                </div>

                <FormTextArea
                  id="concept"
                  label="Concept Note"
                  rows={3}
                  value={conceptNote}
                  onChange={(e) => setConceptNote(e.target.value)}
                  onEnterSubmit={
                    createDesign.isPending
                      ? undefined
                      : () => {
                          const form = document.getElementById("design-create-form");
                          if (form instanceof HTMLFormElement) form.requestSubmit();
                        }
                  }
                />

                <FormTextField
                  id="trendReference"
                  label="Trend Reference"
                  value={trendReference}
                  onChange={(e) => setTrendReference(e.target.value)}
                />
              </div>
            </AppCard>

            <div className="vstack vstack--loose min-w-0">
            <AppCard title="Product">
              <div className="form-grid">
                <div className="form-grid form-grid--2">
                  <FormSelect
                    id="productType"
                    label="Product Type"
                    required
                    value={productTypeId ? String(productTypeId) : null}
                    onValueChange={(v) => {
                      const next = v ? Number(v) : "";
                      setProductTypeId(next);
                      if (next) {
                        setComponentTypeIds((prev) =>
                          prev.filter((id) => {
                            const ct = componentTypes.data?.find((c) => c.id === id);
                            return !ct || ct.productTypeId == null || ct.productTypeId === next;
                          }),
                        );
                      }
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

                {availableComponentTypes.length > 0 ? (
                  <div className="form-group space-y-2">
                    <span className="form-label text-sm font-medium">Component Types</span>
                    <div className="form-grid form-grid--checkboxes">
                      {availableComponentTypes.map((ct) => (
                        <label key={ct.id} className="form-checkbox-row form-group--flat">
                          <input
                            type="checkbox"
                            checked={componentTypeIds.includes(ct.id)}
                            onChange={() => toggleComponentType(ct.id)}
                          />
                          <span>{ct.name}</span>
                        </label>
                      ))}
                    </div>
                    {componentTypeIds.length > 0 ? (
                      <div className="vstack vstack--tight mt-2">
                        <span className="form-label text-sm font-medium">Component specs</span>
                        {componentTypeIds.map((id) => {
                          const ct = availableComponentTypes.find((c) => c.id === id);
                          return (
                            <FormTextField
                              key={id}
                              id={`comp-spec-${id}`}
                              label={ct?.name ?? String(id)}
                              value={componentSpecs[id] ?? ""}
                              onChange={(e) =>
                                setComponentSpecs((prev) => ({
                                  ...prev,
                                  [id]: e.target.value,
                                }))
                              }
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </AppCard>

              <AppCard title="Media & references">
                <ConceptMediaPanel
                  queueMode
                  pendingItems={pendingMedia}
                  onPendingChange={setPendingMedia}
                  canUpload
                  compact
                  showIntro
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
              </AppCard>
            </div>

            <div className="form-layout-span">
              <AppCard title="Assignment">
                <div className="form-grid">
                  <div
                    className={
                      assignmentMode === "AUTOMATIC"
                        ? "form-grid form-grid--3"
                        : "form-grid form-grid--2"
                    }
                  >
                    <FormSelect
                      id="priority"
                      label="Priority"
                      required
                      value={priority}
                      onValueChange={(v) => setPriority(v as Priority)}
                      options={PRIORITY_OPTIONS}
                      error={showErrors ? validationErrors.priority : undefined}
                    />
                    <FormSelect
                      id="assignmentMode"
                      label="Task Assignment"
                      required
                      value={assignmentMode}
                      onValueChange={(v) => setAssignmentMode(v as AssignmentMode)}
                      options={ASSIGNMENT_MODE_OPTIONS}
                      error={showErrors ? validationErrors.assignmentMode : undefined}
                    />
                    {assignmentMode === "AUTOMATIC" && (
                      <FormSelect
                        id="pattern"
                        label="Workflow Pattern"
                        required
                        value={
                          availablePatterns.length === 0
                            ? null
                            : effectiveWorkflowPatternId || workflowPatternId
                              ? String(effectiveWorkflowPatternId || workflowPatternId)
                              : null
                        }
                        onValueChange={(v) =>
                          setWorkflowPatternId(v ? Number(v) : "")
                        }
                        options={availablePatterns.map((p) => ({
                          value: String(p.id),
                          label: `${p.name} (v${p.versionNo})${p.productType ? ` · ${p.productType.name}` : ""}`,
                        }))}
                        placeholder="Select…"
                        disabled={availablePatterns.length === 0}
                        error={
                          showErrors
                            ? (validationErrors.workflowPatternId ??
                              fieldErrors.workflowPatternId?.[0])
                            : undefined
                        }
                      />
                    )}
                  </div>

                  {assignmentMode === "MANUAL" && (
                    <div>
                      <div className="form-row-header">
                        <span className="form-label text-sm font-medium">
                          Manual Tasks{" "}
                          <span className="font-semibold text-[var(--color-danger)]" aria-hidden="true">
                            *
                          </span>
                          <span className="sr-only">(required)</span>
                        </span>
                        <AppButton
                          type="button"
                          appVariant="secondary"
                          size="sm"
                          onClick={addManualTaskRow}
                        >
                          Add Task
                        </AppButton>
                      </div>

                      {showErrors &&
                        (validationErrors.manualTasks || fieldErrors.manualTasks) && (
                          <span className="form-error form-error-block text-xs text-destructive">
                            {validationErrors.manualTasks ?? fieldErrors.manualTasks?.[0]}
                          </span>
                        )}

                      <div className="form-grid form-grid--relaxed">
                        {manualTasks.map((task, index) => {
                          const process = processList.find((p) => p.id === task.processId);
                          const subProcesses = process?.subProcesses ?? [];

                          return (
                            <AppCard
                              key={task.id}
                              flat
                              title={`Task ${index + 1}`}
                              contentClassName="space-y-3"
                              headerAction={
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
                              }
                            >
                              <div className="form-grid form-grid--2 form-grid--tight">
                                <FormSelect
                                  id={`${task.id}-process`}
                                  label="Process"
                                  required
                                  value={task.processId ? String(task.processId) : null}
                                  onValueChange={(v) =>
                                    handleManualProcessChange(task, v ? Number(v) : "")
                                  }
                                  options={processList.map((p) => ({
                                    value: String(p.id),
                                    label: p.name,
                                  }))}
                                  placeholder="Select…"
                                  error={
                                    showErrors
                                      ? validationErrors[`manualTasks.${index}.processId`]
                                      : undefined
                                  }
                                />
                                <FormSelect
                                  id={`${task.id}-subprocess`}
                                  label="Sub-process"
                                  required
                                  value={task.subProcessId ? String(task.subProcessId) : null}
                                  onValueChange={(v) =>
                                    updateManualTask(task.id, {
                                      subProcessId: v ? Number(v) : "",
                                    })
                                  }
                                  options={subProcesses.map((sp) => ({
                                    value: String(sp.id),
                                    label: sp.name,
                                  }))}
                                  placeholder="Select…"
                                  disabled={!task.processId}
                                  error={
                                    showErrors
                                      ? validationErrors[`manualTasks.${index}.subProcessId`]
                                      : undefined
                                  }
                                />
                              </div>

                              <div className="form-grid form-grid--2 form-grid--tight">
                                <FormTextField
                                  id={`${task.id}-minutes`}
                                  label="Expected Minutes"
                                  required
                                  type="number"
                                  min={1}
                                  value={task.expectedMinutes}
                                  onChange={(e) =>
                                    updateManualTask(task.id, {
                                      expectedMinutes: e.target.value,
                                    })
                                  }
                                  error={
                                    showErrors
                                      ? validationErrors[`manualTasks.${index}.expectedMinutes`]
                                      : undefined
                                  }
                                />
                                <FormSelect
                                  id={`${task.id}-assignee`}
                                  label="Assign To"
                                  value={
                                    task.assignedEmployeeId
                                      ? String(task.assignedEmployeeId)
                                      : "__auto__"
                                  }
                                  onValueChange={(v) =>
                                    updateManualTask(task.id, {
                                      assignedEmployeeId:
                                        !v || v === "__auto__" ? "" : Number(v),
                                    })
                                  }
                                  options={[
                                    { value: "__auto__", label: "Auto by role" },
                                    ...(employees.data ?? []).map((emp) => ({
                                      value: String(emp.id),
                                      label: emp.name,
                                    })),
                                  ]}
                                  placeholder="Select…"
                                />
                              </div>
                            </AppCard>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </AppCard>
            </div>
          </div>
        </form>
      </QueryState>
    </div>
  );
}
