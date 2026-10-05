import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import {
  hasIngestableDesignSuccessMetrics,
  normalizeDesignSuccessPayload,
  parseErpDesignSuccessPayload,
} from "@/lib/services/erp-design-success-payload";
import { getErpIntegrationMode } from "@/lib/services/erp-integration-config";
import { erpFetch } from "@/lib/services/erp-http-client";

describe("design-success payload contract", () => {
  const originalEnv = process.env.ERP_API_BASE_URL;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ERP_API_BASE_URL;
    else process.env.ERP_API_BASE_URL = originalEnv;
  });

  it("maps canonical and alias metric fields", () => {
    expect(
      normalizeDesignSuccessPayload({
        productionQty: 100,
        salesQty: 80,
        salesValue: 50000,
        returnQty: 5,
        marginPercent: 22,
      }),
    ).toMatchObject({
      productionQty: 100,
      salesQty: 80,
      salesValue: 50000,
      returnQty: 5,
      marginPercent: 22,
    });

    expect(
      normalizeDesignSuccessPayload({
        producedQty: 10,
        soldQty: 8,
        revenue: 9000,
        margin: 18,
        returnQty: 1,
      }),
    ).toMatchObject({
      productionQty: 10,
      salesQty: 8,
      salesValue: 9000,
      marginPercent: 18,
      returnQty: 1,
    });
  });

  it("derives marginPercent from salesValue and cost when margin omitted", () => {
    expect(
      normalizeDesignSuccessPayload({
        salesValue: 1000,
        cost: 750,
      }),
    ).toMatchObject({ marginPercent: 25 });
  });

  it("parses partner JSON with Zod coercion", () => {
    const parsed = parseErpDesignSuccessPayload({
      producedQty: "12",
      revenue: "500",
      cost: "400",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(normalizeDesignSuccessPayload(parsed.data).marginPercent).toBe(20);
    }
  });

  it("treats returnQty alone as ingestable", () => {
    expect(hasIngestableDesignSuccessMetrics({ returnQty: 3 })).toBe(true);
    expect(hasIngestableDesignSuccessMetrics({})).toBe(false);
  });

  it("reports simulated mode when ERP_API_BASE_URL is unset", () => {
    delete process.env.ERP_API_BASE_URL;
    expect(getErpIntegrationMode()).toBe("simulated");
  });
});

describe("erpFetch retries", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.ERP_HTTP_MAX_ATTEMPTS = "3";
    process.env.ERP_HTTP_TIMEOUT_MS = "5000";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.ERP_HTTP_MAX_ATTEMPTS;
    delete process.env.ERP_HTTP_TIMEOUT_MS;
  });

  it("retries on 503 then succeeds", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls < 3) {
        return new Response("busy", { status: 503 });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const res = await erpFetch("https://erp.example.test/ping", { method: "GET" });
    expect(res.status).toBe(200);
    expect(calls).toBe(3);
  });

  it("does not retry on 400", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return new Response("bad", { status: 400 });
    }) as typeof fetch;

    const res = await erpFetch("https://erp.example.test/ping", { method: "GET" });
    expect(res.status).toBe(400);
    expect(calls).toBe(1);
  });
});
