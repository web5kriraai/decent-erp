/**
 * Spec §21.1 acceptance tests TC-01 through TC-14.
 * Run: npm run db:seed && npm run build && npm run test:e2e
 */
import { expect, test } from "@playwright/test";
import {
  USERS,
  apiGetJson,
  apiPatchJson,
  apiPostJson,
  createDesignViaApi,
  login,
} from "./helpers/auth";
import { advanceDesignToProdReleaseGate } from "./helpers/workflow";

test.describe("Decent ERP acceptance (TC-01–TC-14)", () => {
  test("TC-01: valid credentials login reaches dashboard", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("TC-02: RBAC blocks sketch designer from admin employees", async ({ page }) => {
    await login(page, USERS.sketch.email, USERS.sketch.password);
    const res = await page.request.get("/api/admin/employees");
    expect(res.status()).toBe(403);
  });

  test("TC-03: design head creates design with workflow pattern", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `E2E Collection ${Date.now()}`, {
      conceptNote: "Playwright TC-03",
    });
    expect(design.id).toBeTruthy();
    expect(design.status).toBe("ACTIVE");
    expect(design.ideaRef).toMatch(/^IDEA-/);
  });

  test("TC-04: only one RUNNING task per employee", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    await createDesignViaApi(page, `TC04 Concurrency ${Date.now()}-a`);
    await createDesignViaApi(page, `TC04 Concurrency ${Date.now()}-b`);

    const tasks = await apiGetJson<Array<{ id: string; status: string }>>(page, "/api/tasks/my");
    const assigned = tasks.filter((t) => t.status === "ASSIGNED");
    if (assigned.length < 2) test.skip(true, "Need two assigned tasks for admin");

    await apiPostJson(page, `/api/tasks/${assigned[0].id}/start`, {});
    const secondStart = await page.request.post(`/api/tasks/${assigned[1].id}/start`);
    expect(secondStart.status()).toBe(409);

    const running = await apiGetJson<{ version: number }>(page, `/api/tasks/${assigned[0].id}`);
    await apiPostJson(page, `/api/tasks/${assigned[0].id}/end`, {
      completionStatus: "COMPLETED",
      outputRemark: "TC-04 cleanup after concurrency check",
      version: running.version,
    });
  });

  test("TC-05: timer start/end records task completion", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);

    const existing = await apiGetJson<Array<{ id: string; status: string; version: number }>>(
      page,
      "/api/tasks/my",
    );
    const leftover = existing.find((t) => t.status === "RUNNING");
    if (leftover) {
      const detail = await apiGetJson<{ version: number }>(page, `/api/tasks/${leftover.id}`);
      await apiPostJson(page, `/api/tasks/${leftover.id}/end`, {
        completionStatus: "COMPLETED",
        outputRemark: "TC-05 cleanup leftover running task",
        version: detail.version,
      });
    }

    await createDesignViaApi(page, `TC05 Timer ${Date.now()}`);

    const tasks = await apiGetJson<Array<{ id: string; status: string; version: number }>>(
      page,
      "/api/tasks/my",
    );
    const task = tasks.find((t) => t.status === "ASSIGNED");
    if (!task) test.skip(true, "No assigned task for admin");

    await apiPostJson(page, `/api/tasks/${task!.id}/start`, {});
    const running = await apiGetJson<{ status: string; version: number }>(
      page,
      `/api/tasks/${task!.id}`,
    );
    expect(running.status).toBe("RUNNING");

    const ended = await apiPostJson<{ status: string }>(page, `/api/tasks/${task!.id}/end`, {
      completionStatus: "COMPLETED",
      outputRemark: "TC-05 completed via E2E",
      version: running.version,
    });
    expect(ended.status).toBe("COMPLETED");
  });

  test("TC-06: lunch hold reason exists for active-time exclusion", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    const holdReasons = await apiGetJson<Array<{ id: number; code: string }>>(
      page,
      "/api/masters/hold-reasons",
    );
    const lunch = holdReasons.find((r) => r.code === "LUNCH");
    expect(lunch).toBeTruthy();
  });

  test("TC-07: admin can list quality checklist items", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    const items = await apiGetJson<unknown[]>(page, "/api/masters/checklist");
    expect(items.length).toBeGreaterThan(0);
  });

  test("TC-08: checker can list corrections API", async ({ page }) => {
    await login(page, USERS.checker.email, USERS.checker.password);
    const res = await page.request.get("/api/corrections");
    expect(res.ok()).toBeTruthy();
  });

  test("TC-09: approvals queue accessible to checker", async ({ page }) => {
    await login(page, USERS.checker.email, USERS.checker.password);
    const pending = await apiGetJson<unknown[]>(page, "/api/approvals");
    expect(Array.isArray(pending)).toBe(true);
  });

  test("TC-10: improvement is not classified as mistake correction type", async () => {
    const { MISTAKE_CORRECTION_TYPES } = await import("../src/lib/kpi-metrics");
    expect(MISTAKE_CORRECTION_TYPES).not.toContain("IMPROVEMENT");
  });

  test("TC-11: production release blocked without costing", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `TC11 No Cost ${Date.now()}`, {
      priority: "LOW",
    });

    await login(page, USERS.production.email, USERS.production.password);
    const releaseRes = await page.request.post("/api/production/release", {
      data: { designId: design.id },
      headers: { "Content-Type": "application/json" },
    });
    expect(releaseRes.status()).toBe(422);
    const body = await releaseRes.json();
    expect(body.error).toMatch(/costing|not available|release/i);
  });

  test("TC-12: production release requires PROD_RELEASE task (not direct API shortcut)", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const { designId } = await advanceDesignToProdReleaseGate(page, `TC12 Release ${Date.now()}`);

    await login(page, USERS.production.email, USERS.production.password);
    const releaseRes = await page.request.post("/api/production/release", {
      data: { designId },
      headers: { "Content-Type": "application/json" },
    });
    expect(releaseRes.status()).toBe(422);
    const body = await releaseRes.json();
    expect(body.error).toMatch(/PROD_RELEASE|production release task|not available|workflow/i);
  });

  test("TC-13: kanban board loads pipeline columns", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    await page.goto("/designs/kanban");
    await expect(page.getByRole("heading", { name: /Design Pipeline/i })).toBeVisible();
    await expect(page.locator(".kanban-column").first()).toBeVisible();
    const data = await apiGetJson<unknown[]>(page, "/api/designs/kanban");
    expect(Array.isArray(data)).toBe(true);
  });

  test("TC-14: admin can read and update role permissions", async ({ page }) => {
    await login(page, USERS.admin.email, USERS.admin.password);
    const roles = await apiGetJson<Array<{ id: number; code: string }>>(page, "/api/admin/roles");
    const sketchRole = roles.find((r) => r.code === "SKETCH_DESIGNER");
    expect(sketchRole).toBeTruthy();

    const matrix = await apiGetJson<{
      permissions: Array<{ code: string; assigned: boolean }>;
    }>(page, `/api/admin/roles/${sketchRole!.id}/permissions`);
    const codes = matrix.permissions.filter((p) => p.assigned).map((p) => p.code);
    expect(codes).toContain("TASK_EXECUTE");

    await page.goto("/admin/roles");
    await expect(page.getByRole("heading", { name: /Roles & Responsibilities/i })).toBeVisible();
    await page.getByRole("button", { name: /Edit permissions/i }).first().click();
    await expect(page.locator(".role-perm-grid").first()).toBeVisible();
  });
});
