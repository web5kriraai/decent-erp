"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import type { ChecklistItemMaster } from "@/hooks/use-masters";

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
  hasUploadedFiles?: boolean;
  filesLoading?: boolean;
  /** When set, file-required warning links here (e.g. task detail upload section). */
  uploadHref?: string;
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
  hasUploadedFiles,
  filesLoading,
  uploadHref,
  onSubmit,
  isPending,
}: TaskEndDialogProps) {
  const fileWarning = !!fileRequired && !hasUploadedFiles;
  const filesBlocking = fileWarning || (!!fileRequired && !!filesLoading);

  const { pendingChecklist, passedCount, allChecklistPassed, isPartialChecklist } = useMemo(() => {
    const pending = checklistItems.filter((item) => !checklistResults[item.id]);
    const passed = checklistItems.length - pending.length;
    return {
      pendingChecklist: pending,
      passedCount: passed,
      allChecklistPassed: pending.length === 0,
      // At least one passed and at least one not → notes path
      isPartialChecklist: checklistItems.length > 0 && pending.length > 0 && passed > 0,
    };
  }, [checklistItems, checklistResults]);

  const nonePassed = checklistItems.length > 0 && passedCount === 0;
  const notesRequired = isPartialChecklist;
  const notesOk = !notesRequired || !!checklistNote.trim();

  const canSubmit =
    !!endRemark.trim() &&
    !nonePassed &&
    (allChecklistPassed || (isPartialChecklist && notesOk)) &&
    !filesBlocking &&
    !isPending;

  function markAllPassed() {
    for (const item of checklistItems) {
      if (!checklistResults[item.id]) onChecklistChange(item.id, true);
    }
  }

  return (
    <Modal
      open={open}
      title="Complete Task"
      description="Mark every checklist item as passed, or pass some and add notes for the rest."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={onSubmit}>
            {isPending
              ? "Submitting…"
              : isPartialChecklist
                ? "Submit with notes"
                : "Submit Completion"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {fileWarning && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="alert"
          >
            This sub-process requires at least one uploaded file before completion.
            {uploadHref ? (
              <>
                {" "}
                <Link href={uploadHref} className="font-medium underline underline-offset-2">
                  Upload a file on the task detail page
                </Link>
                , then open Complete Task again.
              </>
            ) : (
              <> Upload a file in the Task Files section below, then try again.</>
            )}
          </div>
        )}
        {!!fileRequired && !!filesLoading && !hasUploadedFiles && (
          <p className="text-sm text-muted-foreground">Checking uploaded files…</p>
        )}

        <FormSelect
          id="endStatus"
          label="Completion Status"
          value={endStatus}
          onValueChange={(v) => onEndStatusChange(v as "CHECKING" | "COMPLETED")}
          options={[
            { value: "CHECKING", label: "Send for Checking" },
            { value: "COMPLETED", label: "Mark Completed" },
          ]}
          disabled={isPending}
        />

        <div className="space-y-2">
          <Label htmlFor="endRemark">
            Output Remark <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="endRemark"
            rows={3}
            value={endRemark}
            onChange={(e) => onEndRemarkChange(e.target.value)}
            placeholder="Describe work completed…"
            disabled={isPending}
            className="resize-none"
          />
        </div>

        {checklistItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>
                Quality Checklist <span className="text-destructive">*</span>
              </Label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                onClick={markAllPassed}
                disabled={isPending || allChecklistPassed}
              >
                Mark all as passed
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Check all items to complete normally. If only some pass, add notes for the items that
              did not.
            </p>
            <div className="grid gap-2">
              {checklistItems.map((item) => {
                const passed = !!checklistResults[item.id];
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                      passed
                        ? "border-emerald-200 bg-emerald-50/80"
                        : "border-border bg-background hover:bg-muted/40",
                      isPending && "pointer-events-none opacity-60",
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
                      disabled={isPending}
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
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <Label htmlFor="checklistNote">
                  Notes for items that did not pass <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {pendingChecklist.length === 1
                    ? `Explain why “${pendingChecklist[0].name}” is not confirmed.`
                    : `Explain why these items are not confirmed: ${pendingChecklist
                        .map((i) => i.name)
                        .join(", ")}.`}
                </p>
                <Textarea
                  id="checklistNote"
                  rows={3}
                  value={checklistNote}
                  onChange={(e) => onChecklistNoteChange(e.target.value)}
                  placeholder="Message / notes for your checker or team…"
                  disabled={isPending}
                  className="resize-none bg-background"
                />
                {!checklistNote.trim() && (
                  <p className="text-xs text-destructive" role="alert">
                    Notes are required when only some checklist items are passed.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
