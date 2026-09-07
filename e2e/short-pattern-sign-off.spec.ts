/**
 * Short Concept→Sketch pattern: request management approval without Finance costing
 * (presence-driven transition policy) then complete Checker → DH → Management chain.
 */
import { expect, test } from "@playwright/test";
import {
  USERS,
  apiGetJson,
  apiPostJson,
  login,
} from "./helpers/auth";
import {
  assignAllPendingTasks,
  completeStageApproval,
  completeTaskForUser,
  getDesign,
  getDesignTaskByCode,
  submitManagementApprovals,
} from "./helpers/workflow";

const DEMO = "Demo@123";

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

test.describe("Short pattern sign-off (no costing)", () => {
  test("Concept→Sketch management decide without Finance costing", async ({ page }) => {
    test.setTimeout(180_000);

    await login(page, USERS.admin.email, USERS.admin.password);

    const processes = await apiGetJson<
      Array<{
        id: number;
        code: string;
        subProcesses: Array<{
          id: number;
          code: string;
          defaultRoleId?: number | null;
        }>;
      }>
    >(page, "/api/masters/processes");

    const byCode = new Map<string, { processId: number; subProcessId: number; roleId: number }>();
    for (const proc of processes) {
      for (const sp of proc.subProcesses ?? []) {
        if (sp.defaultRoleId == null) continue;
        byCode.set(sp.code, {
          processId: proc.id,
          subProcessId: sp.id,
          roleId: sp.defaultRoleId,
        });
      }
    }

    const shortCodes = ["CONCEPT_REVIEW", "SKETCH", "SKETCH_APPROVAL"] as const;
    for (const code of shortCodes) {
      expect(byCode.has(code), `missing master ${code}`).toBe(true);
    }

    const pattern = await apiPostJson<{ id: number; name: string }>(page, "/api/workflow-patterns", {
      name: `E2E Short Concept-Sketch ${Date.now()}`,
      versionNo: 1,
      tasks: shortCodes.map((code, index) => {
        const row = byCode.get(code)!;
        return {
          processId: row.processId,
          subProcessId: row.subProcessId,
          defaultRoleId: row.roleId,
          expectedMinutes: 60,
          sequence: index + 1,
          dayOffset: index,
          priority: "MEDIUM",
          dependencySequence: index > 0 ? index : null,
        };
      }),
    });

    await login(page, USERS.designHead.email, DEMO);
    const productTypes = await apiGetJson<Array<{ id: number }>>(page, "/api/masters/product-types");
    const seasons = await apiGetJson<Array<{ id: number }>>(page, "/api/masters/seasons");

    const design = await apiPostJson<{ id: string; ideaRef: string }>(page, "/api/designs", {
      productTypeId: productTypes[0]!.id,
      seasonId: seasons[0]!.id,
      collectionName: `Short pattern sign-off ${Date.now()}`,
      priority: "MEDIUM",
      assignmentMode: "AUTOMATIC",
      workflowPatternId: pattern.id,
    });

    const created = await getDesign(page, design.id);
    expect(created.tasks.map((t) => t.subProcess.code)).toEqual([
      "CONCEPT_REVIEW",
      "SKETCH",
      "SKETCH_APPROVAL",
    ]);
    expect(created.tasks.some((t) => t.subProcess.code === "COSTING")).toBe(false);

    const roleMap: Record<string, string> = {
      CONCEPT_REVIEW: USERS.designHead.email,
      SKETCH: USERS.sketch.email,
      SKETCH_APPROVAL: USERS.designHead.email,
    };

    await assignAllPendingTasks(page, design.id, roleMap, employeeIdFor);
    await completeTaskForUser(page, USERS.designHead.email, design.id, "CONCEPT_REVIEW");
    await completeTaskForUser(page, USERS.sketch.email, design.id, "SKETCH");

    await login(page, USERS.designHead.email, DEMO);
    const sketchApproval = await getDesignTaskByCode(page, design.id, "SKETCH_APPROVAL");
    expect(sketchApproval?.status).toBe("ASSIGNED");
    await completeStageApproval(page, sketchApproval!.id, "Short pattern sketch approved");

    const readyQueue = await apiGetJson<Array<{ designId: string }>>(
      page,
      "/api/approvals?view=ready",
    );
    expect(readyQueue.some((row) => row.designId === design.id)).toBe(true);

    await page.goto(`/quality/approvals/request-sign-off/${design.id}`);
    await expect(
      page.getByRole("heading", {
        name: new RegExp(`Request management approval · ${design.ideaRef}`),
      }),
    ).toBeVisible();

    // Presence-driven: no Finance costing blocker for short patterns
    await expect(page.getByText(/Add at least one cost entry/i)).toHaveCount(0);
    await expect(page.getByText(/Not required/i)).toBeVisible();

    // Before request: short pattern has no COSTING / PROD_* tasks → no phantom gaps
    const preReadiness = await apiGetJson<{ ok: boolean; missing: string[] }>(
      page,
      `/api/designs/${design.id}/production-readiness`,
    );
    expect(preReadiness.missing).not.toContain("Development costing");
    expect(preReadiness.missing).not.toContain("Production handoff from Design Head");
    expect(preReadiness.missing).not.toContain("Production instruction");
    // Stage 9 — management decide still required before release
    expect(preReadiness.ok).toBe(false);
    expect(
      preReadiness.missing.some(
        (m) => /approval/i.test(m) || /Management \/ final approval/i.test(m),
      ),
    ).toBe(true);

    await page.locator("#requesterRemark").fill(
      "E2E short Concept→Sketch request management approval without costing (design-312 regression).",
    );
    const requestBtn = page.getByRole("button", { name: /Request management approval/i });
    await expect(requestBtn).toBeEnabled();
    await requestBtn.click();
    await expect(page).toHaveURL(new RegExp(`/designs/${design.id}`), { timeout: 20_000 });

    const pending = await getDesign(page, design.id);
    expect(pending.status).toBe("APPROVAL_PENDING");

    await submitManagementApprovals(page, design.id);

    const approved = await getDesign(page, design.id);
    expect(approved.status).toBe("APPROVED");

    // After approve, ladder may be appended — costing still must not be required
    const postReadiness = await apiGetJson<{ ok: boolean; missing: string[] }>(
      page,
      `/api/designs/${design.id}/production-readiness`,
    );
    expect(postReadiness.missing).not.toContain("Development costing");
  });
});
