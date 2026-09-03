import { describe, expect, it, afterEach } from "vitest";
import {
  hasIngestableDesignSuccessMetrics,
  normalizeDesignSuccessPayload,
} from "@/lib/services/erp-design-success-payload";
import { getErpIntegrationMode } from "@/lib/services/erp-integration-config";

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

  it("treats returnQty alone as ingestable", () => {
    expect(hasIngestableDesignSuccessMetrics({ returnQty: 3 })).toBe(true);
    expect(hasIngestableDesignSuccessMetrics({})).toBe(false);
  });

  it("reports simulated mode when ERP_API_BASE_URL is unset", () => {
    delete process.env.ERP_API_BASE_URL;
    expect(getErpIntegrationMode()).toBe("simulated");
  });
});
