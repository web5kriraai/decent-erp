/**
 * E2E workflow helpers — complete assigned tasks via API.
 */
import type { Page } from "@playwright/test";
import { apiGetJson, apiPatchJson, apiPostJson } from "./auth";

export type WorkflowTask = {
  id: string;
  status: string;
  version?: number;
  design: { id: string };
  subProcess: { code?: string; name: string; isApproval?: boolean; isFileRequired?: boolean };
  assignedEmployeeId?: number | null;
};

export type DesignWithTasks = {
  id: string;
  ideaRef: string;
  status: string;
  version: number;
  currentStage?: string | null;
  tasks: WorkflowTask[];
};

export async function listMyTasks(page: Page) {
  return apiGetJson<WorkflowTask[]>(page, "/api/tasks/my");
}

export async function getDesign(page: Page, designId: string) {
  return apiGetJson<DesignWithTasks>(page, `/api/designs/${designId}`);
}

export async function getDesignTaskByCode(page: Page, designId: string, code: string) {
  const design = await getDesign(page, designId);
  return design.tasks.find((t) => t.subProcess.code === code);
}

export async function assignTaskToEmployee(
  page: Page,
  taskId: string,
  employeeId: number,
) {
  return apiPatchJson(page, `/api/tasks/${taskId}/assign`, { employeeId });
}

export async function addTaskArtifact(
  page: Page,
  taskId: string,
  artifactType: "SKETCH_VERSION" | "PUNCHING_FILE" | "SAMPLE_OUTPUT",
) {
  return apiPostJson(page, `/api/tasks/${taskId}/artifacts`, {
    artifactType,
    fileName: "e2e-placeholder.png",
    storageKey: `e2e/${taskId}/${artifactType.toLowerCase()}.png`,
  });
}

export async function completeAssignedTask(
  page: Page,
  taskId: string,
  remark = "E2E task complete",
  extra?: {
    completionStatus?: "COMPLETED" | "CHECKING";
    sampleOutcome?: "APPROVE" | "REJECT" | "RESAMPLE";
    checklist?: Array<{ itemId: number; result: boolean; remark?: string }>;
  },
) {
  await apiPostJson(page, `/api/tasks/${taskId}/start`, {});
  const detail = await apiGetJson<{
    version: number;
    subProcess: { id?: number; code?: string; isFileRequired?: boolean };
  }>(page, `/api/tasks/${taskId}`);

  if (detail.subProcess.isFileRequired) {
    const type =
      detail.subProcess.code === "SKETCH"
        ? "SKETCH_VERSION"
        : detail.subProcess.code === "PUNCH"
          ? "PUNCHING_FILE"
          : "SAMPLE_OUTPUT";
    await addTaskArtifact(page, taskId, type);
  }

  let checklist = extra?.checklist;
  if (!checklist && detail.subProcess.id) {
    const allChecklist = await apiGetJson<Array<{ id: number; subProcessId?: number | null }>>(
      page,
      "/api/masters/checklist",
    );
    const forSubProcess = allChecklist.filter((c) => c.subProcessId === detail.subProcess.id);
    if (forSubProcess.length > 0) {
      checklist = forSubProcess.map((item) => ({ itemId: item.id, result: true }));
    }
  }

  return apiPostJson(page, `/api/tasks/${taskId}/end`, {
    version: detail.version,
    outputRemark: remark,
    completionStatus: extra?.completionStatus ?? "COMPLETED",
    sampleOutcome: extra?.sampleOutcome,
    checklist,
  });
}

export async function completeFirstAssignedTaskForDesign(
  page: Page,
  designId: string,
  remark?: string,
) {
  const tasks = await listMyTasks(page);
  const task = tasks.find((t) => t.design.id === designId && t.status === "ASSIGNED");
  if (!task) return null;
  return completeAssignedTask(page, task.id, remark);
}

export async function completeStageApproval(
  page: Page,
  taskId: string,
  remark = "E2E stage approval",
  decision: "APPROVED" | "REJECT" | "CORRECTION_REQUIRED" = "APPROVED",
) {
  const detail = await apiGetJson<{ version: number }>(page, `/api/tasks/${taskId}`);
  return apiPostJson(page, `/api/tasks/${taskId}/approve-stage`, {
    outputRemark: remark,
    version: detail.version,
    decision,
  });
}

export async function advanceOpenTasksForDesign(
  page: Page,
  designId: string,
  options?: {
    maxSteps?: number;
    onStep?: (task: WorkflowTask) => void;
  },
) {
  const maxSteps = options?.maxSteps ?? 30;
  for (let step = 0; step < maxSteps; step += 1) {
    const design = await getDesign(page, designId);
    const open = design.tasks
      .filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status))
      .sort((a, b) => (a as { sequence?: number }).sequence ?? 0 - ((b as { sequence?: number }).sequence ?? 0));

    if (open.length === 0) break;

    const task = open[0];
    options?.onStep?.(task);

    if (task.subProcess.isApproval && task.status === "ASSIGNED") {
      await completeStageApproval(page, task.id);
      continue;
    }

    if (task.status === "CHECKING" && !task.subProcess.isApproval) {
      const approval = design.tasks.find(
        (t) =>
          t.subProcess.isApproval &&
          !["COMPLETED", "CANCELLED"].includes(t.status) &&
          t.status === "ASSIGNED",
      );
      if (approval) {
        await completeStageApproval(page, approval.id);
        continue;
      }
    }

    if (["ASSIGNED", "PENDING"].includes(task.status)) {
      const mine = await listMyTasks(page);
      const myTask = mine.find((t) => t.id === task.id);
      if (!myTask && task.status === "PENDING") {
        break;
      }
      if (myTask?.status === "ASSIGNED") {
        if (task.subProcess.code === "SAMPLE_CHECK") {
          const checklist = await apiGetJson<Array<{ id: number; subProcessId?: number | null }>>(
            page,
            "/api/masters/checklist",
          );
          const sampleItems = checklist.filter((c) => c.subProcessId != null).slice(0, 2);
          await completeAssignedTask(page, task.id, "E2E sample approved", {
            sampleOutcome: "APPROVE",
            checklist: sampleItems.map((item) => ({ itemId: item.id, result: true })),
          });
        } else {
          await completeAssignedTask(page, task.id);
        }
      }
      continue;
    }

    break;
  }
}

export async function submitManagementApprovals(page: Page, designId: string) {
  await apiPostJson(page, `/api/designs/${designId}/request-approval`, {});

  const levels = await apiGetJson<Array<{ id: number; sequence: number }>>(
    page,
    "/api/approvals?view=levels",
  );

  for (const level of levels.sort((a, b) => a.sequence - b.sequence)) {
    await apiPostJson(page, "/api/approvals", {
      designId,
      approvalLevelId: level.id,
      decision: "APPROVED",
      remark: "E2E pipeline approval",
    });
  }
}

export async function bypassDesignToPhase(
  page: Page,
  designId: string,
  targetTaskId: string,
  reason: string,
) {
  return apiPostJson(page, `/api/designs/${designId}/bypass`, {
    targetTaskId,
    reason,
  });
}

export async function sendDesignToQcPhase(
  page: Page,
  designId: string,
  targetTaskId: string,
  reason: string,
) {
  return apiPostJson(page, `/api/designs/${designId}/send-qc`, {
    targetTaskId,
    reason,
  });
}

export async function getCompletionSummary(page: Page, designId: string) {
  return apiGetJson<{
    isComplete: boolean;
    employees: Array<{ name: string; activeSeconds: number }>;
    phases: Array<{ status: string; skipReason?: string | null }>;
    overrideHistory: Array<{ action: string }>;
  }>(page, `/api/designs/${designId}/completion-summary`);
}