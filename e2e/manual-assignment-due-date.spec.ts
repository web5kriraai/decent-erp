import { expect, test } from "@playwright/test";
import { login, USERS, apiGetJson, apiPostJson, fetchMasters } from "./helpers/auth";

test.describe("Manual assignment + due date", () => {
  test("creates design with manual tasks and persisted dueAt", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);

    const masters = await fetchMasters(page);
    const processes = await apiGetJson<
      Array<{
        id: number;
        name: string;
        subProcesses: Array<{ id: number; name: string }>;
      }>
    >(page, "/api/masters/processes");

    const process = processes[0];
    expect(process?.subProcesses?.length).toBeGreaterThan(0);
    const subA = process.subProcesses[0];
    const subB = process.subProcesses[1] ?? process.subProcesses[0];

    const dueA = "2026-08-05";
    const dueB = "2026-08-08";

    const design = await apiPostJson<{ id: string; ideaRef: string }>(page, "/api/designs", {
      productTypeId: masters.productTypeId,
      seasonId: masters.seasonId,
      collectionName: `Manual Due ${Date.now()}`,
      priority: "HIGH",
      assignmentMode: "MANUAL",
      manualTasks: [
        {
          processId: process.id,
          subProcessId: subA.id,
          expectedMinutes: 120,
          sequence: 1,
          dueAt: dueA,
          priority: "HIGH",
        },
        {
          processId: process.id,
          subProcessId: subB.id,
          expectedMinutes: 240,
          sequence: 2,
          dueAt: dueB,
          priority: "MEDIUM",
        },
      ],
    });

    const detail = await apiGetJson<{
      id: string;
      tasks: Array<{ sequence: number; dueAt: string | null; expectedMinutes: number; priority: string }>;
    }>(page, `/api/designs/${design.id}`);

    expect(detail.tasks.length).toBeGreaterThanOrEqual(2);
    const bySeq = [...detail.tasks].sort((a, b) => a.sequence - b.sequence);
    expect(bySeq[0].dueAt?.startsWith(dueA)).toBe(true);
    expect(bySeq[0].expectedMinutes).toBe(120);
    expect(bySeq[0].priority).toBe("HIGH");
    expect(bySeq[1].dueAt?.startsWith(dueB)).toBe(true);
    expect(bySeq[1].expectedMinutes).toBe(240);
  });

  test("automatic create respects SAME_DAY taskDateMode", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const masters = await fetchMasters(page);

    const design = await apiPostJson<{ id: string }>(page, "/api/designs", {
      productTypeId: masters.productTypeId,
      seasonId: masters.seasonId,
      collectionName: `SameDay ${Date.now()}`,
      priority: "MEDIUM",
      assignmentMode: "AUTOMATIC",
      workflowPatternId: masters.workflowPatternId,
      taskDateMode: "SAME_DAY",
    });

    const detail = await apiGetJson<{
      tasks: Array<{ plannedStart?: string | null; dueAt: string | null; sequence: number }>;
    }>(page, `/api/designs/${design.id}`);

    const starts = detail.tasks
      .map((t) => (t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 10) : null))
      .filter(Boolean);
    expect(starts.length).toBeGreaterThan(1);
    // Under SAME_DAY, due dates share the same calendar day (minutes may differ).
    const uniqueDays = new Set(starts);
    expect(uniqueDays.size).toBe(1);
  });

  test("workflow pattern preview returns resolved assignee names", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const masters = await fetchMasters(page);
    const preview = await apiGetJson<{
      tasks: Array<{ assigneeName: string; stage: string }>;
    }>(page, `/api/workflow-patterns/${masters.workflowPatternId}/preview?taskDateMode=SEQUENTIAL`);

    expect(preview.tasks.length).toBeGreaterThan(0);
    expect(preview.tasks[0].assigneeName.length).toBeGreaterThan(0);
    expect(preview.tasks[0].stage.length).toBeGreaterThan(0);
  });
});
