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
  fetchMasters,
  login,
} from "./helpers/auth";

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
    const masters = await fetchMasters(page);
    const design = await apiPostJson<{ id: string; ideaRef: string; status: string }>(
      page,
      "/api/designs",
      {
        productTypeId: masters.productTypeId,
        seasonId: masters.seasonId,
        collectionName: `E2E Collection ${Date.now()}`,
        priority: "MEDIUM",
        conceptNote: "Playwright TC-03",
        assignmentMode: "AUTOMATIC",
        workflowPatternId: masters.workflowPatternId,
      },
    );
    expect(design.id).toBeTruthy();
    expect(design.status).toBe("ACTIVE");
  });

  test("TC-04: only one RUNNING task per employee", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const masters = await fetchMasters(page);
    for (let i = 0; i < 2; i++) {
      await apiPostJson(page, "/api/designs", {
        productTypeId: masters.productTypeId,
        seasonId: masters.seasonId,
        collectionName: `TC04 Concurrency ${Date.now()}-${i}`,
        priority: "MEDIUM",
        assignmentMode: "AUTOMATIC",
        workflowPatternId: masters.workflowPatternId,
      });
    }

    const tasks = await apiGetJson<Array<{ id: string; status: string }>>(page, "/api/tasks/my");
    const assigned = tasks.filter((t) => t.status === "ASSIGNED");
    if (assigned.length < 2) test.skip(true, "Need two assigned tasks for design head");

    await apiPostJson(page, `/api/tasks/${assigned[0].id}/start`, {});
    const secondStart = await page.request.post(`/api/tasks/${assigned[1].id}/start`);
    expect(secondStart.status()).toBe(409);
  });

  test("TC-05: timer start/end records task completion", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const tasks = await apiGetJson<Array<{ id: string; status: string; version: number }>>(
      page,
      "/api/tasks/my",
    );
    const task = tasks.find((t) => t.status === "ASSIGNED" || t.status === "PENDING");
    if (!task) test.skip(true, "No assignable task for design head");

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
    const pending = await apiGetJson<unknown[]>(page, "/api/approvals/pending");
    expect(Array.isArray(pending)).toBe(true);
  });

  test("TC-10: improvement is not classified as mistake correction type", async () => {
    const { MISTAKE_CORRECTION_TYPES } = await import("../src/lib/kpi-metrics");
    expect(MISTAKE_CORRECTION_TYPES).not.toContain("IMPROVEMENT");
  });

  test("TC-11: production release blocked without costing", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const masters = await fetchMasters(page);
    const design = await apiPostJson<{ id: string; status: string; version: number }>(
      page,
      "/api/designs",
      {
        productTypeId: masters.productTypeId,
        seasonId: masters.seasonId,
        collectionName: `TC11 No Cost ${Date.now()}`,
        priority: "LOW",
        assignmentMode: "AUTOMATIC",
        workflowPatternId: masters.workflowPatternId,
      },
    );

    await apiPatchJson(page, `/api/designs/${design.id}/status`, {
      status: "APPROVED",
      version: design.version,
    });

    await login(page, USERS.production.email, USERS.production.password);
    const releaseRes = await page.request.post("/api/production/release", {
      data: { designId: design.id },
      headers: { "Content-Type": "application/json" },
    });
    expect(releaseRes.status()).toBe(422);
  });

  test("TC-12: production release creates ERP handoffs", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const masters = await fetchMasters(page);
    const design = await apiPostJson<{ id: string; version: number }>(page, "/api/designs", {
      productTypeId: masters.productTypeId,
      seasonId: masters.seasonId,
      collectionName: `TC12 Release ${Date.now()}`,
      priority: "HIGH",
      assignmentMode: "AUTOMATIC",
      workflowPatternId: masters.workflowPatternId,
    });

    await apiPatchJson(page, `/api/designs/${design.id}/status`, {
      status: "APPROVED",
      version: design.version,
    });

    await login(page, USERS.costing.email, USERS.costing.password);
    await apiPostJson(page, `/api/designs/${design.id}/costs`, {
      costType: "MATERIAL",
      description: "TC-12 fabric",
      amount: 1500,
    });

    await login(page, USERS.production.email, USERS.production.password);
    await apiPostJson(page, "/api/production/release", { designId: design.id });

    const handoffs = await apiGetJson<Array<{ erpModule: string; status: string; design: { id: string } }>>(
      page,
      `/api/production/handoffs?designId=${design.id}`,
    );
    const primary = handoffs.filter((h) =>
      ["GREY_MATERIAL", "CUTTING", "SALES"].includes(h.erpModule),
    );
    expect(primary).toHaveLength(3);
    expect(primary.every((h) => h.status === "SYNCED")).toBe(true);
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
