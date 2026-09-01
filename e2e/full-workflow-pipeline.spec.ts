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
  completeTaskForUser,
  finalizeDevelopmentForSignOff,
  getDesign,
  getDesignTaskByCode,
  requestDesignApproval,
  runWorkOrderThroughSampleReceive,
  submitManagementApprovals,
} from "./helpers/workflow";

const DEMO = "Demo@123";

const BASE_ROLE_MAP: Record<string, string> = {
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

async function advanceThroughSampleCheck(page: Page, designId: string) {
  await runWorkOrderThroughSampleReceive(page, designId, BASE_ROLE_MAP, employeeIdFor);
  const sampleDone = await completeTaskForUser(
    page,
    USERS.checker.email,
    designId,
    "SAMPLE_CHECK",
    { sampleOutcome: "APPROVE" },
  );
  expect(sampleDone).toBe(true);
}

async function finalizeForProduction(page: Page, designId: string) {
  await finalizeDevelopmentForSignOff(page, designId, employeeIdFor, {
    costAmount: 1200,
    costDescription: "Pipeline E2E costing",
  });
}

async function submitManagementChain(page: Page, designId: string) {
  await login(page, USERS.designHead.email, DEMO);
  await requestDesignApproval(page, designId);
  await submitManagementApprovals(page, designId);
}

test.describe("Full workflow pipeline", () => {
  test("concept through LIVE", async ({ page }) => {
    test.setTimeout(300_000);

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Pipeline ${Date.now()}`);

    await advanceThroughSampleCheck(page, design.id);
    await finalizeForProduction(page, design.id);

    const readyQueue = await apiGetJson<Array<{ designId: string }>>(
      page,
      "/api/approvals?view=ready",
    );
    expect(readyQueue.some((row) => row.designId === design.id)).toBe(true);

    await page.goto(`/quality/approvals?tab=ready`);
    await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
    await expect(page.getByText(design.ideaRef)).toBeVisible();

    await login(page, USERS.designHead.email, DEMO);
    await requestDesignApproval(page, design.id);

    await login(page, USERS.checker.email, DEMO);
    const checkerQueueAfterRequest = await apiGetJson<Array<{ designId: string }>>(
      page,
      "/api/approvals",
    );
    expect(checkerQueueAfterRequest.some((row) => row.designId === design.id)).toBe(true);

    await login(page, USERS.designHead.email, DEMO);
    const designHeadQueueAfterRequest = await apiGetJson<Array<{ designId: string }>>(
      page,
      "/api/approvals",
    );
    expect(designHeadQueueAfterRequest.some((row) => row.designId === design.id)).toBe(false);

    await submitManagementApprovals(page, design.id);

    const managementQueue = await apiGetJson<Array<{ designId: string }>>(
      page,
      "/api/approvals",
    );
    expect(managementQueue.some((row) => row.designId === design.id)).toBe(false);

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

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Reject path ${Date.now()}`);
    await runWorkOrderThroughSampleReceive(page, design.id, BASE_ROLE_MAP, employeeIdFor);

    await completeTaskForUser(page, USERS.checker.email, design.id, "SAMPLE_CHECK", {
      sampleOutcome: "REJECT",
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

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Resample path ${Date.now()}`);
    await runWorkOrderThroughSampleReceive(page, design.id, BASE_ROLE_MAP, employeeIdFor);

    await completeTaskForUser(page, USERS.checker.email, design.id, "SAMPLE_CHECK", {
      sampleOutcome: "RESAMPLE",
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
    test.setTimeout(240_000);

    await login(page, USERS.designHead.email, DEMO);
    const design = await createDesignViaApi(page, `Return happy ${Date.now()}`);

    await advanceThroughSampleCheck(page, design.id);
    await finalizeForProduction(page, design.id);
    await submitManagementChain(page, design.id);

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
