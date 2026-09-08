"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
  useMasterEmployees,
  useProcessMasters,
  useProductTypes,
  useSeasons,
  useWorkflowPatterns,
} from "@/hooks/use-masters";
import { getFieldErrors, ApiClientError } from "@/lib/api-client";
import type { Priority } from "@/lib/types/api";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { filterWorkflowPatternsForProductType } from "@/lib/workflow-patterns";
import type { TaskDateMode } from "@/lib/services/task-date-mode";
import {
  DesignAssignmentPanel,
  emptyManualTask,
  hoursToMinutes,
  type AssignmentMode,
  type ManualTaskDraft,
} from "@/features/designs/DesignAssignmentPanel";
import { DesignHeadSelectField } from "@/features/designs/DesignHeadSelectField";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

function hasPendingProductImage(items: PendingConceptMedia[]) {
  return items.some((item) => item.mediaKind === "IMAGE");
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
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [productTypeId, setProductTypeId] = useState<number | "">("");
  const [seasonId, setSeasonId] = useState<number | "">("");
  const [designHeadEmployeeId, setDesignHeadEmployeeId] = useState<number | "">("");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("AUTOMATIC");
  const [workflowPatternId, setWorkflowPatternId] = useState<number | "">("");
  const [taskDateMode, setTaskDateMode] = useState<TaskDateMode>("SEQUENTIAL");
  const [manualTasks, setManualTasks] = useState<ManualTaskDraft[]>(() => [
    emptyManualTask(0, "MEDIUM"),
  ]);
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
  const processes = useProcessMasters(assignmentMode === "MANUAL");
  const employees = useMasterEmployees(assignmentMode === "MANUAL");

  const mastersLoading =
    productTypes.isLoading ||
    seasons.isLoading ||
    patterns.isLoading ||
    (assignmentMode === "MANUAL" && (processes.isLoading || employees.isLoading));

  const mastersError =
    productTypes.isError ||
    seasons.isError ||
    patterns.isError ||
    (assignmentMode === "MANUAL" && (processes.isError || employees.isError));

  const mastersErrorObj =
    productTypes.error ??
    seasons.error ??
    patterns.error ??
    (assignmentMode === "MANUAL" ? (processes.error ?? employees.error) : undefined);

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
  if (!collectionName.trim()) validationErrors.collectionName = "Collection name is required";
  if (!productTypeId) validationErrors.productTypeId = "Product type is required";
  if (!seasonId) validationErrors.seasonId = "Season is required";
  if (!designHeadEmployeeId) {
    validationErrors.designHeadEmployeeId = "Design Head is required";
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
        designHeadEmployeeId: Number(designHeadEmployeeId),
        conceptNote: conceptNote.trim() || undefined,
        priority,
        assignmentMode,
        taskDateMode: assignmentMode === "AUTOMATIC" ? taskDateMode : undefined,
        workflowPatternId:
          assignmentMode === "AUTOMATIC" ? Number(effectiveWorkflowPatternId) : undefined,
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
                dueAt: task.dueDate,
                priority: task.priority,
              }))
            : undefined,
      });

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
                    id="productType"
                    label="Product Type"
                    required
                    value={productTypeId ? String(productTypeId) : null}
                    onValueChange={(v) => setProductTypeId(v ? Number(v) : "")}
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
                  <DesignHeadSelectField
                    id="designHead"
                    value={designHeadEmployeeId}
                    onChange={setDesignHeadEmployeeId}
                    preferEmployeeId={session?.user?.employeeId}
                    preferRoleCode={session?.user?.roleCode}
                    error={
                      showErrors
                        ? (validationErrors.designHeadEmployeeId ??
                          fieldErrors.designHeadEmployeeId?.[0])
                        : undefined
                    }
                  />
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
                <FormTextArea
                  id="concept"
                  label="Concept Note"
                  rows={3}
                  value={conceptNote}
                  onChange={(e) => setConceptNote(e.target.value)}
                  placeholder="Optional short note about the idea"
                  onEnterSubmit={
                    createDesign.isPending || mediaUploading
                      ? undefined
                      : () => {
                          const form = document.getElementById("design-create-form");
                          if (form instanceof HTMLFormElement) form.requestSubmit();
                        }
                  }
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
                    showErrors={showErrors}
                    validationErrors={validationErrors}
                    fieldErrors={fieldErrors}
                  />
              </AppCard>
            </div>
          </div>
        </form>
      </QueryState>
    </div>
  );
}
