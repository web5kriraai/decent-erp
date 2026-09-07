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

export function getTaskHoldDialogConfig(task: TaskDialogTask): HoldDialogConfig {
  const stage = task.subProcess.name;
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
    description: "",
    preferredHoldReasonCodes,
    remarkLabel: "Hold note",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
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
    description: "",
    remarkLabel: "Review notes",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
    priorContextSlots: ["machine", "files", "remark"],
  },
  COSTING: {
    description: "",
    remarkLabel: "Costing summary",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
    priorContextSlots: ["sample", "costing"],
  },
  SKETCH: {
    description: "",
    remarkLabel: "Sketch note",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
    priorContextSlots: ["concept"],
  },
  PUNCH: {
    description: "",
    remarkLabel: "Punch note",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
    priorContextSlots: ["files", "remark"],
  },
  SAMPLE_RECEIVE: {
    description: "",
    remarkLabel: "Receive note",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
    priorContextSlots: ["machine", "files"],
  },
  PROD_RELEASE: {
    description: "",
    remarkLabel: "Release note",
    remarkPlaceholder: "Note for production / ERP…",
    nextStepHint: "",
    priorContextSlots: ["remark", "files"],
  },
  PROD_HANDOFF: {
    description: "",
    remarkLabel: "Handoff note",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
    priorContextSlots: ["costing", "files", "remark"],
  },
  PROD_INSTRUCTION: {
    description: "",
    remarkLabel: "Production instruction",
    remarkPlaceholder: "Instructions…",
    nextStepHint: "",
    priorContextSlots: ["remark", "files"],
  },
  MAT_REQ: {
    description: "",
    remarkLabel: "Material note",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
    priorContextSlots: ["files", "remark"],
  },
  FABRIC_ISSUE: {
    description: "",
    remarkLabel: "Material note",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
    priorContextSlots: ["files", "remark"],
  },
  MACHINE_SAMPLE: {
    description: "",
    remarkLabel: "Sample notes",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
    priorContextSlots: ["files", "remark"],
  },
};

export function getTaskEndDialogConfig(
  task: TaskDialogTask,
  _roleCode?: string | null,
): EndDialogConfig {
  const code = task.subProcess.code;
  const stage = task.subProcess.name;
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
    description: "",
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
    remarkLabel: "Remark",
    remarkPlaceholder: "Optional note…",
    nextStepHint: "",
    priorContextSlots: behavior.costingEntry
      ? ["sample", "costing"]
      : behavior.machineOutput
        ? ["files", "remark"]
        : ["remark", "files"],
  };

  if (mode === "stage_approval") {
    base.description = "";
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
      description: overlay.description || base.description,
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
