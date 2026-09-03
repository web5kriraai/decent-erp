import { describe, expect, it, afterEach } from "vitest";
import {
  ERP_MODULE_SYNC_ORDER,
  erpSyncOrderMessage,
  getErpIntegrationMode,
  getHandoffDisplayStatus,
  isSimulatedErpReference,
  PRIMARY_ERP_MODULES,
  DOWNSTREAM_ERP_MODULES,
} from "@/lib/services/erp-integration-config";

describe("erp-integration-config", () => {
  const originalEnv = process.env.ERP_API_BASE_URL;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ERP_API_BASE_URL;
    else process.env.ERP_API_BASE_URL = originalEnv;
  });

  it("detects simulated ERP references", () => {
    expect(isSimulatedErpReference("LOCAL-GREY_MATERIAL-DN-1-123")).toBe(true);
    expect(isSimulatedErpReference("ERP-SALES-99")).toBe(false);
    expect(isSimulatedErpReference(null)).toBe(false);
  });

  it("reports simulated mode without ERP_API_BASE_URL", () => {
    delete process.env.ERP_API_BASE_URL;
    expect(getErpIntegrationMode()).toBe("simulated");
  });

  it("reports live mode when ERP_API_BASE_URL is set", () => {
    process.env.ERP_API_BASE_URL = "https://erp.example.com";
    expect(getErpIntegrationMode()).toBe("live");
  });

  it("orders modules primary then downstream", () => {
    expect(ERP_MODULE_SYNC_ORDER[0]).toBe("GREY_MATERIAL");
    expect(ERP_MODULE_SYNC_ORDER).toContain("SALES");
    expect(ERP_MODULE_SYNC_ORDER).toContain("SALES_RETURN");
    expect(ERP_MODULE_SYNC_ORDER).toContain("ACCOUNTS");
    expect(ERP_MODULE_SYNC_ORDER.indexOf("SALES")).toBeLessThan(
      ERP_MODULE_SYNC_ORDER.indexOf("SALES_RETURN"),
    );
    expect(ERP_MODULE_SYNC_ORDER.indexOf("SALES_RETURN")).toBeLessThan(
      ERP_MODULE_SYNC_ORDER.indexOf("ACCOUNTS"),
    );
    expect(ERP_MODULE_SYNC_ORDER).toHaveLength(9);
    for (const erpModule of PRIMARY_ERP_MODULES) {
      expect(ERP_MODULE_SYNC_ORDER).toContain(erpModule);
    }
    for (const erpModule of DOWNSTREAM_ERP_MODULES) {
      expect(ERP_MODULE_SYNC_ORDER).toContain(erpModule);
    }
  });

  it("maps handoff rows to display status including LOCAL", () => {
    expect(getHandoffDisplayStatus({ status: "QUEUED" })).toBe("QUEUED");
    expect(getHandoffDisplayStatus({ status: "FAILED" })).toBe("FAILED");
    expect(
      getHandoffDisplayStatus({
        status: "SYNCED",
        erpReference: "LOCAL-GREY_MATERIAL-DN-1",
      }),
    ).toBe("LOCAL");
    expect(
      getHandoffDisplayStatus({ status: "SYNCED", erpReference: "ERP-SALES-1" }),
    ).toBe("SYNCED");
  });

  it("describes full sync order in mode message", () => {
    expect(erpSyncOrderMessage("simulated")).toContain("GREY_MATERIAL");
    expect(erpSyncOrderMessage("simulated")).toContain("SALES_RETURN");
    expect(erpSyncOrderMessage("simulated")).toContain("ACCOUNTS");
    expect(erpSyncOrderMessage("live")).toMatch(/Live ERP sync order/);
  });
});
