/**
 * Workflow override — bypass / send-QC and completion summary API.
 */
import { expect, test } from "@playwright/test";
import { USERS, createDesignViaApi, login } from "./helpers/auth";
import {
  bypassDesignToPhase,
  getCompletionSummary,
  getDesign,
  getDesignTaskByCode,
  sendDesignToQcPhase,
} from "./helpers/workflow";

const REASON = "E2E workflow override — urgent business need";

test.describe("Workflow override", () => {
  test("design head can bypass to a later QC phase and marks prior open tasks skipped", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `Bypass ${Date.now()}`);

    const punchCheck = await getDesignTaskByCode(page, design.id, "PUNCH_CHECK");
    expect(punchCheck).toBeTruthy();

    await bypassDesignToPhase(page, design.id, punchCheck!.id, REASON);

    const updated = await getDesign(page, design.id);
    const skipped = updated.tasks.filter((t) => t.status === "SKIPPED");
    expect(skipped.length).toBeGreaterThan(0);
    expect(updated.tasks.find((t) => t.id === punchCheck!.id)?.status).toBe("ASSIGNED");
    expect(updated.currentStage).toBe("PUNCH_CHECK");
  });

  test("design head can send design directly to sample check QC", async ({ page }) => {
    test.setTimeout(120_000);

    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `Send QC ${Date.now()}`);

    const sampleCheck = await getDesignTaskByCode(page, design.id, "SAMPLE_CHECK");
    expect(sampleCheck).toBeTruthy();

    await sendDesignToQcPhase(page, design.id, sampleCheck!.id, REASON);

    const updated = await getDesign(page, design.id);
    expect(updated.tasks.find((t) => t.id === sampleCheck!.id)?.status).toBe("ASSIGNED");
    expect(updated.currentStage).toBe("SAMPLE_CHECK");
  });

  test("sample checker cannot bypass workflow", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `Denied ${Date.now()}`);
    const costing = await getDesignTaskByCode(page, design.id, "COSTING");

    await login(page, USERS.checker.email, USERS.checker.password);
    const res = await page.request.post(`/api/designs/${design.id}/bypass`, {
      data: { targetTaskId: costing!.id, reason: REASON },
    });
    expect(res.status()).toBe(403);
  });

  test("completion summary reports override history", async ({ page }) => {
    test.setTimeout(120_000);

    await login(page, USERS.designHead.email, USERS.designHead.password);
    const design = await createDesignViaApi(page, `Summary ${Date.now()}`);
    const liveReview = await getDesignTaskByCode(page, design.id, "LIVE_REVIEW");

    await bypassDesignToPhase(page, design.id, liveReview!.id, REASON);

    const summary = await getCompletionSummary(page, design.id);
    expect(summary.overrideHistory.some((h) => h.action === "WORKFLOW_BYPASS")).toBe(true);
    expect(summary.phases.some((p) => p.status === "SKIPPED")).toBe(true);
  });
});
