/**
 * PROD_RELEASE Floor ERP gate — end without Floor fails; after Floor completes, end succeeds.
 */
import { expect, test } from "@playwright/test";
import { USERS, apiGetJson, apiPostJson, login } from "./helpers/auth";
import {
  advanceDesignToProdReleaseGate,
  assignTaskToEmployee,
  completeFloorErpStagesForDesign,
  getDesign,
  getDesignTaskByCode,
  listMyTasks,
} from "./helpers/workflow";

const DEMO = USERS.production.password;

async function employeeIdFor(page: import("@playwright/test").Page, email: string) {
  await login(page, USERS.admin.email, USERS.admin.password);
  const employees = await apiGetJson<Array<{ id: number; email: string }>>(
    page,
    "/api/admin/employees",
  );
  const row = employees.find((e) => e.email === email);
  if (!row) throw new Error(`Missing employee ${email}`);
  return row.id;
}

test.describe("Production Release Floor ERP gate", () => {
  test("end PROD_RELEASE blocked until Floor ERP complete, then succeeds", async ({ page }) => {
    test.setTimeout(300_000);

    const { designId } = await advanceDesignToProdReleaseGate(
      page,
      `Floor gate ${Date.now()}`,
    );

    let release = await getDesignTaskByCode(page, designId, "PROD_RELEASE");
    expect(release).toBeTruthy();

    if (!release!.assignedEmployeeId || release!.status === "PENDING") {
      const prodId = await employeeIdFor(page, USERS.production.email);
      await login(page, USERS.designHead.email, USERS.designHead.password);
      await assignTaskToEmployee(page, release!.id, prodId);
      release = await getDesignTaskByCode(page, designId, "PROD_RELEASE");
    }

    await login(page, USERS.production.email, DEMO);
    const mine = await listMyTasks(page);
    const releaseMine = mine.find(
      (t) => t.design.id === designId && t.subProcess.code === "PROD_RELEASE",
    );
    expect(releaseMine).toBeTruthy();

    if (releaseMine!.status === "ASSIGNED") {
      await apiPostJson(page, `/api/tasks/${releaseMine!.id}/start`, {});
    }

    const afterStart = await apiGetJson<{
      id: string;
      status: string;
      version: number;
    }>(page, `/api/tasks/${releaseMine!.id}`);
    expect(afterStart.status).toBe("RUNNING");

    const stages = await apiGetJson<Array<{ erpModule: string; status: string }>>(
      page,
      `/api/erp/stages?designId=${encodeURIComponent(designId)}`,
    );
    expect(stages.length).toBe(9);
    expect(
      stages.find((s) => s.erpModule === "GREY_MATERIAL")?.status === "COMPLETED",
    ).toBe(false);

    const blocked = await page.request.post(`/api/tasks/${releaseMine!.id}/end`, {
      data: {
        version: afterStart.version,
        outputRemark: "E2E attempt end without Floor ERP",
        completionStatus: "COMPLETED",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(blocked.ok()).toBe(false);
    expect(blocked.status()).toBeGreaterThanOrEqual(400);
    const blockedBody = (await blocked.json()) as { error?: string; message?: string };
    const blockedText = `${blockedBody.error ?? ""} ${blockedBody.message ?? ""}`;
    expect(blockedText).toMatch(/Floor ERP|Production Release|floor/i);

    const mid = await getDesign(page, designId);
    expect(mid.status).not.toBe("PRODUCTION_RELEASED");

    await completeFloorErpStagesForDesign(page, designId);

    const readiness = await apiGetJson<{ ok: boolean; floor?: { ok: boolean } }>(
      page,
      `/api/designs/${designId}/production-readiness`,
    );
    expect(readiness.ok).toBe(true);
    expect(readiness.floor?.ok).toBe(true);

    const running = await apiGetJson<{ version: number; status: string }>(
      page,
      `/api/tasks/${releaseMine!.id}`,
    );
    expect(running.status).toBe("RUNNING");

    await apiPostJson(page, `/api/tasks/${releaseMine!.id}/end`, {
      version: running.version,
      outputRemark: "E2E release after Floor ERP",
      completionStatus: "COMPLETED",
    });

    const released = await getDesign(page, designId);
    expect(released.status).toBe("PRODUCTION_RELEASED");
  });
});
