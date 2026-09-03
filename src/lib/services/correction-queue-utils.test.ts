import { describe, expect, it } from "vitest";
import {
  CORRECTION_WORKFLOW_STATUSES,
  getAllowedCorrectionStatusOptions,
  isOpenCorrectionStatus,
  isRoutedReworkSatisfied,
  normalizeCorrectionStatus,
} from "@/lib/services/correction-queue-utils";

describe("correction workflow statuses", () => {
  it("exposes only product lifecycle statuses for the Corrections UI", () => {
    expect([...CORRECTION_WORKFLOW_STATUSES]).toEqual([
      "OPEN",
      "IN_PROGRESS",
      "DONE",
      "REJECTED",
    ]);
  });

  it("maps legacy ASSIGNED/CHECKING correction statuses to IN_PROGRESS", () => {
    expect(normalizeCorrectionStatus("ASSIGNED")).toBe("IN_PROGRESS");
    expect(normalizeCorrectionStatus("CHECKING")).toBe("IN_PROGRESS");
    expect(normalizeCorrectionStatus("OPEN")).toBe("OPEN");
    expect(normalizeCorrectionStatus("DONE")).toBe("DONE");
  });

  it("treats legacy aliases as still open", () => {
    expect(isOpenCorrectionStatus("ASSIGNED")).toBe(true);
    expect(isOpenCorrectionStatus("CHECKING")).toBe(true);
    expect(isOpenCorrectionStatus("DONE")).toBe(false);
  });

  it("treats CHECKING routed rework as satisfied for re-check", () => {
    expect(isRoutedReworkSatisfied("CHECKING")).toBe(true);
    expect(isRoutedReworkSatisfied("COMPLETED")).toBe(true);
    expect(isRoutedReworkSatisfied("CORRECTION_REQUIRED")).toBe(false);
    expect(isRoutedReworkSatisfied("ASSIGNED")).toBe(false);
  });

  it.each([
    { status: "OPEN", expected: ["OPEN", "IN_PROGRESS", "DONE", "REJECTED"] },
    { status: "IN_PROGRESS", expected: ["IN_PROGRESS", "DONE", "REJECTED"] },
    { status: "ASSIGNED", expected: ["IN_PROGRESS", "DONE", "REJECTED"] },
    { status: "DONE", expected: ["DONE"] },
    { status: "REJECTED", expected: ["REJECTED"] },
  ])("limits status options for $status", ({ status, expected }) => {
    expect(getAllowedCorrectionStatusOptions(status)).toEqual(expected);
  });
});
