/**
 * E2E workflow helpers — complete assigned tasks via API.
 */
import type { Page } from "@playwright/test";
import { apiGetJson, apiPatchJson, apiPostJson, login, USERS } from "./auth";

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

export async function getChecklistForSubProcessCode(
  page: Page,
  subProcessCode: string,
) {
  const allChecklist = await apiGetJson<
    Array<{ id: number; subProcessId?: number | null; subProcess?: { code: string } | null }>
  >(page, "/api/masters/checklist");
  return allChecklist.filter((item) => item.subProcess?.code === subProcessCode);
}

export async function buildSampleCheckChecklist(
  page: Page,
  options?: {
    approveAll?: boolean;
    rejectSecond?: boolean;
  },
) {
  const items = await getChecklistForSubProcessCode(page, "SAMPLE_CHECK");
  if (items.length === 0) {
    throw new Error("No checklist items configured for SAMPLE_CHECK");
  }
  if (options?.rejectSecond) {
    return items.map((item, index) => ({
      itemId: item.id,
      result: index === 0,
      remark: index === 0 ? undefined : "Fit issue",
    }));
  }
  return items.map((item) => ({ itemId: item.id, result: options?.approveAll !== false }));
}

/** End or resume+end any RUNNING/ON_HOLD tasks so a new task can start. */
export async function clearStaleRunningTasks(page: Page, exceptTaskId?: string) {
  const tasks = await listMyTasks(page);
  const blockers = tasks.filter(
    (t) =>
      t.id !== exceptTaskId &&
      (t.status === "RUNNING" || t.status === "ON_HOLD"),
  );

  for (const task of blockers) {
    if (task.status === "ON_HOLD") {
      await apiPostJson(page, `/api/tasks/${task.id}/resume`, {});
    }
    const detail = await apiGetJson<{
      version: number;
      status: string;
      subProcess: { id?: number; code?: string; isFileRequired?: boolean };
    }>(page, `/api/tasks/${task.id}`);

    if (detail.subProcess.isFileRequired) {
      const type =
        detail.subProcess.code === "SKETCH"
          ? "SKETCH_VERSION"
          : detail.subProcess.code === "PUNCH"
            ? "PUNCHING_FILE"
            : "SAMPLE_OUTPUT";
      await addTaskArtifact(page, task.id, type);
    }

    let checklist: Array<{ itemId: number; result: boolean }> | undefined;
    if (detail.subProcess.code === "SAMPLE_CHECK") {
      checklist = await buildSampleCheckChecklist(page);
    } else if (detail.subProcess.id) {
      const forSubProcess = await getChecklistForSubProcessCode(
        page,
        detail.subProcess.code ?? "",
      );
      if (forSubProcess.length > 0) {
        checklist = forSubProcess.map((item) => ({ itemId: item.id, result: true }));
      }
    }

    await apiPostJson(page, `/api/tasks/${task.id}/end`, {
      version: detail.version,
      outputRemark: "E2E cleanup — end stale running task",
      completionStatus: "COMPLETED",
      sampleOutcome: detail.subProcess.code === "SAMPLE_CHECK" ? "APPROVE" : undefined,
      checklist,
    });
  }
}

export async function assignAllPendingTasks(
  page: Page,
  designId: string,
  roleMap: Record<string, string>,
  resolveEmployeeId: (page: Page, email: string) => Promise<number>,
) {
  await login(page, USERS.designHead.email, USERS.designHead.password);
  const design = await getDesign(page, designId);
  for (const task of design.tasks) {
    const code = task.subProcess.code ?? "";
    const email = roleMap[code];
    if (!email) continue;
    if (!["PENDING", "ASSIGNED"].includes(task.status)) continue;
    const employeeId = await resolveEmployeeId(page, email);
    await assignTaskToEmployee(page, task.id, employeeId);
  }
}

export async function completeTaskForUser(
  page: Page,
  email: string,
  designId: string,
  code: string,
  extra?: Parameters<typeof completeAssignedTask>[3],
) {
  const userEntry = Object.values(USERS).find((u) => u.email === email);
  if (!userEntry) throw new Error(`Unknown user email ${email}`);
  await login(page, email, userEntry.password);

  const tasks = await listMyTasks(page);
  const mine = tasks.find(
    (t) => t.design.id === designId && t.subProcess.code === code && t.status === "ASSIGNED",
  );
  if (!mine) return false;

  let payload = extra;
  if (code === "SAMPLE_CHECK" && !extra?.checklist) {
    payload = {
      ...extra,
      sampleOutcome: extra?.sampleOutcome ?? "APPROVE",
      checklist:
        extra?.sampleOutcome === "REJECT"
          ? await buildSampleCheckChecklist(page, { rejectSecond: true })
          : await buildSampleCheckChecklist(page),
    };
  }

  await completeAssignedTask(page, mine.id, `E2E ${code}`, payload);
  return true;
}

export async function runWorkOrderThroughSampleReceive(
  page: Page,
  designId: string,
  roleMap: Record<string, string>,
  resolveEmployeeId: (page: Page, email: string) => Promise<number>,
  options?: { fromCode?: string; assignFirst?: boolean },
) {
  if (options?.assignFirst !== false) {
    await assignAllPendingTasks(page, designId, roleMap, resolveEmployeeId);
  }

  const workOrder = [
    "CONCEPT_REVIEW",
    "SKETCH",
    "PUNCH",
    "MAT_REQ",
    "FABRIC_ISSUE",
    "MACHINE_SAMPLE",
    "SAMPLE_RECEIVE",
  ] as const;

  const startIndex = options?.fromCode
    ? Math.max(0, workOrder.indexOf(options.fromCode as (typeof workOrder)[number]))
    : 0;

  for (const code of workOrder.slice(startIndex)) {
    await completeTaskForUser(page, roleMap[code], designId, code);
    if (code === "SKETCH") {
      await login(page, USERS.designHead.email, USERS.designHead.password);
      const approval = await getDesignTaskByCode(page, designId, "SKETCH_APPROVAL");
      if (approval?.status === "ASSIGNED") {
        await completeStageApproval(page, approval.id);
      }
    }
    if (code === "PUNCH") {
      await login(page, USERS.checker.email, USERS.checker.password);
      const punchCheck = await getDesignTaskByCode(page, designId, "PUNCH_CHECK");
      if (punchCheck?.status === "ASSIGNED") {
        await completeStageApproval(page, punchCheck.id);
      }
    }
  }
}

async function ensureTaskAssigned(
  page: Page,
  designId: string,
  code: string,
  assigneeEmail: string,
  resolveEmployeeId: (page: Page, email: string) => Promise<number>,
) {
  await login(page, USERS.designHead.email, USERS.designHead.password);
  const task = await getDesignTaskByCode(page, designId, code);
  if (!task || !["PENDING", "ASSIGNED"].includes(task.status)) return task;

  const employeeId = await resolveEmployeeId(page, assigneeEmail);
  if (task.status === "PENDING" || task.assignedEmployeeId !== employeeId) {
    await assignTaskToEmployee(page, task.id, employeeId);
  }
  return task;
}

export async function finalizeDevelopmentForSignOff(
  page: Page,
  designId: string,
  resolveEmployeeId: (page: Page, email: string) => Promise<number>,
  options?: { costAmount?: number; costDescription?: string },
) {
  await ensureTaskAssigned(page, designId, "COSTING", USERS.costing.email, resolveEmployeeId);

  await login(page, USERS.costing.email, USERS.costing.password);
  await apiPostJson(page, `/api/designs/${designId}/costs`, {
    costType: "MATERIAL",
    description: options?.costDescription ?? "E2E development costing",
    amount: options?.costAmount ?? 1200,
  });

  const costingDone = await completeTaskForUser(page, USERS.costing.email, designId, "COSTING");
  if (!costingDone) {
    throw new Error(`COSTING task was not completed for design ${designId}`);
  }

  await ensureTaskAssigned(
    page,
    designId,
    "FINAL_APPROVAL",
    USERS.designHead.email,
    resolveEmployeeId,
  );

  await login(page, USERS.designHead.email, USERS.designHead.password);
  const finalApproval = await getDesignTaskByCode(page, designId, "FINAL_APPROVAL");
  if (finalApproval?.status === "ASSIGNED") {
    await completeStageApproval(page, finalApproval.id);
  }
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
  await clearStaleRunningTasks(page, taskId);

  const current = await apiGetJson<{ status: string }>(page, `/api/tasks/${taskId}`);
  if (current.status === "ASSIGNED") {
    await apiPostJson(page, `/api/tasks/${taskId}/start`, {});
  }

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
  if (!checklist && detail.subProcess.code === "SAMPLE_CHECK") {
    checklist =
      extra?.sampleOutcome === "REJECT"
        ? await buildSampleCheckChecklist(page, { rejectSecond: true })
        : await buildSampleCheckChecklist(page);
  } else if (!checklist && detail.subProcess.id) {
    const forSubProcess = await getChecklistForSubProcessCode(
      page,
      detail.subProcess.code ?? "",
    );
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

export type ApprovalLevelRow = {
  id: number;
  code: string;
  sequence: number;
  name: string;
};

const APPROVAL_LEVEL_ACTOR: Record<string, keyof typeof USERS> = {
  CHECKER_APPROVAL: "checker",
  DESIGN_HEAD_APPROVAL: "designHead",
  MANAGEMENT_APPROVAL: "management",
};

export async function requestDesignApproval(page: Page, designId: string) {
  return apiPostJson(page, `/api/designs/${designId}/request-approval`, {});
}

export async function requestDesignApprovalIfNeeded(page: Page, designId: string) {
  const design = await getDesign(page, designId);
  if (design.status === "APPROVAL_PENDING") return design;
  await login(page, USERS.designHead.email, USERS.designHead.password);
  return requestDesignApproval(page, designId);
}

export async function submitApprovalAtLevel(
  page: Page,
  designId: string,
  level: ApprovalLevelRow,
  decision: "APPROVED" | "REJECTED" | "CORRECTION_REQUIRED" = "APPROVED",
) {
  const actorKey = APPROVAL_LEVEL_ACTOR[level.code];
  if (!actorKey) {
    throw new Error(`No E2E actor mapped for approval level ${level.code}`);
  }
  const actor = USERS[actorKey];
  await login(page, actor.email, actor.password);
  return apiPostJson(page, "/api/approvals", {
    designId,
    approvalLevelId: level.id,
    decision,
    remark: `E2E ${level.code} ${decision}`,
  });
}

export async function submitManagementApprovals(page: Page, designId: string) {
  await requestDesignApprovalIfNeeded(page, designId);

  const levels = await apiGetJson<ApprovalLevelRow[]>(page, "/api/approvals?view=levels");

  for (const level of levels.sort((a, b) => a.sequence - b.sequence)) {
    await submitApprovalAtLevel(page, designId, level, "APPROVED");
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

const WORKFLOW_ROLE_MAP: Record<string, string> = {
  CONCEPT_REVIEW: USERS.designHead.email,
  SKETCH: USERS.sketch.email,
  SKETCH_APPROVAL: USERS.designHead.email,
  PUNCH: USERS.punch.email,
  PUNCH_CHECK: USERS.checker.email,
  MAT_REQ: USERS.designHead.email,
  FABRIC_ISSUE: USERS.production.email,
  MACHINE_SAMPLE: USERS.machine.email,
  SAMPLE_RECEIVE: USERS.machine.email,
  SAMPLE_CHECK: USERS.checker.email,
  COSTING: USERS.costing.email,
  FINAL_APPROVAL: USERS.designHead.email,
  PROD_HANDOFF: USERS.designHead.email,
  PROD_INSTRUCTION: USERS.production.email,
  PROD_RELEASE: USERS.production.email,
};

async function employeeIdFor(page: Page, email: string) {
  await login(page, USERS.admin.email, USERS.admin.password);
  const employees = await apiGetJson<Array<{ id: number; email: string }>>(
    page,
    "/api/admin/employees",
  );
  const row = employees.find((e) => e.email === email);
  if (!row) throw new Error(`Missing employee ${email}`);
  return row.id;
}

/**
 * Advance a design through workflow up to PROD_INSTRUCTION complete and handoff accepted,
 * with costing added, but leave PROD_RELEASE incomplete. Used for production release gate tests.
 */
export async function advanceDesignToProdReleaseGate(
  page: Page,
  collectionName: string,
) {
  const { createDesignViaApi } = await import("./auth");

  await login(page, USERS.designHead.email, USERS.designHead.password);
  const design = await createDesignViaApi(page, collectionName);

  const resolveEmployeeId = async (p: Page, email: string) => employeeIdFor(p, email);

  await runWorkOrderThroughSampleReceive(page, design.id, WORKFLOW_ROLE_MAP, resolveEmployeeId);

  const sampleDone = await completeTaskForUser(
    page,
    USERS.checker.email,
    design.id,
    "SAMPLE_CHECK",
    { sampleOutcome: "APPROVE" },
  );
  if (!sampleDone) throw new Error("SAMPLE_CHECK task was not completed");

  await finalizeDevelopmentForSignOff(page, design.id, resolveEmployeeId, {
    costAmount: 1500,
    costDescription: "E2E prod release gate costing",
  });

  await submitManagementApprovals(page, design.id);

  const handoffDone = await completeTaskForUser(
    page,
    USERS.designHead.email,
    design.id,
    "PROD_HANDOFF",
  );
  if (!handoffDone) throw new Error("PROD_HANDOFF task was not completed");

  await login(page, USERS.production.email, USERS.production.password);
  await apiPostJson(page, "/api/production/accept-handoff", { designId: design.id });

  const instructionDone = await completeTaskForUser(
    page,
    USERS.production.email,
    design.id,
    "PROD_INSTRUCTION",
  );
  if (!instructionDone) throw new Error("PROD_INSTRUCTION task was not completed");

  const prodRelease = await getDesignTaskByCode(page, design.id, "PROD_RELEASE");
  if (!prodRelease) throw new Error("PROD_RELEASE task missing");
  if (prodRelease.status === "COMPLETED") {
    throw new Error("PROD_RELEASE should remain incomplete for prod release gate test");
  }

  const snapshot = await getDesign(page, design.id);
  return { designId: design.id, status: snapshot.status };
}