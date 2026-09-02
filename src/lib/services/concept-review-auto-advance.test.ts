import { describe, expect, it, vi } from "vitest";
import {
  findStuckConceptReviewTask,
  type StuckConceptReview,
} from "@/lib/services/concept-review-auto-advance";

vi.mock("@/lib/db", () => ({
  prisma: {
    designTask: { findMany: vi.fn(), findFirst: vi.fn() },
    designConcept: { update: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/task-service", () => ({
  completeStageApproval: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { autoAdvanceConceptReview } from "@/lib/services/concept-review-auto-advance";
import { completeStageApproval } from "@/lib/services/task-service";

describe("findStuckConceptReviewTask", () => {
  it("returns concept review when open and sketch is pending", async () => {
    vi.mocked(prisma.designTask.findMany).mockResolvedValue([
      {
        id: BigInt(1),
        version: 2,
        status: "ASSIGNED",
        dependencySequence: 1,
        sequence: 1,
        subProcess: { code: "CONCEPT_REVIEW" },
      },
      {
        id: BigInt(2),
        version: 1,
        status: "PENDING",
        dependencySequence: 2,
        sequence: 2,
        subProcess: { code: "SKETCH" },
      },
    ] as never);

    const result = await findStuckConceptReviewTask(BigInt(99));
    expect(result).toEqual({ taskId: BigInt(1), version: 2, status: "ASSIGNED" } satisfies StuckConceptReview);
  });

  it("returns null when concept review is already completed", async () => {
    vi.mocked(prisma.designTask.findMany).mockResolvedValue([
      {
        id: BigInt(1),
        version: 3,
        status: "COMPLETED",
        dependencySequence: 1,
        sequence: 1,
        subProcess: { code: "CONCEPT_REVIEW" },
      },
      {
        id: BigInt(2),
        version: 2,
        status: "ASSIGNED",
        dependencySequence: 2,
        sequence: 2,
        subProcess: { code: "SKETCH" },
      },
    ] as never);

    const result = await findStuckConceptReviewTask(BigInt(99));
    expect(result).toBeNull();
  });

  it("returns null when design has no concept review task", async () => {
    vi.mocked(prisma.designTask.findMany).mockResolvedValue([
      {
        id: BigInt(2),
        version: 1,
        status: "ASSIGNED",
        dependencySequence: 1,
        sequence: 1,
        subProcess: { code: "SKETCH" },
      },
    ] as never);

    const result = await findStuckConceptReviewTask(BigInt(99));
    expect(result).toBeNull();
  });
});

describe("autoAdvanceConceptReview", () => {
  it("passes actor role code to completeStageApproval", async () => {
    vi.mocked(prisma.designTask.findMany).mockResolvedValue([
      {
        id: BigInt(1),
        version: 2,
        status: "ASSIGNED",
        dependencySequence: 1,
        sequence: 1,
        subProcess: { code: "CONCEPT_REVIEW" },
      },
      {
        id: BigInt(2),
        version: 1,
        status: "PENDING",
        dependencySequence: 2,
        sequence: 2,
        subProcess: { code: "SKETCH" },
      },
    ] as never);
    vi.mocked(prisma.designConcept.update).mockResolvedValue({} as never);
    vi.mocked(completeStageApproval).mockResolvedValue({} as never);

    await autoAdvanceConceptReview(BigInt(10), 5, "corr-1", { roleCode: "DESIGN_HEAD" });

    expect(completeStageApproval).toHaveBeenCalledWith(
      BigInt(1),
      5,
      expect.objectContaining({ decision: "APPROVED" }),
      "corr-1",
      "DESIGN_HEAD",
    );
  });
});
