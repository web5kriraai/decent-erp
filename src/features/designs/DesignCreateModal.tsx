"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { AppButton } from "@/components/ui/AppButton";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { FormTextField } from "@/components/ui/form-text-field";
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
import { ROUTES } from "@/config/routes";
import { filterWorkflowPatternsForProductType } from "@/lib/workflow-patterns";
import type { TaskDateMode } from "@/lib/services/task-date-mode";
import {
  DesignAssignmentPanel,
  emptyManualTask,
  hoursToMinutes,
  type AssignmentMode,
  type ManualTaskDraft,
} from "@/features/designs/DesignAssignmentPanel";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

type DesignCreateModalProps = {
  open: boolean;
  onClose: () => void;
};

export function DesignCreateModal({ open, onClose }: DesignCreateModalProps) {
  const router = useRouter();
  const toast = useApiToast();
  const { data: session } = useSession();
  const createDesign = useCreateDesign();

  const [collectionName, setCollectionName] = useState("");
  const [conceptNote, setConceptNote] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [productTypeId, setProductTypeId] = useState<number | "">("");
  const [seasonId, setSeasonId] = useState<number | "">("");
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

  const productTypes = useProductTypes(open);
  const seasons = useSeasons(open);
  const patterns = useWorkflowPatterns(open);
  const processes = useProcessMasters(open && assignmentMode === "MANUAL");
  const employees = useMasterEmployees(open && assignmentMode === "MANUAL");

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
  if (assignmentMode === "AUTOMATIC" && !effectiveWorkflowPatternId) {
    validationErrors.workflowPatternId =
      availablePatterns.length === 0
        ? "No workflow pattern available"
        : "Workflow pattern is required";
  }
  if (!pendingMedia.some((item) => item.mediaKind === "IMAGE")) {
    validationErrors.productImage = "At least one product image is required";
  }
  if (assignmentMode === "MANUAL") {
    if (manualTasks.length === 0) validationErrors.manualTasks = "Add at least one task";
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
  const busy = createDesign.isPending || mediaUploading;
  const ideaRefHint = `AUTO: ${session?.user?.name ? "ID" : "ID"}-${new Date().getFullYear()}-…`;

  function resetForm() {
    setCollectionName("");
    setConceptNote("");
    setPriority("MEDIUM");
    setProductTypeId("");
    setSeasonId("");
    setAssignmentMode("AUTOMATIC");
    setWorkflowPatternId("");
    setTaskDateMode("SEQUENTIAL");
    setManualTasks([emptyManualTask(0, "MEDIUM")]);
    setFieldErrors({});
    setAttemptedSubmit(false);
    for (const item of pendingMedia) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    setPendingMedia([]);
  }

  function handleClose() {
    if (busy) return;
    resetForm();
    onClose();
  }

  async function handleSave() {
    setAttemptedSubmit(true);
    setFieldErrors({});
    if (Object.keys(validationErrors).length > 0 || busy) return;

    try {
      const design = await createDesign.mutateAsync({
        productTypeId: Number(productTypeId),
        seasonId: Number(seasonId),
        collectionName: collectionName.trim(),
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
          resetForm();
          onClose();
          router.push(`${ROUTES.designs.detail(design.id)}?setup=images`);
          return;
        }

        if (failed.length > 0) {
          toast.error(
            "Some media failed",
            `${failed.length} of ${queued.length} uploads failed.`,
          );
        } else if (uploaded > 0) {
          toast.success(uploaded === 1 ? "Media uploaded" : `${uploaded} files uploaded`);
        }

        resetForm();
        onClose();
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

  return (
    <Modal
      open={open}
      title="Create New Design Concept"
      onClose={handleClose}
      size="xl"
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={handleClose} disabled={busy}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            appVariant="primary"
            disabled={busy}
            onClick={() => void handleSave()}
          >
            {mediaUploading
              ? mediaProgress
                ? `Uploading ${mediaProgress.index + 1}/${mediaProgress.total}…`
                : "Uploading…"
              : createDesign.isPending
                ? "Saving…"
                : "Save Design & Create Tasks"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm>
        <ModalFormGrid>
          <FormTextField
            id="createIdeaRef"
            label="Idea Ref"
            value={ideaRefHint}
            readOnly
            disabled
          />
          <FormSelect
            id="createProduct"
            label="Product"
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
        </ModalFormGrid>
        <ModalFormGrid>
          <FormTextField
            id="createCollection"
            label="Collection"
            required
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            placeholder="Collection name"
            error={showErrors ? validationErrors.collectionName : undefined}
          />
          <FormSelect
            id="createSeason"
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
        </ModalFormGrid>
        <ModalFormGrid>
          <FormTextField
            id="createDesignHead"
            label="Design Head"
            value={session?.user?.name ?? "Current user"}
            readOnly
            disabled
          />
          <FormSelect
            id="createPriority"
            label="Priority"
            required
            value={priority}
            onValueChange={(v) => setPriority(v as Priority)}
            options={PRIORITY_OPTIONS}
          />
        </ModalFormGrid>
        <FormTextArea
          id="createConcept"
          label="Concept Note"
          rows={3}
          value={conceptNote}
          onChange={(e) => setConceptNote(e.target.value)}
          placeholder="Optional short note about the idea"
        />

        <div className="form-section-label">Task Assignment System</div>
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

        <div className="form-section-label">
          Product Image{" "}
          <span className="font-semibold text-[var(--color-danger)]" aria-hidden="true">
            *
          </span>
        </div>
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
      </ModalForm>
    </Modal>
  );
}
