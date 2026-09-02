/**
 * Workflow readiness: My Tasks only shows released (ASSIGNED+) work per role.
 * Run: npm run test:e2e -- e2e/task-readiness.spec.ts
 */
import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  USERS,
  apiGetJson,
  createDesignViaApi,
  login,
} from "./helpers/auth";

function resetActiveTasks() {
  execSync("npx tsx scripts/reset-e2e-task-state.mjs", { stdio: "pipe" });
}

type MyTask = {
  id: string;
  status: string;
  design: { id: string };
  subProcess: { code?: string; name: string };
  version?: number;
};

test.describe("Task readiness matrix (all employees)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.beforeEach(() => {
    resetActiveTasks();
  });

  test.afterEach(() => {
    resetActiveTasks();
  });

  test("after design create: Sketch ASSIGNED; Design Head has no open Concept Review", async ({
    page,
  }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `Readiness ${Date.now()}`, {
      conceptNote: "Task readiness matrix",
    });

    const dhAssigned = await apiGetJson<MyTask[]>(page, "/api/tasks/my");
    const dhForDesign = dhAssigned.filter((t) => t.design.id === design.id);
    const dhCodes = dhForDesign
      .filter((t) => t.status === "ASSIGNED")
      .map((t) => t.subProcess.code);
    expect(dhCodes).not.toContain("CONCEPT_REVIEW");
    expect(dhCodes).not.toContain("SKETCH_APPROVAL");
    expect(dhCodes).not.toContain("FINAL_APPROVAL");

    await login(page, USERS.sketch.email, USERS.sketch.password);
    const sketchTasks = await apiGetJson<MyTask[]>(page, "/api/tasks/my");
    const sketchForDesign = sketchTasks.filter(
      (t) => t.design.id === design.id && t.status === "ASSIGNED",
    );
    expect(sketchForDesign.length).toBeGreaterThanOrEqual(1);
    expect(sketchForDesign.some((t) => t.subProcess.code === "SKETCH")).toBe(true);

    const roles = [USERS.punch, USERS.machine, USERS.checker, USERS.costing] as const;
    for (const user of roles) {
      await login(page, user.email, user.password);
      const mine = await apiGetJson<MyTask[]>(page, "/api/tasks/my");
      const forDesign = mine.filter((t) => t.design.id === design.id);
      expect(forDesign).toHaveLength(0);
    }
  });

  test("after design create: Design Head still no Sketch Approval until sketch submits", async ({
    page,
  }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `Readiness unlock ${Date.now()}`);

    await login(page, USERS.sketch.email, USERS.sketch.password);
    const sketchTasks = await apiGetJson<MyTask[]>(page, "/api/tasks/my");
    const sketchForDesign = sketchTasks.filter(
      (t) => t.design.id === design.id && t.status === "ASSIGNED",
    );
    expect(sketchForDesign.some((t) => t.subProcess.code === "SKETCH")).toBe(true);

    await login(page, USERS.designHead.email, USERS.designHead.password);
    const dhAfter = await apiGetJson<MyTask[]>(page, "/api/tasks/my");
    const dhForDesign = dhAfter.filter((t) => t.design.id === design.id && t.status === "ASSIGNED");
    expect(dhForDesign.some((t) => t.subProcess.code === "SKETCH_APPROVAL")).toBe(false);
    expect(dhForDesign.some((t) => t.subProcess.code === "FINAL_APPROVAL")).toBe(false);
    expect(dhForDesign.some((t) => t.subProcess.code === "CONCEPT_REVIEW")).toBe(false);
  });
});
