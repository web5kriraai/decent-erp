"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
  ModalSection,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { AppButton } from "@/components/ui/AppButton";
import { cn } from "@/lib/utils";
import { CheckIcon, Trash2Icon } from "lucide-react";
import type { ChecklistItemMaster } from "@/hooks/use-masters";
import { TaskArtifactPanel, useTaskHasFiles } from "@/components/tasks/TaskArtifactPanel";
import { TaskMachineOutputPanel } from "@/components/tasks/TaskMachineOutputPanel";
import { isMachineOutputTask } from "@/lib/services/task-machine-output-utils";
import { useDesignCosts } from "@/hooks/use-costing";
import type { CostType } from "@/lib/services/costing-end-utils";
import type { CostEntryInput } from "@/lib/services/costing-end-utils";
import {
  buildCostingOutputRemark,
  costingEndHasPositiveCosts,
  mergeCostAmountsByType,
  totalFromByType,
} from "@/lib/services/costing-end-utils";

export type { CostEntryInput };

type TaskEndDialogProps = {
  open: boolean;
  onClose: () => void;
  endStatus: "CHECKING" | "COMPLETED";
  onEndStatusChange: (status: "CHECKING" | "COMPLETED") => void;
  endRemark: string;
  onEndRemarkChange: (value: string) => void;
  checklistItems: ChecklistItemMaster[];
  checklistResults: Record<number, boolean>;
  onChecklistChange: (itemId: number, checked: boolean) => void;
  checklistNote: string;
  onChecklistNoteChange: (value: string) => void;
  fileRequired?: boolean;
  taskId?: string;
  designId?: string;
  subProcessCode?: string;
  subProcessName?: string;
  canUpload?: boolean;
  isSampleCheck?: boolean;
  sampleOutcome?: "APPROVE" | "REJECT" | "RESAMPLE";
  onSampleOutcomeChange?: (outcome: "APPROVE" | "REJECT" | "RESAMPLE") => void;
  /** When true, server will force CHECKING. */
  gateForcesChecking?: boolean;
  dialogTitle?: string;
  /** @deprecated Unused — kept for call-site compatibility. */
  dialogDescription?: string;
  costEntries?: CostEntryInput[];
  onCostEntriesChange?: (entries: CostEntryInput[]) => void;
  onSubmit: () => void;
  isPending: boolean;
};

const COST_TYPE_OPTIONS: Array<{ value: CostType; label: string }> = [
  { value: "TIME", label: "Time" },
  { value: "MATERIAL", label: "Material" },
  { value: "MACHINE", label: "Machine" },
  { value: "CORRECTION", label: "Correction Rework" },
];

export function TaskEndDialog({
  open,
  onClose,
  endStatus,
  onEndStatusChange,
  endRemark,
  onEndRemarkChange,
  checklistItems,
  checklistResults,
  onChecklistChange,
  checklistNote,
  onChecklistNoteChange,
  fileRequired,
  taskId,
  designId,
  subProcessCode,
  subProcessName,
  canUpload = true,
  isSampleCheck,
  sampleOutcome,
  onSampleOutcomeChange,
  gateForcesChecking,
  dialogTitle,
  dialogDescription: _dialogDescription,
  costEntries = [],
  onCostEntriesChange,
  onSubmit,
  isPending,
}: TaskEndDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [draftCostType, setDraftCostType] = useState<CostType>("TIME");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [costingNote, setCostingNote] = useState("");

  const isCosting = subProcessCode === "COSTING";
  const costsQuery = useDesignCosts(designId ?? "", open && isCosting && !!designId);
  const existingSummary = costsQuery.data?.summary;
  const existingCosts = costsQuery.data?.costs ?? [];

  function handleClose() {
    setIsUploading(false);
    setDraftAmount("");
    setDraftDescription("");
    setDraftCostType("TIME");
    setCostingNote("");
    onClose();
  }

  const { hasFiles, isLoading: filesLoading } = useTaskHasFiles(
    taskId ?? "",
    designId ?? "",
    open && !!taskId && !!designId,
  );

  const showFileUpload = !!fileRequired && !!taskId && !!designId;
  const showMachineOutput = isMachineOutputTask(subProcessCode) && !!taskId;
  const filesBlocking = showFileUpload && (filesLoading || isUploading || !hasFiles);
  const denseDeliverables = showFileUpload && showMachineOutput;
  const forcesChecking =
    gateForcesChecking ??
    ["SKETCH", "PUNCH", "MACHINE_SAMPLE", "SAMPLE_RECEIVE", "COSTING"].includes(
      subProcessCode ?? "",
    );

  const mergedByType = useMemo(
    () => mergeCostAmountsByType(existingSummary?.byType ?? {}, costEntries),
    [existingSummary?.byType, costEntries],
  );
  const mergedTotal = useMemo(() => totalFromByType(mergedByType), [mergedByType]);
  const costingOk = costingEndHasPositiveCosts(!!existingSummary?.hasCosting, costEntries);

  useEffect(() => {
    if (!open || !isCosting) return;
    onEndRemarkChange(buildCostingOutputRemark(mergedByType, mergedTotal, costingNote));
  }, [open, isCosting, mergedByType, mergedTotal, costingNote, onEndRemarkChange]);

  useEffect(() => {
    if (!open) {
      setCostingNote("");
      setDraftAmount("");
      setDraftDescription("");
      setDraftCostType("TIME");
    }
  }, [open]);

  const { pendingChecklist, passedCount, allChecklistPassed, isPartialChecklist } = useMemo(() => {
    const pending = checklistItems.filter((item) => !checklistResults[item.id]);
    const passed = checklistItems.length - pending.length;
    return {
      pendingChecklist: pending,
      passedCount: passed,
      allChecklistPassed: pending.length === 0,
      isPartialChecklist: checklistItems.length > 0 && pending.length > 0 && passed > 0,
    };
  }, [checklistItems, checklistResults]);

  const nonePassed = checklistItems.length > 0 && passedCount === 0;
  const notesRequired = isPartialChecklist;
  const notesOk = !notesRequired || !!checklistNote.trim();
  const sampleOk = !isSampleCheck || !!sampleOutcome;
  const sampleApproveBlocked =
    !!isSampleCheck && sampleOutcome === "APPROVE" && !allChecklistPassed && checklistItems.length > 0;

  const remarkOk = isCosting ? costingOk && !!endRemark.trim() : !!endRemark.trim();
  const costingLoading = isCosting && costsQuery.isLoading;
  const formComplete =
    remarkOk &&
    !nonePassed &&
    (allChecklistPassed || (isPartialChecklist && notesOk)) &&
    sampleOk &&
    !sampleApproveBlocked &&
    (!isCosting || costingOk) &&
    !costingLoading;

  const canSubmit = formComplete && !filesBlocking && !isPending;

  function markAllPassed() {
    for (const item of checklistItems) {
      if (!checklistResults[item.id]) onChecklistChange(item.id, true);
    }
  }

  function submitLabel() {
    if (isPending) return "Submitting…";
    if (isUploading) return "Waiting for upload…";
    if (isPartialChecklist) return "Submit with notes";
    return "Submit Completion";
  }

  function addDraftCostLine() {
    const amount = Number(draftAmount);
    if (!(amount > 0) || !onCostEntriesChange) return;
    onCostEntriesChange([
      ...costEntries,
      {
        costType: draftCostType,
        description: draftDescription.trim() || undefined,
        amount,
      },
    ]);
    setDraftAmount("");
    setDraftDescription("");
  }

  function removeDraftCostLine(index: number) {
    if (!onCostEntriesChange) return;
    onCostEntriesChange(costEntries.filter((_, i) => i !== index));
  }

  return (
    <Modal
      open={open}
      title={dialogTitle ?? (isSampleCheck ? "Complete Sample Check" : "Complete Task")}
      onClose={handleClose}
      size={denseDeliverables || isCosting ? "lg" : "md"}
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={handleClose} disabled={isPending || isUploading}>
            Cancel
          </AppButton>
          <AppButton type="button" disabled={!canSubmit} onClick={onSubmit}>
            {submitLabel()}
          </AppButton>
        </ModalFooterActions>
      }
    >
      <ModalForm className="gap-3 pb-1">
        {(showMachineOutput || showFileUpload) && (
          <ModalSection title="Deliverables">
            <div
              className={cn(
                "grid gap-3",
                denseDeliverables && "sm:grid-cols-2 sm:items-start",
              )}
            >
              {showMachineOutput ? (
                <TaskMachineOutputPanel
                  taskId={taskId!}
                  canEdit={canUpload && !isPending}
                  compact
                />
              ) : null}
              {showFileUpload ? (
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">Task files</p>
                    {hasFiles ? (
                      <span className="text-xs font-medium text-emerald-700">Uploaded</span>
                    ) : isUploading ? (
                      <span className="text-xs font-medium text-primary">Uploading…</span>
                    ) : (
                      <span className="text-xs font-medium text-amber-800">Required</span>
                    )}
                  </div>
                  <TaskArtifactPanel
                    taskId={taskId}
                    designId={designId}
                    canUpload={canUpload && !isPending}
                    subProcessCode={subProcessCode}
                    compact
                    onUploadingChange={setIsUploading}
                  />
                </div>
              ) : null}
            </div>
          </ModalSection>
        )}

        {isCosting ? (
          <ModalSection title="Development costs">
            {costsQuery.isError ? (
              <p className="text-xs text-destructive" role="alert">
                Could not load existing costs. You can still add new lines below.
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Total (incl. draft)</p>
                <p className="text-sm font-semibold tabular-nums">₹{mergedTotal.toFixed(2)}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Saved entries</p>
                <p className="text-sm font-semibold tabular-nums">{existingSummary?.entryCount ?? 0}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Margin vs estimate</p>
                <p className="text-sm font-semibold tabular-nums">
                  {existingSummary?.estimatedCost != null
                    ? `₹${(existingSummary.estimatedCost - mergedTotal).toFixed(2)}`
                    : "—"}
                </p>
              </div>
            </div>

            {existingCosts.length > 0 ? (
              <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {existingCosts.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2 border-b border-border/60 py-1">
                    <span>
                      {c.costType}
                      {c.description ? ` · ${c.description}` : ""}
                    </span>
                    <span className="shrink-0 tabular-nums">₹{Number(c.amount).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {costEntries.length > 0 ? (
              <ul className="space-y-1">
                {costEntries.map((entry, index) => (
                  <li
                    key={`draft-${index}-${entry.costType}-${entry.amount}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{entry.costType}</span>
                      {entry.description ? ` · ${entry.description}` : ""}
                      <span className="ml-2 tabular-nums">₹{entry.amount.toFixed(2)}</span>
                    </span>
                    <AppButton
                      type="button"
                      appVariant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0"
                      onClick={() => removeDraftCostLine(index)}
                      disabled={isPending}
                      aria-label="Remove draft cost line"
                    >
                      <Trash2Icon className="size-3.5" />
                    </AppButton>
                  </li>
                ))}
              </ul>
            ) : null}

            <ModalFormGrid className="gap-3 sm:grid-cols-2">
              <FormSelect
                id="draftCostType"
                label="Cost type"
                value={draftCostType}
                onValueChange={(v) => setDraftCostType(v as CostType)}
                options={COST_TYPE_OPTIONS}
                disabled={isPending}
              />
              <div className="form-group">
                <label className="form-label" htmlFor="draftCostAmount">
                  Amount (₹) *
                </label>
                <input
                  id="draftCostAmount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  className="form-input"
                  value={draftAmount}
                  onChange={(e) => setDraftAmount(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </ModalFormGrid>
            <div className="form-group">
              <label className="form-label" htmlFor="draftCostDesc">
                Description
              </label>
              <input
                id="draftCostDesc"
                type="text"
                className="form-input"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Optional detail…"
                disabled={isPending}
              />
            </div>
            <AppButton
              type="button"
              appVariant="outline"
              size="sm"
              onClick={addDraftCostLine}
              disabled={isPending || !(Number(draftAmount) > 0)}
            >
              Add cost line
            </AppButton>

            {!costingOk && !costingLoading ? (
              <p className="text-xs text-destructive" role="alert">
                Add at least one cost line (or ensure costs already exist on Finance → Costing).
              </p>
            ) : null}

            <FormTextArea
              id="costingNote"
              label="Additional note"
              rows={2}
              value={costingNote}
              onChange={(e) => setCostingNote(e.target.value)}
              placeholder="Optional note for checkers…"
              disabled={isPending}
            />
          </ModalSection>
        ) : null}

        {isSampleCheck ? (
          <FormSelect
            id="sampleOutcome"
            label="Sample Check Decision"
            required
            value={sampleOutcome ?? ""}
            onValueChange={(v) =>
              onSampleOutcomeChange?.(v as "APPROVE" | "REJECT" | "RESAMPLE")
            }
            options={[
              { value: "APPROVE", label: "Approve sample" },
              { value: "REJECT", label: "Reject (correction required)" },
              { value: "RESAMPLE", label: "Send for re-sample" },
            ]}
            placeholder="Select outcome…"
            disabled={isPending || isUploading}
          />
        ) : null}

        {!isSampleCheck && !isCosting && !forcesChecking ? (
          <ModalFormGrid className="gap-3">
            <FormSelect
              id="endStatus"
              label="Completion Status"
              required
              value={endStatus}
              onValueChange={(v) => onEndStatusChange(v as "CHECKING" | "COMPLETED")}
              options={[
                { value: "CHECKING", label: "Send for Checking" },
                { value: "COMPLETED", label: "Mark Completed" },
              ]}
              disabled={isPending || isUploading}
            />
            <FormTextArea
              id="endRemark"
              label="Output Remark"
              required
              rows={2}
              value={endRemark}
              onChange={(e) => onEndRemarkChange(e.target.value)}
              placeholder="Describe work completed…"
              disabled={isPending || isUploading}
            />
          </ModalFormGrid>
        ) : !isCosting ? (
          <FormTextArea
            id="endRemark"
            label="Output Remark"
            required
            rows={2}
            value={endRemark}
            onChange={(e) => onEndRemarkChange(e.target.value)}
            placeholder={isSampleCheck ? "Add review notes…" : "Describe work completed…"}
            disabled={isPending || isUploading}
          />
        ) : null}

        {checklistItems.length > 0 && (
          <ModalSection
            title="Quality Checklist"
            action={
              <AppButton
                type="button"
                appVariant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={markAllPassed}
                disabled={isPending || isUploading || allChecklistPassed}
              >
                Mark all passed
              </AppButton>
            }
          >
            <div className="grid gap-1.5">
              {checklistItems.map((item) => {
                const passed = !!checklistResults[item.id];
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                      passed
                        ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                        : "border-border bg-background hover:bg-muted/40",
                      (isPending || isUploading) && "pointer-events-none opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        passed
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-input bg-background",
                      )}
                      aria-hidden
                    >
                      {passed ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={passed}
                      disabled={isPending || isUploading}
                      onChange={(e) => onChecklistChange(item.id, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1 font-medium text-foreground">{item.name}</span>
                  </label>
                );
              })}
            </div>

            {nonePassed && (
              <p className="text-xs text-destructive" role="alert">
                Mark at least one checklist item as passed to continue.
              </p>
            )}

            {isPartialChecklist && (
              <FormTextArea
                id="checklistNote"
                label="Notes for items that did not pass"
                required
                rows={2}
                value={checklistNote}
                onChange={(e) => onChecklistNoteChange(e.target.value)}
                placeholder="Message for your checker or team…"
                disabled={isPending || isUploading}
                error={
                  !checklistNote.trim()
                    ? "Required"
                    : undefined
                }
              />
            )}
          </ModalSection>
        )}

        {!canSubmit && formComplete && filesBlocking && !isPending && (
          <p className="text-xs text-muted-foreground" role="status">
            {isUploading
              ? "Finish uploading your file to enable submit."
              : "Upload at least one file to enable submit."}
          </p>
        )}
      </ModalForm>
    </Modal>
  );
}
