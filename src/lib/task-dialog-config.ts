import { isStageApprovalCode } from "@/lib/stage-approval-rbac";
import { isMachineOutputTask } from "@/lib/services/task-machine-output-utils";

export type TaskDialogTask = {
  status: string;
  subProcess: {
    code: string;
    name: string;
    isApproval?: boolean;
    isFileRequired?: boolean;
  };
  design?: { ideaRef?: string };
};

export type HoldDialogConfig = {
  title: string;
  description: string;
  preferredHoldReasonCodes: string[];
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
};

export function getTaskHoldDialogConfig(task: TaskDialogTask): HoldDialogConfig {
  const stage = task.subProcess.name;
  const idea = task.design?.ideaRef;
  const code = task.subProcess.code.toUpperCase();

  const preferredHoldReasonCodes = code.includes("APPROVAL") || task.subProcess.isApproval
    ? ["WAIT_APPROVAL", "MEETING", "OTHER_WORK", "LUNCH", "TEA"]
    : code.includes("SAMPLE") || code.includes("MACHINE")
      ? ["WAIT_MATERIAL", "MACHINE_NA", "OTHER_WORK", "LUNCH", "TEA", "MEETING"]
      : ["OTHER_WORK", "LUNCH", "TEA", "MEETING", "WAIT_APPROVAL", "WAIT_MATERIAL"];

  return {
    title: `Hold ${stage}`,
    description: idea
      ? `Pause active work on ${idea} · ${stage}. Hold time is excluded from KPI active work.`
      : `Pause active work on ${stage}. Hold time is excluded from KPI active work.`,
    preferredHoldReasonCodes,
  };
}

export function getTaskEndDialogConfig(
  task: TaskDialogTask,
  _roleCode?: string | null,
): EndDialogConfig {
  const code = task.subProcess.code;
  const stage = task.subProcess.name;
  const idea = task.design?.ideaRef;
  const fileRequired = !!task.subProcess.isFileRequired;
  const isApproval = !!task.subProcess.isApproval || isStageApprovalCode(code);

  // Sample check is a stage approval in masters but uses the end-dialog outcomes UX.
  if (code === "SAMPLE_CHECK") {
    return {
      title: "Complete Sample Check",
      description: idea
        ? `${idea} · record checklist results and approve, reject, or re-sample.`
        : "Record checklist results and approve, reject, or re-sample.",
      mode: "sample_check",
      forceChecking: false,
      showStatusSelect: false,
      showSampleOutcomes: true,
      showMachineMetrics: false,
      fileRequired,
    };
  }

  if (isApproval) {
    return {
      title: `Complete ${stage}`,
      description: idea
        ? `${idea} · use the stage approval controls for this review — do not treat this as normal execute completion.`
        : "Use stage approval controls for this review task.",
      mode: "stage_approval",
      forceChecking: false,
      showStatusSelect: false,
      showSampleOutcomes: false,
      showMachineMetrics: false,
      fileRequired: false,
    };
  }

  if (isMachineOutputTask(code)) {
    return {
      title: `Complete ${stage}`,
      description: idea
        ? `${idea} · capture machine output / wastage and required files before ending.`
        : "Capture machine output / wastage and required files before ending.",
      mode: "machine",
      forceChecking: true,
      showStatusSelect: false,
      showSampleOutcomes: false,
      showMachineMetrics: true,
      fileRequired: fileRequired || true,
    };
  }

  if (code === "COSTING") {
    return {
      title: `Complete ${stage}`,
      description: idea
        ? `${idea} · enter development costs (time, material, machine, correction), then send for checking.`
        : "Enter development costs, then send for checking.",
      mode: "execute_checking",
      forceChecking: true,
      showStatusSelect: false,
      showSampleOutcomes: false,
      showMachineMetrics: false,
      fileRequired,
    };
  }

  const forcesChecking = ["SKETCH", "PUNCH", "SAMPLE_RECEIVE"].includes(code);
  if (forcesChecking) {
    return {
      title: `Complete ${stage}`,
      description: idea
        ? `${idea} · upload required output and send for checking.`
        : "Upload required output and send for checking.",
      mode: "execute_checking",
      forceChecking: true,
      showStatusSelect: false,
      showSampleOutcomes: false,
      showMachineMetrics: false,
      fileRequired,
    };
  }

  // Production release must complete (not CHECKING) so ERP handoff + LIVE_REVIEW can proceed.
  if (code === "PROD_RELEASE") {
    return {
      title: `Complete ${stage}`,
      description: idea
        ? `${idea} · finish production release to unlock Live Design Review and ERP sync.`
        : "Finish production release to unlock Live Design Review and ERP sync.",
      mode: "execute_complete",
      forceChecking: false,
      showStatusSelect: false,
      showSampleOutcomes: false,
      showMachineMetrics: false,
      fileRequired,
    };
  }

  return {
    title: `Complete ${stage}`,
    description: idea
      ? `${idea} · add completion remark and choose checking vs completed.`
      : "Add completion remark and choose checking vs completed.",
    mode: "execute_complete",
    forceChecking: false,
    showStatusSelect: true,
    showSampleOutcomes: false,
    showMachineMetrics: false,
    fileRequired,
  };
}
