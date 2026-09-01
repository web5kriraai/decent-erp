import { describe, expect, it } from "vitest";
import {
  isMachineOutputTask,
  MACHINE_FORMAT_OPTIONS,
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
});
