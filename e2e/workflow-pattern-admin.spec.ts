/**
 * Admin workflow pattern CRUD and design consumption.
 */
import { expect, test } from "@playwright/test";
import { USERS, apiGetJson, apiPostJson, login } from "./helpers/auth";

test.describe("Workflow pattern admin", () => {
  test("admin creates pattern with metadata and design generates matching tasks", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await login(page, USERS.admin.email, USERS.admin.password);

    const processes = await apiGetJson<
      Array<{
        id: number;
        subProcesses: Array<{ id: number; defaultRoleId?: number | null }>;
      }>
    >(page, "/api/masters/processes");

    const process = processes[0];
    const subProcesses = process?.subProcesses ?? [];
    expect(subProcesses.length).toBeGreaterThanOrEqual(3);

    const roles = await apiGetJson<Array<{ id: number }>>(page, "/api/admin/roles");
    const defaultRoleId = roles[0]?.id;
    expect(defaultRoleId).toBeTruthy();

    const pattern = await apiPostJson<{ id: number; name: string }>(page, "/api/workflow-patterns", {
      name: `E2E Pattern ${Date.now()}`,
      versionNo: 1,
      tasks: subProcesses.slice(0, 3).map((sp, index) => ({
        processId: process.id,
        subProcessId: sp.id,
        defaultRoleId: sp.defaultRoleId ?? defaultRoleId,
        expectedMinutes: 45 + index * 15,
        sequence: index + 1,
        dayOffset: index === 1 ? 2 : 0,
        priority: index === 1 ? "HIGH" : "MEDIUM",
        dependencySequence: index === 2 ? 1 : null,
      })),
    });

    await page.goto("/admin/workflow-patterns");
    await expect(page.getByRole("heading", { name: /Workflow Patterns/i })).toBeVisible();

    await login(page, USERS.designHead.email, USERS.designHead.password);
    const productTypes = await apiGetJson<Array<{ id: number }>>(page, "/api/masters/product-types");
    const seasons = await apiGetJson<Array<{ id: number }>>(page, "/api/masters/seasons");

    const design = await apiPostJson<{ id: string }>(page, "/api/designs", {
      productTypeId: productTypes[0].id,
      seasonId: seasons[0].id,
      collectionName: `Pattern E2E ${Date.now()}`,
      priority: "MEDIUM",
      assignmentMode: "AUTOMATIC",
      workflowPatternId: pattern.id,
    });

    const detail = await apiGetJson<{
      tasks: Array<{
        sequence: number;
        priority: string;
        dependencySequence?: number | null;
        dueAt?: string | null;
      }>;
    }>(page, `/api/designs/${design.id}`);

    expect(detail.tasks).toHaveLength(3);
    const step2 = detail.tasks.find((t) => t.sequence === 2);
    expect(step2?.priority).toBe("HIGH");
    const step3 = detail.tasks.find((t) => t.sequence === 3);
    expect(step3?.dependencySequence).toBe(1);
  });
});
