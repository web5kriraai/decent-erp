"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ModalAlert,
  ModalFooterActions,
  ModalForm,
  ModalSection,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import type { ChecklistItemMaster } from "@/hooks/use-masters";
import { TaskArtifactPanel, useTaskHasFiles } from "@/components/tasks/TaskArtifactPanel";
import { TaskMachineOutputPanel } from "@/components/tasks/TaskMachineOutputPanel";
import { isMachineOutputTask } from "@/lib/services/task-machine-output-utils";

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
  onSubmit: () => void;
  isPending: boolean;
};

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
  onSubmit,
  isPending,
}: TaskEndDialogProps) {
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) setIsUploading(false);
  }, [open]);

  const { hasFiles, isLoading: filesLoading } = useTaskHasFiles(
    taskId ?? "",
    designId ?? "",
    open && !!taskId && !!designId,
  );

  const showFileUpload = !!fileRequired && !!taskId && !!designId;
  const showMachineOutput = isMachineOutputTask(subProcessCode) && !!taskId;
  const fileWarning = showFileUpload && !hasFiles && !isUploading && !filesLoading;
  const filesBlocking = showFileUpload && (filesLoading || isUploading || !hasFiles);

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

  const formComplete =
    !!endRemark.trim() &&
    !nonePassed &&
    (allChecklistPassed || (isPartialChecklist && notesOk)) &&
    sampleOk &&
    !sampleApproveBlocked;

  const canSubmit = formComplete && !filesBlocking && !isPending;

  const completionDescription = showFileUpload
    ? `Choose a file to upload for ${subProcessName ?? "this sub-process"}, then complete the details below.`
    : checklistItems.length > 0
      ? "Mark every checklist item as passed, or pass some and add notes for the rest."
      : "Add your completion details and submit when ready.";

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

  return (
    <Modal
      open={open}
      title="Complete Task"
      description={completionDescription}
      onClose={onClose}
      size={showFileUpload ? "xl" : "lg"}
      footer={
        <ModalFooterActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending || isUploading}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={onSubmit}>
            {submitLabel()}
          </Button>
        </ModalFooterActions>
      }
    >
      <ModalForm className="pb-2">
        {showMachineOutput ? (
          <ModalSection
            title="Machine output"
            description="Record stitch count, format, and sample/wastage quantities before completing."
          >
            <TaskMachineOutputPanel
              taskId={taskId!}
              canEdit={canUpload && !isPending}
              compact
            />
          </ModalSection>
        ) : null}

        {showFileUpload && (
          <ModalSection
            title="Task Files"
            description={
              subProcessName
                ? `Supporting files for ${subProcessName}. Upload starts automatically when you choose a file.`
                : "Supporting files for this sub-process. Upload starts automatically when you choose a file."
            }
            action={
              hasFiles ? (
                <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  Uploaded
                </span>
              ) : isUploading ? (
                <span className="inline-flex shrink-0 items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Uploading…
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                  Required
                </span>
              )
            }
          >
            {fileWarning && (
              <ModalAlert variant="warning">
                Choose a file below — it uploads automatically. Submit unlocks once the upload
                completes.
              </ModalAlert>
            )}
            {isUploading && (
              <ModalAlert variant="info">
                Your file is uploading. Submit will be available in a moment.
              </ModalAlert>
            )}
            {filesLoading && !hasFiles && !isUploading ? (
              <p className="text-sm text-muted-foreground">Checking uploaded files…</p>
            ) : null}
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <TaskArtifactPanel
                taskId={taskId}
                designId={designId}
                canUpload={canUpload && !isPending}
                subProcessCode={subProcessCode}
                compact
                onUploadingChange={setIsUploading}
              />
            </div>
          </ModalSection>
        )}

        {!isSampleCheck && (
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
        )}

        {isSampleCheck && (
          <ModalSection title="Sample Check">
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
            {sampleApproveBlocked && (
              <p className="text-xs text-destructive" role="alert">
                Approve requires every checklist item to pass. Use Reject or Re-sample if items
                failed.
              </p>
            )}
          </ModalSection>
        )}

        <FormTextArea
          id="endRemark"
          label="Output Remark"
          required
          rows={3}
          value={endRemark}
          onChange={(e) => onEndRemarkChange(e.target.value)}
          placeholder="Describe work completed…"
          disabled={isPending || isUploading}
        />

        {checklistItems.length > 0 && (
          <ModalSection
            title="Quality Checklist"
            description="Check all items to complete normally. If only some pass, add notes for the rest."
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={markAllPassed}
                disabled={isPending || isUploading || allChecklistPassed}
              >
                Mark all passed
              </Button>
            }
          >
            <div className="grid gap-2">
              {checklistItems.map((item) => {
                const passed = !!checklistResults[item.id];
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                      passed
                        ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                        : "border-border bg-background hover:bg-muted/40",
                      (isPending || isUploading) && "pointer-events-none opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
                        passed
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-input bg-background",
                      )}
                      aria-hidden
                    >
                      {passed ? <CheckIcon className="size-3.5" /> : null}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={passed}
                      disabled={isPending || isUploading}
                      onChange={(e) => onChecklistChange(item.id, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{item.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {passed ? "Passed" : "Not yet confirmed"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {nonePassed && (
              <p className="text-xs text-destructive" role="alert">
                Mark at least one checklist item as passed, or mark all as passed to continue.
              </p>
            )}

            {isPartialChecklist && (
              <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <FormTextArea
                  id="checklistNote"
                  label="Notes for items that did not pass"
                  required
                  rows={3}
                  value={checklistNote}
                  onChange={(e) => onChecklistNoteChange(e.target.value)}
                  placeholder="Message / notes for your checker or team…"
                  disabled={isPending || isUploading}
                  hint={
                    pendingChecklist.length === 1
                      ? `Explain why “${pendingChecklist[0].name}” is not confirmed.`
                      : `Explain why these items are not confirmed: ${pendingChecklist
                          .map((i) => i.name)
                          .join(", ")}.`
                  }
                  error={
                    !checklistNote.trim()
                      ? "Notes are required when only some checklist items are passed."
                      : undefined
                  }
                  className="bg-background"
                />
              </div>
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
