"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
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

export function DesignCreateForm() {
  const router = useRouter();
  const createDesign = useCreateDesign();

  const [collectionName, setCollectionName] = useState("");
  const [styleName, setStyleName] = useState("");
  const [conceptNote, setConceptNote] = useState("");
  const [workType, setWorkType] = useState<WorkType | "">("");
  const [trendReference, setTrendReference] = useState("");
  const [celebrityReference, setCelebrityReference] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [productTypeId, setProductTypeId] = useState<number | "">("");
  const [seasonId, setSeasonId] = useState<number | "">("");
  const [componentTypeIds, setComponentTypeIds] = useState<number[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("AUTOMATIC");
  const [workflowPatternId, setWorkflowPatternId] = useState<number | "">("");
  const [manualTasks, setManualTasks] = useState<ManualTaskDraft[]>(() => [emptyManualTask(0)]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

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

  const validationErrors: Record<string, string> = {};
  if (!collectionName.trim()) validationErrors.collectionName = "Collection name is required";
  if (!productTypeId) validationErrors.productTypeId = "Product type is required";
  if (!seasonId) validationErrors.seasonId = "Season is required";
  if (assignmentMode === "AUTOMATIC" && !workflowPatternId) {
    validationErrors.workflowPatternId = "Workflow pattern is required";
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
        priority,
        componentTypeIds: componentTypeIds.length > 0 ? componentTypeIds : undefined,
        assignmentMode,
        workflowPatternId:
          assignmentMode === "AUTOMATIC" ? Number(workflowPatternId) : undefined,
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

  return (
    <div className="page-shell">
      <PageHeader
        title="Create Design Concept"
        subtitle="Design + tasks saved in one transaction - identity from your session"
        actions={
          <Link href={ROUTES.designs.list} className="btn btn-secondary">
            Cancel
          </Link>
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
        <form onSubmit={handleSubmit} className="card form-card">
          {createDesign.isError && createDesign.error instanceof ApiClientError && (
            <div style={{ marginBottom: "1rem" }}>
              <ErrorBanner
                message={createDesign.error.message}
                correlationId={createDesign.error.correlationId}
              />
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="collection">
                Collection Name *
              </label>
              <input
                id="collection"
                className="form-input"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="e.g. Royal Festive 2026"
              />
              {(validationErrors.collectionName || fieldErrors.collectionName) && (
                <span className="form-error">
                  {validationErrors.collectionName ?? fieldErrors.collectionName?.[0]}
                </span>
              )}
            </div>

            <div className="form-grid form-grid--2">
              <div className="form-group">
                <label className="form-label" htmlFor="styleName">
                  Style Name
                </label>
                <input
                  id="styleName"
                  className="form-input"
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  placeholder="e.g. Anarkali Set A"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="workType">
                  Work Type
                </label>
                <select
                  id="workType"
                  className="form-select"
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value as WorkType | "")}
                >
                  <option value="">Select work type…</option>
                  {WORK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="concept">
                Concept Note
              </label>
              <textarea
                id="concept"
                className="form-textarea"
                rows={3}
                value={conceptNote}
                onChange={(e) => setConceptNote(e.target.value)}
                placeholder="Premium zari + thread concept…"
              />
            </div>

            <div className="form-grid form-grid--2">
              <div className="form-group">
                <label className="form-label" htmlFor="trendReference">
                  Trend Reference
                </label>
                <input
                  id="trendReference"
                  className="form-input"
                  value={trendReference}
                  onChange={(e) => setTrendReference(e.target.value)}
                  placeholder="e.g. Minimal bridal, pastel tones"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="celebrityReference">
                  Celebrity Reference
                </label>
                <input
                  id="celebrityReference"
                  className="form-input"
                  value={celebrityReference}
                  onChange={(e) => setCelebrityReference(e.target.value)}
                  placeholder="e.g. Celebrity look from event X"
                />
              </div>
            </div>

            <div className="form-grid form-grid--2">
              <div className="form-group">
                <label className="form-label" htmlFor="productType">
                  Product Type *
                </label>
                <select
                  id="productType"
                  className="form-select"
                  value={productTypeId}
                  onChange={(e) => {
                    const next = e.target.value ? Number(e.target.value) : "";
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
                >
                  <option value="">Select type…</option>
                  {productTypes.data?.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
                {validationErrors.productTypeId && (
                  <span className="form-error">{validationErrors.productTypeId}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="season">
                  Season *
                </label>
                <select
                  id="season"
                  className="form-select"
                  value={seasonId}
                  onChange={(e) => setSeasonId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select season…</option>
                  {seasons.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {validationErrors.seasonId && (
                  <span className="form-error">{validationErrors.seasonId}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <span className="form-label">Component Types</span>
              {availableComponentTypes.length === 0 ? (
                <p className="form-hint">No component types available.</p>
              ) : (
                <div className="form-grid form-grid--checkboxes">
                  {availableComponentTypes.map((ct) => (
                    <label key={ct.id} className="form-checkbox-row" style={{ margin: 0 }}>
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

            <div
              className={
                assignmentMode === "AUTOMATIC"
                  ? "form-grid form-grid--3"
                  : "form-grid form-grid--2"
              }
            >
              <div className="form-group">
                <label className="form-label" htmlFor="priority">
                  Priority
                </label>
                <select
                  id="priority"
                  className="form-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="assignmentMode">
                  Task Assignment
                </label>
                <select
                  id="assignmentMode"
                  className="form-select"
                  value={assignmentMode}
                  onChange={(e) => setAssignmentMode(e.target.value as AssignmentMode)}
                >
                  <option value="AUTOMATIC">Automatic (workflow pattern)</option>
                  <option value="MANUAL">Manual (custom task list)</option>
                </select>
              </div>

              {assignmentMode === "AUTOMATIC" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="pattern">
                    Workflow Pattern *
                  </label>
                  <select
                    id="pattern"
                    className="form-select"
                    value={workflowPatternId}
                    onChange={(e) =>
                      setWorkflowPatternId(e.target.value ? Number(e.target.value) : "")
                    }
                  >
                    <option value="">Select pattern…</option>
                    {patterns.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (v{p.versionNo})
                      </option>
                    ))}
                  </select>
                  {(validationErrors.workflowPatternId || fieldErrors.workflowPatternId) && (
                    <span className="form-error">
                      {validationErrors.workflowPatternId ??
                        fieldErrors.workflowPatternId?.[0]}
                    </span>
                  )}
                </div>
              )}
            </div>

            {assignmentMode === "MANUAL" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span className="form-label">Manual Tasks *</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addManualTaskRow}
                  >
                    Add Task
                  </button>
                </div>

                {(validationErrors.manualTasks || fieldErrors.manualTasks) && (
                  <span className="form-error" style={{ display: "block", marginBottom: "0.5rem" }}>
                    {validationErrors.manualTasks ?? fieldErrors.manualTasks?.[0]}
                  </span>
                )}

                <div className="form-grid" style={{ gap: "0.75rem" }}>
                  {manualTasks.map((task, index) => {
                    const process = processList.find((p) => p.id === task.processId);
                    const subProcesses = process?.subProcesses ?? [];

                    return (
                      <div
                        key={task.id}
                        className="card"
                        style={{ padding: "0.75rem", display: "grid", gap: "0.75rem" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <strong>Task {index + 1}</strong>
                          <div style={{ display: "flex", gap: "0.25rem" }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={index === 0}
                              onClick={() => moveManualTask(task.id, "up")}
                              aria-label={`Move task ${index + 1} up`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={index === manualTasks.length - 1}
                              onClick={() => moveManualTask(task.id, "down")}
                              aria-label={`Move task ${index + 1} down`}
                            >
                              ↓
                            </button>
                            {manualTasks.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => removeManualTaskRow(task.id)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="form-grid form-grid--2" style={{ gap: "0.5rem" }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Process</label>
                            <select
                              className="form-select"
                              value={task.processId}
                              onChange={(e) =>
                                handleManualProcessChange(
                                  task,
                                  e.target.value ? Number(e.target.value) : "",
                                )
                              }
                            >
                              <option value="">Select process…</option>
                              {processList.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Sub-process</label>
                            <select
                              className="form-select"
                              value={task.subProcessId}
                              disabled={!task.processId}
                              onChange={(e) =>
                                updateManualTask(task.id, {
                                  subProcessId: e.target.value ? Number(e.target.value) : "",
                                })
                              }
                            >
                              <option value="">Select sub-process…</option>
                              {subProcesses.map((sp) => (
                                <option key={sp.id} value={sp.id}>
                                  {sp.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="form-grid form-grid--2" style={{ gap: "0.5rem" }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Expected Minutes</label>
                            <input
                              type="number"
                              min={1}
                              className="form-input"
                              value={task.expectedMinutes}
                              onChange={(e) =>
                                updateManualTask(task.id, { expectedMinutes: e.target.value })
                              }
                            />
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Assign To</label>
                            <select
                              className="form-select"
                              value={task.assignedEmployeeId}
                              onChange={(e) =>
                                updateManualTask(task.id, {
                                  assignedEmployeeId: e.target.value
                                    ? Number(e.target.value)
                                    : "",
                                })
                              }
                            >
                              <option value="">Auto by role</option>
                              {employees.data?.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} ({emp.employeeCode})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="form-hint">
              First task is auto-assigned to you as Design Head. Timer and KPI events are
              server-authoritative.
            </p>

            <div style={{ display: "flex", gap: "0.5rem", paddingTop: "0.5rem" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createDesign.isPending}
              >
                {createDesign.isPending ? "Creating…" : "Create & Generate Tasks"}
              </button>
              <Link href="/designs" className="btn btn-secondary">
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </QueryState>
    </div>
  );
}
