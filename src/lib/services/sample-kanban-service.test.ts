import { describe, expect, it } from "vitest";
import { resolveSampleKanbanLane } from "@/lib/services/sample-kanban-service";

describe("resolveSampleKanbanLane", () => {
  it("routes terminal sampleDecision to Pass/Hold/Reject lanes", () => {
    expect(
      resolveSampleKanbanLane({
        sampleDecision: "PASS",
        currentStage: "SAMPLE_CHECK",
        status: "ACTIVE",
      }),
    ).toBe("pass");
    expect(
      resolveSampleKanbanLane({
        sampleDecision: "HOLD",
        currentStage: "SKETCH",
        status: "ACTIVE",
      }),
    ).toBe("hold");
    expect(
      resolveSampleKanbanLane({
        sampleDecision: "REJECT",
        currentStage: "MACHINE_SAMPLE",
        status: "REJECTED",
      }),
    ).toBe("reject");
  });

  it("maps currentStage to workflow lanes when decision is pending", () => {
    expect(
      resolveSampleKanbanLane({
        sampleDecision: null,
        currentStage: "SKETCH",
        status: "ACTIVE",
      }),
    ).toBe("sketch");
    expect(
      resolveSampleKanbanLane({
        sampleDecision: null,
        currentStage: "MACHINE_SAMPLE",
        status: "ACTIVE",
      }),
    ).toBe("machine_sample");
    expect(
      resolveSampleKanbanLane({
        sampleDecision: null,
        currentStage: "SKETCH",
        status: "ACTIVE",
        openCorrectionCount: 1,
      }),
    ).toBe("correction");
  });
});
