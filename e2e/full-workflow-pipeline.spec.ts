/**
 * Full workflow pipeline — concept through production release.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  USERS,
  apiGetJson,
  apiPostJson,
  createDesignViaApi,
  login,
} from "./helpers/auth";
import {
  assignTaskToEmployee,
  completeAssignedTask,
  completeStageApproval,
  getDesign,
  getDesignTaskByCode,
  listMyTasks,
  submitManagementApprovals,
} from "./helpers/workflow";

const DEMO = "Demo@123";

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

async function assignAllPending(page: Page, designId: string, map: Record<string, string>) {
  await login(page, USERS.designHead.email, DEMO);
  const design = await getDesign(page, designId);
  for (const task of design.tasks) {
    const code = task.subProcess.code ?? "";
    const email = map[code];
    if (!email) continue;
    if (!["PENDING", "ASSIGNED"].includes(task.status)) continue;
    const id = await employeeIdFor(page, email);
    await assignTaskToEmployee(page, task.id, id);
  }
}

async function completeTaskForUser(
  page: Page,
  email: string,
  designId: string,
  code: string,
  extra?: Parameters<typeof completeAssignedTask>[3],
) {
  await login(page, email, DEMO);
  const tasks = await listMyTasks(page);
  const mine = tasks.find(
    (t) => t.design.id === designId && t.subProcess.code === code && t.status === "ASSIGNED",
  );
  if (!mine) return false;
  await completeAssignedTask(page, mine.id, `E2E ${code}`, extra);
  return true;
}

test.describe("Full workflow pipeline", () => {
  test("concept through LIVE", async ({ page }) => {
    test.setTimeout(300_000);

    const roleMap: Record<string, string> = {
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
      LIVE_REVIEW: USERS.management.email,
    };

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Pipeline ${Date.now()}`);
    await assignAllPending(page, design.id, roleMap);

    const workOrder = [
      "CONCEPT_REVIEW",
      "SKETCH",
      "PUNCH",
      "MAT_REQ",
      "FABRIC_ISSUE",
      "MACHINE_SAMPLE",
      "SAMPLE_RECEIVE",
    ] as const;

    for (const code of workOrder) {
      await completeTaskForUser(page, roleMap[code], design.id, code);
      if (code === "SKETCH") {
        await login(page, USERS.designHead.email, DEMO);
        const approval = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
        if (approval?.status === "ASSIGNED") {
          await completeStageApproval(page, approval.id);
        }
      }
      if (code === "PUNCH") {
        await login(page, USERS.checker.email, DEMO);
        const punchCheck = await getDesignTaskByCode(page, design.id, "PUNCH_CHECK");
        if (punchCheck?.status === "ASSIGNED") {
          await completeStageApproval(page, punchCheck.id);
        }
      }
    }

    const checklist = await apiGetJson<Array<{ id: number }>>(page, "/api/masters/checklist");
    await completeTaskForUser(page, USERS.checker.email, design.id, "SAMPLE_CHECK", {
      sampleOutcome: "APPROVE",
      checklist: checklist.slice(0, 2).map((item) => ({ itemId: item.id, result: true })),
    });

    await login(page, USERS.costing.email, DEMO);
    await apiPostJson(page, `/api/designs/${design.id}/costs`, {
      costType: "MATERIAL",
      description: "Pipeline E2E costing",
      amount: 1200,
    });

    await login(page, USERS.designHead.email, DEMO);
    const finalApproval = await getDesignTaskByCode(page, design.id, "FINAL_APPROVAL");
    if (finalApproval?.status === "ASSIGNED") {
      await completeStageApproval(page, finalApproval.id);
    }

    await submitManagementApprovals(page, design.id);

    await completeTaskForUser(page, USERS.designHead.email, design.id, "PROD_HANDOFF");

    await login(page, USERS.production.email, DEMO);
    const accept = await apiPostJson<{ designId: string }>(page, "/api/production/accept-handoff", {
      designId: design.id,
    });
    expect(accept.designId).toBe(design.id);

    const acceptedDesign = await getDesign(page, design.id);
    expect(acceptedDesign.status).toBe("PRODUCTION_ACCEPTED");

    await completeTaskForUser(page, USERS.production.email, design.id, "PROD_INSTRUCTION");
    await completeTaskForUser(page, USERS.production.email, design.id, "PROD_RELEASE");

    const released = await getDesign(page, design.id);
    expect(released.status).toBe("PRODUCTION_RELEASED");

    await login(page, USERS.admin.email, USERS.admin.password);
    const liveTask = await getDesignTaskByCode(page, design.id, "LIVE_REVIEW");
    expect(liveTask).toBeTruthy();
    if (liveTask && ["PENDING", "ASSIGNED"].includes(liveTask.status)) {
      const managementId = await employeeIdFor(page, USERS.management.email);
      await assignTaskToEmployee(page, liveTask.id, managementId);
    }

    const liveDone = await completeTaskForUser(
      page,
      USERS.management.email,
      design.id,
      "LIVE_REVIEW",
    );
    expect(liveDone).toBe(true);

    await login(page, USERS.production.email, DEMO);
    await apiPostJson(page, "/api/production/live", { designId: design.id });

    const liveDesign = await getDesign(page, design.id);
    expect(liveDesign.status).toBe("LIVE");
  });
});

test.describe("Sample reject and re-sample", () => {
  test("sample REJECT creates correction routed to machine sample", async ({ page }) => {
    test.setTimeout(180_000);

    const roleMap: Record<string, string> = {
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
    };

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Reject path ${Date.now()}`);
    await assignAllPending(page, design.id, roleMap);

    for (const code of [
      "CONCEPT_REVIEW",
      "SKETCH",
      "PUNCH",
      "MAT_REQ",
      "FABRIC_ISSUE",
      "MACHINE_SAMPLE",
      "SAMPLE_RECEIVE",
    ] as const) {
      await completeTaskForUser(page, roleMap[code], design.id, code);
      if (code === "SKETCH") {
        await login(page, USERS.designHead.email, DEMO);
        const approval = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
        if (approval?.status === "ASSIGNED") await completeStageApproval(page, approval.id);
      }
      if (code === "PUNCH") {
        await login(page, USERS.checker.email, DEMO);
        const punchCheck = await getDesignTaskByCode(page, design.id, "PUNCH_CHECK");
        if (punchCheck?.status === "ASSIGNED") await completeStageApproval(page, punchCheck.id);
      }
    }

    const checklist = await apiGetJson<Array<{ id: number }>>(page, "/api/masters/checklist");
    await completeTaskForUser(page, USERS.checker.email, design.id, "SAMPLE_CHECK", {
      sampleOutcome: "REJECT",
      checklist: checklist.slice(0, 2).map((item, index) => ({
        itemId: item.id,
        result: index === 0,
        remark: index === 0 ? undefined : "Fit issue",
      })),
    });

    const sampleCheck = await getDesignTaskByCode(page, design.id, "SAMPLE_CHECK");
    expect(sampleCheck?.status).toBe("CORRECTION_REQUIRED");

    const corrections = await apiGetJson<
      Array<{ designId: string; status: string; routeToSubProcess?: { code: string } | null }>
    >(page, `/api/corrections?designId=${design.id}`);
    expect(corrections.some((c) => c.status === "OPEN")).toBe(true);
    expect(
      corrections.some((c) => c.routeToSubProcess?.code === "MACHINE_SAMPLE"),
    ).toBe(true);
  });

  test("sample RESAMPLE spawns rework task", async ({ page }) => {
    test.setTimeout(180_000);

    const roleMap: Record<string, string> = {
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
    };

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Resample path ${Date.now()}`);
    await assignAllPending(page, design.id, roleMap);

    for (const code of [
      "CONCEPT_REVIEW",
      "SKETCH",
      "PUNCH",
      "MAT_REQ",
      "FABRIC_ISSUE",
      "MACHINE_SAMPLE",
      "SAMPLE_RECEIVE",
    ] as const) {
      await completeTaskForUser(page, roleMap[code], design.id, code);
      if (code === "SKETCH") {
        await login(page, USERS.designHead.email, DEMO);
        const approval = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
        if (approval?.status === "ASSIGNED") await completeStageApproval(page, approval.id);
      }
      if (code === "PUNCH") {
        await login(page, USERS.checker.email, DEMO);
        const punchCheck = await getDesignTaskByCode(page, design.id, "PUNCH_CHECK");
        if (punchCheck?.status === "ASSIGNED") await completeStageApproval(page, punchCheck.id);
      }
    }

    const checklist = await apiGetJson<Array<{ id: number }>>(page, "/api/masters/checklist");
    await completeTaskForUser(page, USERS.checker.email, design.id, "SAMPLE_CHECK", {
      sampleOutcome: "RESAMPLE",
      checklist: checklist.slice(0, 2).map((item) => ({ itemId: item.id, result: true })),
    });

    const after = await getDesign(page, design.id);
    const resample = after.tasks.find((t) =>
      (t.subProcess.code ?? "").includes("RESAMPLE") ||
      (t.subProcess.name ?? "").toLowerCase().includes("re-sample") ||
      (t.subProcess.name ?? "").toLowerCase().includes("resample"),
    );
    const machineOpen = after.tasks.filter(
      (t) => t.subProcess.code === "MACHINE_SAMPLE" && !["COMPLETED", "CANCELLED"].includes(t.status),
    );
    expect(Boolean(resample) || machineOpen.length > 0).toBe(true);
  });
});

test.describe("Production return happy path", () => {
  test("return creates correction and appears in returned inbox", async ({ page }) => {
    test.setTimeout(120_000);

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Return happy ${Date.now()}`);

    await login(page, USERS.costing.email, DEMO);
    await apiPostJson(page, `/api/designs/${design.id}/costs`, {
      costType: "MATERIAL",
      description: "Return test costing",
      amount: 800,
    });

    await login(page, USERS.admin.email, USERS.admin.password);
    await submitManagementApprovals(page, design.id);

    await login(page, USERS.designHead.email, DEMO);
    await assignAllPending(page, design.id, { PROD_HANDOFF: USERS.designHead.email });
    await completeTaskForUser(page, USERS.designHead.email, design.id, "PROD_HANDOFF");

    await login(page, USERS.production.email, DEMO);
    await apiPostJson(page, "/api/production/accept-handoff", { designId: design.id });

    const options = await apiGetJson<{
      canReturn: boolean;
      routeOptions: Array<{ id: number }>;
    }>(page, `/api/production/return?designId=${design.id}`);
    expect(options.canReturn).toBe(true);

    const returned = await apiPostJson<{ correctionId: string }>(page, "/api/production/return", {
      designId: design.id,
      reasonCode: "TECHNICAL_FEASIBILITY",
      routeToSubProcessId: options.routeOptions[0].id,
      remark: "E2E return happy path",
    });
    expect(returned.correctionId).toBeTruthy();

    const inbox = await apiGetJson<{
      returnedClarification: Array<{ designId: string }>;
    }>(page, "/api/production/inbox");
    expect(inbox.returnedClarification.some((r) => r.designId === design.id)).toBe(true);
  });
});
