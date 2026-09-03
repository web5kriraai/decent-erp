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
import { useCreateDesign } from "@/hooks/use-designs";
import {
  useComponentTypes,
  useMasterEmployees,
  useProcessMasters,
  useProductTypes,
  useSeasons,
  useWorkflowPatterns,
} from "@/hooks/use-masters";
import { getFieldErrors, ApiClientError } from "@/lib/api-client";
import type { Priority, WorkType } from "@/lib/types/api";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { sessionPermissionsStaleHint } from "@/lib/user-messages";
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
  { value: "AUTOMATIC", label: "Automatic (workflow pattern)" },
  { value: "MANUAL", label: "Manual (custom task list)" },
];

export function DesignCreateForm() {
  const router = useRouter();
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
  const [targetGrade, setTargetGrade] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [productTypeId, setProductTypeId] = useState<number | "">("");
  const [seasonId, setSeasonId] = useState<number | "">("");
  const [componentTypeIds, setComponentTypeIds] = useState<number[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("AUTOMATIC");
  const [workflowPatternId, setWorkflowPatternId] = useState<number | "">("");
  const [manualTasks, setManualTasks] = useState<ManualTaskDraft[]>(() => [emptyManualTask(0)]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const productTypes = useProductTypes();
  const seasons = useSeasons();
  const patterns = useWorkflowPatterns();
  const componentTypes = useComponentTypes();
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
  if (assignmentMode === "AUTOMATIC" && !effectiveWorkflowPatternId) {
    validationErrors.workflowPatternId =
      availablePatterns.length === 0
        ? "No workflow pattern for this product type — switch to Manual or ask Admin to create one"
        : "Workflow pattern is required";
  }
  if (assignmentMode === "MANUAL") {
    const incomplete = manualTasks.some(
      (task) =>
        !task.processId ||
        !task.subProcessId ||
        !Number(task.expectedMinutes) ||
        Number(task.expectedMinutes) <= 0,
    );
    if (manualTasks.length === 0 || incomplete) {
      validationErrors.manualTasks = "Add at least one complete task (process, sub-process, minutes)";
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
        trendReference: trendReference.trim() || undefined,
        celebrityReference: celebrityReference.trim() || undefined,
        targetGrade: targetGrade.trim() || undefined,
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
        priority,
        componentTypeIds: componentTypeIds.length > 0 ? componentTypeIds : undefined,
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
      router.push(`${ROUTES.designs.detail(design.id)}?setup=images`);
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
        <PageHeader title="Create Design Concept" subtitle="Start a new collection in the design pipeline" />
        <PermissionDenied permission={PERMISSIONS.DESIGN_CREATE} />
        <p className="form-hint mt-4">
          {sessionPermissionsStaleHint()}
        </p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Create Design Concept"
        subtitle="Add collection details, pick a workflow, and we'll set you as the design head"
        actions={
          <AppButtonLink href={ROUTES.designs.list} appVariant="secondary">
            Cancel
          </AppButtonLink>
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
        <form onSubmit={handleSubmit} className="form-card space-y-4">
          {createDesign.isError && createDesign.error instanceof ApiClientError && (
            <div className="stack-section">
              <ErrorBanner
                message={createDesign.error.message}
                correlationId={createDesign.error.correlationId}
              />
            </div>
          )}

          <div className="form-layout form-layout--split">
          <AppCard title="Basics" description="Collection identity and concept references">
            <div className="form-grid">
              <FormTextField
                id="collection"
                label="Collection Name"
                required
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="e.g. Royal Festive 2026"
                error={
                  showErrors
                    ? (validationErrors.collectionName ?? fieldErrors.collectionName?.[0])
                    : undefined
                }
              />

              <div className="form-grid form-grid--2">
                <FormTextField
                  id="styleName"
                  label="Style Name"
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  placeholder="e.g. Anarkali Set A"
                />
                <FormTextField
                  id="targetGrade"
                  label="Target Grade"
                  value={targetGrade}
                  onChange={(e) => setTargetGrade(e.target.value)}
                  placeholder="e.g. Premium / A / Bridal"
                />
              </div>

              <div className="form-grid form-grid--2">
                <FormSelect
                  id="workType"
                  label="Work Type"
                  value={workType || null}
                  onValueChange={(v) => setWorkType(v as WorkType)}
                  options={WORK_TYPE_OPTIONS}
                  placeholder="Select work type…"
                />
                <FormTextField
                  id="estimatedCost"
                  label="Estimated Cost (₹)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="Optional estimate for margin"
                />
              </div>

              <FormTextArea
                id="concept"
                label="Concept Note"
                rows={3}
                value={conceptNote}
                onChange={(e) => setConceptNote(e.target.value)}
                placeholder="Premium zari + thread concept…"
              />

              <div className="form-grid form-grid--2">
                <FormTextField
                  id="trendReference"
                  label="Trend Reference"
                  value={trendReference}
                  onChange={(e) => setTrendReference(e.target.value)}
                  placeholder="e.g. Minimal bridal, pastel tones"
                />
                <FormTextField
                  id="celebrityReference"
                  label="Celebrity Reference"
                  value={celebrityReference}
                  onChange={(e) => setCelebrityReference(e.target.value)}
                  placeholder="e.g. Celebrity look from event X"
                />
              </div>
            </div>
          </AppCard>

          <AppCard title="Product" description="Product type, season, and components">
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
                  placeholder="Select type…"
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
                  placeholder="Select season…"
                  error={showErrors ? validationErrors.seasonId : undefined}
                />
              </div>

              <div className="form-group space-y-2">
                <span className="form-label text-sm font-medium">Component Types</span>
                {availableComponentTypes.length === 0 ? (
                  <p className="form-hint text-xs text-muted-foreground">
                    No component types available.
                  </p>
                ) : (
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
                )}
              </div>
            </div>
          </AppCard>

          <div className="form-layout-span">
          <AppCard title="Assignment" description="Priority and how tasks are generated">
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
                  value={priority}
                  onValueChange={(v) => setPriority(v as Priority)}
                  options={PRIORITY_OPTIONS}
                />
                <FormSelect
                  id="assignmentMode"
                  label="Task Assignment"
                  value={assignmentMode}
                  onValueChange={(v) => setAssignmentMode(v as AssignmentMode)}
                  options={ASSIGNMENT_MODE_OPTIONS}
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
                    placeholder={
                      availablePatterns.length === 0
                        ? "No pattern for this product type"
                        : "Select pattern…"
                    }
                    disabled={availablePatterns.length === 0}
                    hint={
                      availablePatterns.length === 0
                        ? "Switch Task Assignment to Manual, or ask Admin to create a pattern for this product type."
                        : "Spec 8-Step (Concept→Final) is fine — production handoff/instruction/release are added automatically after management approval. Full pattern already includes the production ladder."
                    }
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
                    <span className="form-label text-sm font-medium">Manual Tasks *</span>
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
                              placeholder="Select process…"
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
                              placeholder="Select sub-process…"
                              disabled={!task.processId}
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
                              placeholder="Auto by role"
                            />
                          </div>
                        </AppCard>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="form-hint text-xs text-muted-foreground">
                First task is auto-assigned to you as Design Head. Timer and KPI events are
                server-authoritative.
              </p>

              <div className="form-actions">
                <AppButton type="submit" appVariant="primary" disabled={createDesign.isPending}>
                  {createDesign.isPending ? "Creating…" : "Create & Generate Tasks"}
                </AppButton>
                <AppButtonLink href={ROUTES.designs.list} appVariant="secondary">
                  Cancel
                </AppButtonLink>
              </div>
            </div>
          </AppCard>
          </div>
          </div>
        </form>
      </QueryState>
    </div>
  );
}
