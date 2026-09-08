/**
 * Phase 3 full correction loop, end-to-end:
 * raise (stage+person chooser) -> rework timer -> Prior|Rework|Total on task detail -> Mistake KPI (-5).
 */
import { expect, test, type Page } from "@playwright/test";
import {
  USERS,
  DEMO_PASSWORD,
  apiGetJson,
  apiPatchJson,
  apiPostJson,
  createDesignViaApi,
  login,
} from "./helpers/auth";
import {
  completeAssignedTask,
  completeStageApproval,
  getDesign,
  getDesignTaskByCode,
  listMyTasks,
} from "./helpers/workflow";

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

async function assignCoreRoles(page: Page, designId: string) {
  const map: Record<string, string> = {
    CONCEPT_REVIEW: USERS.designHead.email,
    SKETCH: USERS.sketch.email,
    SKETCH_APPROVAL: USERS.designHead.email,
  };

  await login(page, USERS.designHead.email, DEMO_PASSWORD);
  const design = await getDesign(page, designId);
  for (const task of design.tasks) {
    const code = task.subProcess.code ?? "";
    const email = map[code];
    if (!email) continue;
    if (!["PENDING", "ASSIGNED"].includes(task.status)) continue;
    const id = await employeeIdFor(page, email);
    await apiPatchJson(page, `/api/tasks/${task.id}/assign`, { employeeId: id });
  }
}

async function completeTaskForUser(
  page: Page,
  email: string,
  designId: string,
  code: string,
) {
  await login(page, email, DEMO_PASSWORD);
  const tasks = await listMyTasks(page);
  const mine = tasks.find(
    (t) => t.design.id === designId && t.subProcess.code === code && t.status === "ASSIGNED",
  );
  if (!mine) return false;
  if (mine.subProcess.isApproval) {
    await completeStageApproval(page, mine.id, `E2E ${code}`);
  } else {
    await completeAssignedTask(page, mine.id, `E2E ${code}`);
  }
  return true;
}

test.describe("Phase 3 full correction loop", () => {
  test("raise MISTAKE with stage+person, rework timer, merged total on task detail, -5 KPI", async ({ page }) => {
    test.setTimeout(180_000);

    await login(page, USERS.designHead.email, DEMO_PASSWORD);
    const design = await createDesignViaApi(page, `Full loop ${Date.now()}`);
    const sketchEmployeeId = await employeeIdFor(page, USERS.sketch.email);
    await assignCoreRoles(page, design.id);

    await completeTaskForUser(page, USERS.designHead.email, design.id, "CONCEPT_REVIEW");
    await completeTaskForUser(page, USERS.sketch.email, design.id, "SKETCH");

    await login(page, USERS.designHead.email, DEMO_PASSWORD);
    const approval = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
    expect(approval?.status).toBe("ASSIGNED");

    const snapshot = await getDesign(page, design.id);
    const sketchTask = snapshot.tasks.find((t) => t.subProcess.code === "SKETCH");
    const sketchDetail = await apiGetJson<{ subProcess: { id: number } }>(
      page,
      `/api/tasks/${sketchTask!.id}`,
    );

    const approvalDetail = await apiGetJson<{ version: number }>(
      page,
      `/api/tasks/${approval!.id}`,
    );
    await apiPostJson(page, `/api/tasks/${approval!.id}/approve-stage`, {
      outputRemark: "Proportions off - routing to Sketch rework",
      version: approvalDetail.version,
      decision: "CORRECTION_REQUIRED",
      correctionType: "MISTAKE",
      correctionRouteToSubProcessId: sketchDetail.subProcess.id,
      correctionReworkAssigneeEmployeeId: sketchEmployeeId,
      correctionResponsibleEmployeeId: sketchEmployeeId,
    });

    const corrections = await apiGetJson<
      Array<{
        id: string;
        correctionType: string;
        ratingImpact: number;
        reworkAssignee: { id: number } | null;
        responsibleEmployee: { id: number } | null;
      }>
    >(page, `/api/corrections?designId=${design.id}`);
    expect(corrections.length).toBe(1);
    const corr = corrections[0];
    expect(corr.correctionType).toBe("MISTAKE");
    expect(Number(corr.ratingImpact)).toBe(-5);
    expect(corr.reworkAssignee?.id).toBe(sketchEmployeeId);
    expect(corr.responsibleEmployee?.id).toBe(sketchEmployeeId);

    await login(page, USERS.sketch.email, DEMO_PASSWORD);
    const myTasks = await listMyTasks(page);
    const rework = myTasks.find(
      (t) =>
        t.design.id === design.id &&
        t.subProcess.code === "SKETCH" &&
        t.status === "CORRECTION_REQUIRED",
    );
    expect(rework, "reopened SKETCH rework task").toBeTruthy();

    await apiPostJson(page, `/api/tasks/${rework!.id}/start`, {});
    await page.waitForTimeout(2500);
    await completeAssignedTask(page, rework!.id, "Rework complete - proportions corrected");

    const detail = await apiGetJson<{
      timeSummary: { activeSeconds: number };
      correctionTime: {
        priorSeconds: number;
        reworkSeconds: number;
        totalSeconds: number;
        correctionCount: number;
      } | null;
    }>(page, `/api/tasks/${rework!.id}`);
    expect(detail.correctionTime, "task detail exposes Prior|Rework|Total").not.toBeNull();
    expect(detail.correctionTime!.correctionCount).toBe(1);
    expect(detail.correctionTime!.priorSeconds).toBeGreaterThanOrEqual(0);
    expect(detail.correctionTime!.reworkSeconds).toBeGreaterThanOrEqual(1);
    expect(detail.correctionTime!.totalSeconds).toBe(
      detail.correctionTime!.priorSeconds + detail.correctionTime!.reworkSeconds,
    );

    await login(page, USERS.designHead.email, DEMO_PASSWORD);
    const approvalAgain = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
    expect(approvalAgain).toBeTruthy();
    await completeStageApproval(page, approvalAgain!.id, "Approved after rework");

    const finalSnapshot = await getDesign(page, design.id);
    expect(finalSnapshot.tasks.find((t) => t.subProcess.code === "SKETCH_APPROVAL")?.status).toBe(
      "COMPLETED",
    );

    await login(page, USERS.admin.email, USERS.admin.password);
    const performance = await apiGetJson<{
      marks: Array<{
        sourceType: string;
        sourceRef: string | null;
        pointsDelta: number;
      }>;
    }>(page, `/api/kpi/employees/${sketchEmployeeId}/performance`);
    const penalty = performance.marks.find(
      (m) => m.sourceType === "CORRECTION_IMPACT" && Number(m.pointsDelta) === -5,
    );
    expect(penalty, "MISTAKE correction applies -5 performance mark").toBeTruthy();
    expect(penalty!.sourceRef).toContain(`correction:${corr.id}`);
  });

  test("IMPROVEMENT correction routes stage+person with Prior|Rework|Total and no KPI penalty", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await login(page, USERS.designHead.email, DEMO_PASSWORD);
    const design = await createDesignViaApi(page, `Improve loop ${Date.now()}`);
    const sketchEmployeeId = await employeeIdFor(page, USERS.sketch.email);
    await assignCoreRoles(page, design.id);

    await completeTaskForUser(page, USERS.designHead.email, design.id, "CONCEPT_REVIEW");
    await completeTaskForUser(page, USERS.sketch.email, design.id, "SKETCH");

    await login(page, USERS.designHead.email, DEMO_PASSWORD);
    const approval = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
    expect(approval?.status).toBe("ASSIGNED");

    const snapshot = await getDesign(page, design.id);
    const sketchTask = snapshot.tasks.find((t) => t.subProcess.code === "SKETCH");
    const sketchDetail = await apiGetJson<{ subProcess: { id: number } }>(
      page,
      `/api/tasks/${sketchTask!.id}`,
    );
    const approvalDetail = await apiGetJson<{ version: number }>(
      page,
      `/api/tasks/${approval!.id}`,
    );

    await apiPostJson(page, `/api/tasks/${approval!.id}/approve-stage`, {
      outputRemark: "Improve proportions - no blame",
      version: approvalDetail.version,
      decision: "CORRECTION_REQUIRED",
      correctionType: "IMPROVEMENT",
      correctionRouteToSubProcessId: sketchDetail.subProcess.id,
      correctionReworkAssigneeEmployeeId: sketchEmployeeId,
    });

    const corrections = await apiGetJson<
      Array<{
        id: string;
        correctionType: string;
        ratingImpact: number;
        reworkAssignee: { id: number } | null;
      }>
    >(page, `/api/corrections?designId=${design.id}`);
    expect(corrections.length).toBe(1);
    const corr = corrections[0];
    expect(corr.correctionType).toBe("IMPROVEMENT");
    expect(Number(corr.ratingImpact ?? 0)).toBe(0);
    expect(corr.reworkAssignee?.id).toBe(sketchEmployeeId);

    await login(page, USERS.sketch.email, DEMO_PASSWORD);
    const myTasks = await listMyTasks(page);
    const rework = myTasks.find(
      (t) =>
        t.design.id === design.id &&
        t.subProcess.code === "SKETCH" &&
        t.status === "CORRECTION_REQUIRED",
    );
    expect(rework, "reopened SKETCH rework task").toBeTruthy();

    await apiPostJson(page, `/api/tasks/${rework!.id}/start`, {});
    await page.waitForTimeout(2500);
    await completeAssignedTask(page, rework!.id, "Improvement rework done");

    const detail = await apiGetJson<{
      correctionTime: {
        priorSeconds: number;
        reworkSeconds: number;
        totalSeconds: number;
      } | null;
    }>(page, `/api/tasks/${rework!.id}`);
    expect(detail.correctionTime).not.toBeNull();
    expect(detail.correctionTime!.totalSeconds).toBe(
      detail.correctionTime!.priorSeconds + detail.correctionTime!.reworkSeconds,
    );

    await login(page, USERS.admin.email, USERS.admin.password);
    const performance = await apiGetJson<{
      marks: Array<{
        sourceType: string;
        sourceRef: string | null;
        pointsDelta: number;
      }>;
    }>(page, `/api/kpi/employees/${sketchEmployeeId}/performance`);
    const noPenalty = performance.marks.find(
      (m) =>
        m.sourceType === "CORRECTION_IMPACT" &&
        m.sourceRef?.includes(`correction:${corr.id}`) &&
        Number(m.pointsDelta) === -5,
    );
    expect(noPenalty, "IMPROVEMENT must not apply -5 KPI penalty").toBeFalsy();
  });

});
