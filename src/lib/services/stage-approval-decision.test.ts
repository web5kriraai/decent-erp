import { describe, expect, it } from "vitest";
import {
  WORK_CODE_BY_APPROVAL,
  workSubProcessCodeForApproval,
} from "@/lib/services/stage-approval-queue";

describe("stage approval reject routing", () => {
  it("maps punch check reject to punch work task", () => {
    expect(workSubProcessCodeForApproval("PUNCH_CHECK")).toBe("PUNCH");
    expect(WORK_CODE_BY_APPROVAL.PUNCH_CHECK).toBe("PUNCH");
  });

  it("maps sketch approval reject to sketch work task", () => {
    expect(workSubProcessCodeForApproval("SKETCH_APPROVAL")).toBe("SKETCH");
  });

  it("maps sample check reject to machine sample work task", () => {
    expect(workSubProcessCodeForApproval("SAMPLE_CHECK")).toBe("MACHINE_SAMPLE");
  });

  it("returns null for unknown approval codes", () => {
    expect(workSubProcessCodeForApproval("UNKNOWN_STAGE")).toBeNull();
  });
});
