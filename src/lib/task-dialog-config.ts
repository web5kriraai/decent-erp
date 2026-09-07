import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";

export type TaskDialogTask = {
  status: string;
  subProcess: {
    code: string;
    name: string;
    isApproval?: boolean;
    isFileRequired?: boolean;
    capabilities?: unknown;
  };
  design?: {
    ideaRef?: string;
    collectionName?: string;
    productType?: string | null;
    priority?: string;
  };
  assignedEmployee?: { name?: string | null } | null;
};

export type HoldDialogConfig = {
  title: string;
  description: string;
  preferredHoldReasonCodes: string[];
  remarkLabel: string;
  remarkPlaceholder: string;
  nextStepHint: string;
};

export type EndDialogConfig = {
  title: string;
  description: string;
  mode: "sample_check" | "execute_checking" | "execute_complete" | "stage_approval" | "machine";
  forceChecking: boolean;
  showStatusSelect: boolean;
  showSampleOutcomes: boolean;
  showMachineMetrics: boolean;
  fileRequired: boolean;
  /** True when stage capability costingEntry is set (not code === COSTING). */
  costingEntry: boolean;
  remarkLabel: string;
  remarkPlaceholder: string;
  nextStepHint: string;
  /** Which prior-context slots the UI should emphasize */
  priorContextSlots: Array<"files" | "remark" | "machine" | "sample" | "costing" | "concept">;
};

function ideaPrefix(idea?: string) {
  return idea ? `${idea} · ` : "";
}

export function getTaskHoldDialogConfig(task: TaskDialogTask): HoldDialogConfig {
  const stage = task.subProcess.name;
  const idea = task.design?.ideaRef;
  const behavior = resolveStageBehavior({
    code: task.subProcess.code,
    name: task.subProcess.name,
    isApproval: task.subProcess.isApproval,
    isFileRequired: task.subProcess.isFileRequired,
    capabilities: task.subProcess.capabilities,
  });

  const preferredHoldReasonCodes = behavior.isApproval
    ? ["WAIT_APPROVAL", "MEETING", "OTHER_WORK", "LUNCH", "TEA"]
    : behavior.machineOutput || behavior.sampleDecisionOutcomes
      ? ["WAIT_MATERIAL", "MACHINE_NA", "OTHER_WORK", "LUNCH", "TEA", "MEETING"]
      : ["OTHER_WORK", "LUNCH", "TEA", "MEETING", "WAIT_APPROVAL", "WAIT_MATERIAL"];

  return {
    title: `Hold ${stage}`,
    description: idea
      ? `Pause active work on ${idea} · ${stage}. Hold time is excluded from KPI active work.`
      : `Pause active work on ${stage}. Hold time is excluded from KPI active work.`,
    preferredHoldReasonCodes,
    remarkLabel: "Hold note",
    remarkPlaceholder: "Optional — what are you waiting on, or why pause now?",
    nextStepHint: "Same assignee resumes this stage when ready",
  };
}

/** Optional textile-specific copy overlays (UX from handoff plan — not behavior switches). */
const TEXTILE_END_COPY: Partial<
  Record<
    string,
    Partial<
      Pick<
        EndDialogConfig,
        | "title"
        | "description"
        | "remarkLabel"
        | "remarkPlaceholder"
        | "nextStepHint"
        | "priorContextSlots"
      >
    >
  >
> = {
  SAMPLE_CHECK: {
    title: "Complete Sample Check",
    description: "Record checklist results and approve, reject, or re-sample.",
    remarkLabel: "Review notes for next stage",
    remarkPlaceholder: "What should Costing / Design Head know about this sample?",
    nextStepHint: "Approve → Costing · Reject → correction · Re-sample → Machine Operator",
    priorContextSlots: ["machine", "files", "remark"],
  },
  COSTING: {
    description: "Enter development costs (time, material, machine, correction), then send for checking.",
    remarkLabel: "Costing summary for Final Approval",
    remarkPlaceholder: "Auto-filled from cost lines — add an optional note for Design Head",
    nextStepHint: "Sends to Final Approval (Design Head)",
    priorContextSlots: ["sample", "costing"],
  },
  SKETCH: {
    description: "Upload sketch output and send for Design Head sketch approval.",
    remarkLabel: "Sketch output note",
    remarkPlaceholder: "Technique, motifs, risks — for Design Head sketch approval",
    nextStepHint: "Sends to Sketch Approval (Design Head)",
    priorContextSlots: ["concept"],
  },
  PUNCH: {
    description: "Upload punch / Wilcom output and send for punching check.",
    remarkLabel: "Punch output note",
    remarkPlaceholder: "Formats, stitch density, thread notes — for Sample Checker",
    nextStepHint: "Sends to Punching Checking (Sample Checker)",
    priorContextSlots: ["files", "remark"],
  },
  SAMPLE_RECEIVE: {
    description: "Confirm sample received and send for checking.",
    remarkLabel: "Receive note",
    remarkPlaceholder: "Condition on receipt, shortages, damage…",
    nextStepHint: "Sends toward Sample Checking",
    priorContextSlots: ["machine", "files"],
  },
  PROD_RELEASE: {
    description: "Finish production release to unlock Live Design Review and ERP sync.",
    remarkLabel: "Release confirmation note",
    remarkPlaceholder: "Confirm floor readiness / special instructions for Live Review",
    nextStepHint: "Unlocks Live Design Review (Management) and ERP chain",
    priorContextSlots: ["remark", "files"],
  },
  PROD_HANDOFF: {
    description: "Hand the approved design to Production Head.",
    remarkLabel: "Handoff note for Production",
    remarkPlaceholder: "Priorities, risks, instruction hints for Production Head",
    nextStepHint: "Production Head accepts handoff → Production Instruction",
    priorContextSlots: ["costing", "files", "remark"],
  },
  PROD_INSTRUCTION: {
    description: "Record production instructions before release.",
    remarkLabel: "Production instruction",
    remarkPlaceholder: "Cutting / embroidery / finishing instructions for release",
    nextStepHint: "Next: Production Release",
    priorContextSlots: ["remark", "files"],
  },
  MAT_REQ: {
    description: "Confirm materials / fabric so machine sample can proceed.",
    remarkLabel: "Material note",
    remarkPlaceholder: "Fabric / trim details for Machine Operator",
    nextStepHint: "Next: Fabric Issue (Production Head)",
    priorContextSlots: ["files", "remark"],
  },
  FABRIC_ISSUE: {
    description: "Confirm materials / fabric so machine sample can proceed.",
    remarkLabel: "Material note",
    remarkPlaceholder: "Fabric / trim details for Machine Operator",
    nextStepHint: "Next: Machine Sample (Machine Operator)",
    priorContextSlots: ["files", "remark"],
  },
  MACHINE_SAMPLE: {
    description: "Capture machine output / wastage and required files before ending.",
    remarkLabel: "Sample / machine notes",
    remarkPlaceholder: "Stitch issues, wastage notes, fabric condition — for Sample Checker",
    nextStepHint: "Sends to Sample Checking (Sample Checker)",
    priorContextSlots: ["files", "remark"],
  },
};

export function getTaskEndDialogConfig(
  task: TaskDialogTask,
  _roleCode?: string | null,
): EndDialogConfig {
  const code = task.subProcess.code;
  const stage = task.subProcess.name;
  const idea = task.design?.ideaRef;
  const prefix = ideaPrefix(idea);
  const behavior = resolveStageBehavior({
    code,
    name: stage,
    isApproval: task.subProcess.isApproval,
    isFileRequired: task.subProcess.isFileRequired,
    capabilities: task.subProcess.capabilities,
  });

  const mode = behavior.endDialogMode;
  const forceChecking =
    behavior.forcesChecking || mode === "execute_checking" || mode === "machine";
  const fileRequired = behavior.requiresFile || !!task.subProcess.isFileRequired;
  const showSampleOutcomes = behavior.sampleDecisionOutcomes;
  const showMachineMetrics = behavior.machineOutput;
  const showStatusSelect =
    !forceChecking &&
    !behavior.completeNotChecking &&
    !behavior.isApproval &&
    !behavior.costingEntry &&
    mode === "execute_complete";

  const base: EndDialogConfig = {
    title: `Complete ${stage}`,
    description: `${prefix}Add completion remark and finish this stage.`,
    mode,
    forceChecking: forceChecking && !behavior.completeNotChecking,
    showStatusSelect:
      mode === "execute_complete" && !behavior.completeNotChecking
        ? showStatusSelect || true
        : false,
    showSampleOutcomes,
    showMachineMetrics,
    fileRequired: showMachineMetrics ? fileRequired || true : fileRequired,
    costingEntry: behavior.costingEntry,
    remarkLabel: "Output Remark",
    remarkPlaceholder: "Describe work completed…",
    nextStepHint: behavior.isApproval
      ? "Use Approve / Request correction / Reject on the stage panel"
      : forceChecking && !behavior.completeNotChecking
        ? "Sends for checking on the next gate"
        : "Advances the workflow to the next stage",
    priorContextSlots: behavior.costingEntry
      ? ["sample", "costing"]
      : behavior.machineOutput
        ? ["files", "remark"]
        : ["remark", "files"],
  };

  if (mode === "stage_approval") {
    base.description = `${prefix}Use the stage approval controls for this review — do not treat this as normal execute completion.`;
    base.showStatusSelect = false;
    base.forceChecking = false;
    base.fileRequired = false;
  }

  if (mode === "sample_check") {
    base.title = "Complete Sample Check";
    base.showStatusSelect = false;
    base.forceChecking = false;
  }

  if (behavior.completeNotChecking) {
    base.forceChecking = false;
    base.showStatusSelect = false;
  }

  if (behavior.costingEntry) {
    base.forceChecking = true;
    base.showStatusSelect = false;
  }

  // MAT_REQ / FABRIC_ISSUE style: complete with status select
  if (!behavior.forcesChecking && !behavior.completeNotChecking && !behavior.isApproval && !behavior.machineOutput && !behavior.costingEntry) {
    if (code === "MAT_REQ" || code === "FABRIC_ISSUE") {
      base.showStatusSelect = true;
      base.mode = "execute_complete";
    }
  }

  const overlay = TEXTILE_END_COPY[code];
  if (overlay) {
    return {
      ...base,
      ...overlay,
      description: overlay.description
        ? `${prefix}${overlay.description.replace(/^\s*/, "")}`
        : base.description,
      title: overlay.title ?? base.title,
    };
  }

  return base;
}

/** Build a handoff context blob from task + end/hold config. */
export function buildHandoffContextFromTask(
  task: TaskDialogTask,
  opts?: {
    description?: string | null;
    nextStepHint?: string | null;
    priorStage?: {
      code?: string;
      name: string;
      status?: string | null;
      outputRemark?: string | null;
      assigneeName?: string | null;
      fileCount?: number | null;
    } | null;
    blockers?: string[];
    openCorrections?: number | null;
    fileCount?: number | null;
    costingTotal?: number | null;
    costingEntryCount?: number | null;
    sampleOutcome?: string | null;
  },
) {
  return {
    ideaRef: task.design?.ideaRef ?? null,
    collectionName: task.design?.collectionName ?? null,
    productType: task.design?.productType ?? null,
    priority: task.design?.priority ?? null,
    stageCode: task.subProcess.code,
    stageName: task.subProcess.name,
    assigneeName: task.assignedEmployee?.name ?? null,
    status: task.status,
    description: opts?.description ?? null,
    nextStepHint: opts?.nextStepHint ?? null,
    priorStage: opts?.priorStage ?? null,
    blockers: opts?.blockers,
    openCorrections: opts?.openCorrections ?? null,
    fileCount: opts?.fileCount ?? null,
    costingTotal: opts?.costingTotal ?? null,
    costingEntryCount: opts?.costingEntryCount ?? null,
    sampleOutcome: opts?.sampleOutcome ?? null,
  };
}
