import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const DEMO_PASSWORD = "Demo@123";
export const ADMIN_PASSWORD = "Admin@123";

export const USERS = {
  admin: { email: "admin@decent-erp.local", password: ADMIN_PASSWORD },
  designHead: { email: "designhead@decent-erp.local", password: DEMO_PASSWORD },
  sketch: { email: "sketch@decent-erp.local", password: DEMO_PASSWORD },
  checker: { email: "checker@decent-erp.local", password: DEMO_PASSWORD },
  costing: { email: "costing@decent-erp.local", password: DEMO_PASSWORD },
  production: { email: "production@decent-erp.local", password: DEMO_PASSWORD },
  machine: { email: "machine@decent-erp.local", password: DEMO_PASSWORD },
} as const;

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible({
    timeout: 15_000,
  });
}

type ApiEnvelope<T> = { data: T; correlationId?: string };

export async function apiGetJson<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(path);
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok()) throw new Error(`GET ${path} failed: ${res.status()}`);
  return json.data;
}

export async function apiPostJson<T>(page: Page, path: string, body?: unknown): Promise<T> {
  const res = await page.request.post(path, {
    data: body,
    headers: { "Content-Type": "application/json" },
  });
  const json = (await res.json()) as ApiEnvelope<T> & { error?: string };
  if (!res.ok()) throw new Error(`POST ${path} failed (${res.status()}): ${json.error ?? ""}`);
  return json.data;
}

export async function apiPatchJson<T>(page: Page, path: string, body: unknown): Promise<T> {
  const res = await page.request.patch(path, {
    data: body,
    headers: { "Content-Type": "application/json" },
  });
  const json = (await res.json()) as ApiEnvelope<T> & { error?: string };
  if (!res.ok()) throw new Error(`PATCH ${path} failed (${res.status()}): ${json.error ?? ""}`);
  return json.data;
}

export async function fetchMasters(page: Page) {
  const [productTypes, seasons, patterns] = await Promise.all([
    apiGetJson<Array<{ id: number; code: string }>>(page, "/api/masters/product-types"),
    apiGetJson<Array<{ id: number; code: string }>>(page, "/api/masters/seasons"),
    apiGetJson<Array<{ id: number; name: string }>>(page, "/api/workflow-patterns"),
  ]);
  return {
    productTypeId: productTypes.find((p) => p.code === "SAREE")?.id ?? productTypes[0].id,
    seasonId: seasons[0].id,
    workflowPatternId: patterns[0].id,
  };
}
