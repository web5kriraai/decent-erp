import { expect, test } from "@playwright/test";
import { USERS, apiGetJson, login } from "./helpers/auth";

test.describe("ERP in-app chain", () => {
  test("production head can list ERP stage chains", async ({ page }) => {
    await login(page, USERS.production.email, USERS.production.password);
    await page.goto("/production/erp");
    await expect(page.getByRole("heading", { name: "ERP Chain" })).toBeVisible();

    const chains = await apiGetJson<
      Array<{ designId: string; stages: Array<{ erpModule: string }> }>
    >(page, "/api/erp/stages");
    expect(Array.isArray(chains)).toBe(true);
  });

  test("design head cannot open ERP chain API", async ({ page }) => {
    await login(page, USERS.designHead.email, USERS.designHead.password);
    const res = await page.request.get("/api/erp/stages");
    expect(res.status()).toBe(403);
  });

  test("complete without start is rejected", async ({ page }) => {
    await login(page, USERS.production.email, USERS.production.password);
    await page.request.post("/api/erp/stages", {
      data: { backfill: true },
      headers: { "Content-Type": "application/json" },
    });
    const chains = await apiGetJson<
      Array<{
        stages: Array<{ id: string; status: string; erpModule: string }>;
      }>
    >(page, "/api/erp/stages");
    const ready = chains.flatMap((c) => c.stages).find((s) => s.status === "READY");
    test.skip(!ready, "No READY ERP stage available to assert start-before-complete");
    const res = await page.request.post(`/api/erp/stages/${ready!.id}`, {
      data: { action: "complete", qty: 10 },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(409);
  });

  test("costing cannot complete floor stage", async ({ page }) => {
    await login(page, USERS.costing.email, USERS.costing.password);
    const chains = await apiGetJson<
      Array<{ stages: Array<{ id: string; status: string; erpModule: string }> }>
    >(page, "/api/erp/stages");
    const floor = chains
      .flatMap((c) => c.stages)
      .find((s) => s.erpModule === "GREY_MATERIAL" && s.status !== "COMPLETED");
    test.skip(!floor, "No Grey stage available for SoD denial check");
    const res = await page.request.post(`/api/erp/stages/${floor!.id}`, {
      data: { action: floor!.status === "READY" ? "start" : "complete", qty: 5 },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(403);
  });
});
