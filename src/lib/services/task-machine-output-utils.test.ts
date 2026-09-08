import { describe, expect, it } from "vitest";
import {
  isMachineOutputTask,
  MACHINE_FORMAT_OPTIONS,
  hasMachineMetricsInPayload,
  canRecordMachineMetrics,
  pickPreferredSampleOutput,
  formatMachineOutputSummary,
} from "@/lib/services/task-machine-output-utils";

describe("task-machine-output-utils", () => {
  it("detects machine output tasks", () => {
    expect(isMachineOutputTask("MACHINE_SAMPLE")).toBe(true);
    expect(isMachineOutputTask("SAMPLE_RECEIVE")).toBe(true);
    expect(isMachineOutputTask("RESAMPLE")).toBe(true);
    expect(isMachineOutputTask("SKETCH")).toBe(false);
    expect(isMachineOutputTask("SAMPLE_CHECK")).toBe(false);
  });

  it("exposes machine format options", () => {
    expect(MACHINE_FORMAT_OPTIONS.map((o) => o.value)).toEqual(["EMB", "DST", "OTHER"]);
  });

  it("detects machine metrics in payload", () => {
    expect(hasMachineMetricsInPayload({})).toBe(false);
    expect(hasMachineMetricsInPayload({ sampleQty: 3 })).toBe(true);
    expect(hasMachineMetricsInPayload({ machineFormat: "EMB" })).toBe(true);
  });

  it("allows metrics only on machine output tasks", () => {
    expect(canRecordMachineMetrics("MACHINE_SAMPLE", { sampleQty: 1 })).toBe(true);
    expect(canRecordMachineMetrics("SKETCH", { sampleQty: 1 })).toBe(false);
    expect(canRecordMachineMetrics("SKETCH", {})).toBe(true);
  });

  it("prefers SAMPLE_OUTPUT rows that carry metrics", () => {
    const preferred = pickPreferredSampleOutput([
      {
        artifactType: "SAMPLE_OUTPUT",
        uploadedAtUtc: "2026-01-02T00:00:00.000Z",
        storageKey: "file-only",
      },
      {
        artifactType: "SAMPLE_OUTPUT",
        uploadedAtUtc: "2026-01-01T00:00:00.000Z",
        sampleQty: 2,
        machineFormat: "EMB",
      },
    ]);
    expect(preferred?.sampleQty).toBe(2);
    expect(formatMachineOutputSummary(preferred)).toContain("2 pcs");
  });
});
