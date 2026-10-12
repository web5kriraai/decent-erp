import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-utils", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    details?: unknown;
    code?: string;
    constructor(message: string, status = 500, details?: unknown, code?: string) {
      super(message);
      this.status = status;
      this.details = details;
      this.code = code;
    }
  },
}));

vi.mock("@/lib/tenant", () => ({
  assertSameCompany: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/storage", () => ({
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    designConcept: { findUnique: vi.fn(), delete: vi.fn() },
    taskTimeEvent: { count: vi.fn(), deleteMany: vi.fn() },
    taskArtifact: { findMany: vi.fn(), deleteMany: vi.fn() },
    taskChecklistResult: { deleteMany: vi.fn() },
    taskTimerIdempotency: { deleteMany: vi.fn() },
    designCorrection: { deleteMany: vi.fn() },
    designApproval: { deleteMany: vi.fn() },
    designCost: { deleteMany: vi.fn() },
    designImage: { deleteMany: vi.fn() },
    designComponent: { deleteMany: vi.fn() },
    designCreativityRating: { deleteMany: vi.fn() },
    productionHandoff: { deleteMany: vi.fn() },
    designSuccessMetric: { deleteMany: vi.fn() },
    erpStageRecord: { deleteMany: vi.fn() },
    designMaterialLine: { deleteMany: vi.fn() },
    designBomLine: { updateMany: vi.fn(), deleteMany: vi.fn() },
    designProcess: { findMany: vi.fn(), deleteMany: vi.fn() },
    designSubProcess: { deleteMany: vi.fn() },
    designTask: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { deleteDesign, getDesignDeleteEligibility } from "@/lib/services/design-delete-service";

const idleDesign = {
  id: 8n,
  companyId: 1,
  ideaRef: "IDEA-1",
  collectionName: "Mistake",
  status: "ACTIVE",
  tasks: [{ id: 3n, status: "PENDING" }],
  images: [],
  _count: {
    corrections: 0,
    approvals: 0,
    costs: 0,
    productionHandoffs: 0,
    erpStages: 0,
    materialLines: 0,
    creativityRatings: 0,
  },
};

describe("getDesignDeleteEligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.taskTimeEvent.count.mockResolvedValue(0);
    prismaMock.taskArtifact.findMany.mockResolvedValue([]);
  });

  it("allows a new active design whose tasks have not started", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue(idleDesign);
    const result = await getDesignDeleteEligibility(8n, 1);
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks when time has been logged", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue(idleDesign);
    prismaMock.taskTimeEvent.count.mockResolvedValue(1);
    const result = await getDesignDeleteEligibility(8n, 1);
    expect(result.allowed).toBe(false);
    expect(result.reasons.map((reason) => reason.code)).toContain("TIME_LOGGED");
  });

  it("blocks when a task is completed", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue({
      ...idleDesign,
      tasks: [{ id: 3n, status: "COMPLETED" }],
    });
    const result = await getDesignDeleteEligibility(8n, 1);
    expect(result.reasons.map((reason) => reason.code)).toContain("TASK_STARTED");
  });

  it("blocks when an approval exists", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue({
      ...idleDesign,
      _count: { ...idleDesign._count, approvals: 1 },
    });
    const result = await getDesignDeleteEligibility(8n, 1);
    expect(result.reasons.map((reason) => reason.code)).toContain("APPROVAL");
  });

  it("blocks a later status", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue({
      ...idleDesign,
      status: "APPROVED",
      tasks: [],
    });
    const result = await getDesignDeleteEligibility(8n, 1);
    expect(result.reasons.map((reason) => reason.code)).toContain("STATUS");
  });
});

describe("deleteDesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock),
    );
    prismaMock.taskTimeEvent.count.mockResolvedValue(0);
    prismaMock.taskArtifact.findMany.mockResolvedValue([]);
    prismaMock.designProcess.findMany.mockResolvedValue([]);
    for (const key of [
      "taskChecklistResult",
      "taskArtifact",
      "taskTimeEvent",
      "taskTimerIdempotency",
      "designCorrection",
      "designApproval",
      "designCost",
      "designImage",
      "designComponent",
      "designCreativityRating",
      "productionHandoff",
      "designSuccessMetric",
      "erpStageRecord",
      "designMaterialLine",
      "designBomLine",
      "designProcess",
      "designSubProcess",
      "designTask",
    ] as const) {
      const model = prismaMock[key] as { deleteMany?: ReturnType<typeof vi.fn> };
      model.deleteMany?.mockResolvedValue({ count: 0 });
    }
    prismaMock.designBomLine.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.designConcept.delete.mockResolvedValue({});
  });

  it("refuses to delete when the design is blocked", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue({
      ...idleDesign,
      status: "LIVE",
      tasks: [],
    });
    await expect(deleteDesign(8n, 1, 2, "corr")).rejects.toThrow(/cannot be deleted/i);
    expect(prismaMock.designConcept.delete).not.toHaveBeenCalled();
  });
});
