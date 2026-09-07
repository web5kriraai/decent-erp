import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendProductionStageTasks,
  ensureProductionLadderAndUnlock,
  unlockProductionHandoffTask,
} from "@/lib/services/production-handoff-unlock";

vi.mock("@/lib/notifications", () => ({
  enqueueOutboxAndNotify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/assignment-service", () => ({
  resolveEmployeeForRole: vi.fn().mockResolvedValue(42),
}));

vi.mock("@/lib/errors/create-app-error", () => {
  class MockAppError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, _details?: unknown, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    createAppError: (code: string, status: number, details?: unknown, message?: string) =>
      new MockAppError(message ?? code, status, details, code),
    notFound: (code?: string) => new MockAppError(code ?? "NOT_FOUND", 404),
    businessRule: (code: string, details?: unknown, message?: string) =>
      new MockAppError(message ?? code, 422, details, code),
  };
});

const fullSubs = {
  PROD_HANDOFF: { id: 101, processId: 1 },
  PROD_INSTRUCTION: { id: 102, processId: 1 },
  PROD_RELEASE: { id: 103, processId: 1 },
  LIVE_REVIEW: { id: 104, processId: 1 },
};
const fullRoles = {
  DESIGN_HEAD: { id: 1 },
  PRODUCTION_HEAD: { id: 2 },
  MANAGEMENT: { id: 3 },
};

function ladderMasters() {
  return [
    {
      id: 101,
      code: "PROD_HANDOFF",
      processId: 1,
      capabilities: { unlockAfterDesignApproved: true },
      defaultRole: { code: "DESIGN_HEAD" },
    },
    {
      id: 102,
      code: "PROD_INSTRUCTION",
      processId: 1,
      capabilities: { unlockAfterDesignApproved: true },
      defaultRole: { code: "PRODUCTION_HEAD" },
    },
    {
      id: 103,
      code: "PROD_RELEASE",
      processId: 1,
      capabilities: { unlockAfterDesignApproved: true },
      defaultRole: { code: "PRODUCTION_HEAD" },
    },
    {
      id: 104,
      code: "LIVE_REVIEW",
      processId: 1,
      capabilities: { unlockAfterDesignApproved: true },
      defaultRole: { code: "MANAGEMENT" },
    },
  ];
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    designTask: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _max: { sequence: 8, dependencySequence: 8 } }),
      create: vi.fn().mockResolvedValue({ id: 1n }),
      update: vi.fn().mockResolvedValue({ id: 1n }),
    },
    designConcept: {
      findUnique: vi.fn().mockResolvedValue({ designHeadEmployeeId: 7 }),
    },
    designSubProcessMaster: {
      findMany: vi.fn().mockResolvedValue(ladderMasters()),
    },
    role: {
      findMany: vi.fn().mockResolvedValue([
        { id: 1, code: "DESIGN_HEAD" },
        { id: 2, code: "PRODUCTION_HEAD" },
        { id: 3, code: "MANAGEMENT" },
      ]),
    },
    ...overrides,
  };
}

describe("appendProductionStageTasks", () => {
  it("is a no-op when full ladder already exists", async () => {
    const tx = makeTx();
    tx.designTask.findMany.mockResolvedValue(
      ["PROD_HANDOFF", "PROD_INSTRUCTION", "PROD_RELEASE", "LIVE_REVIEW"].map((code) => ({
        subProcess: { code },
      })),
    );
    const result = await appendProductionStageTasks(tx as never, 1n, fullSubs, fullRoles);
    expect(result.created).toBe(0);
    expect(tx.designTask.create).not.toHaveBeenCalled();
  });

  it("creates four production ladder tasks when missing", async () => {
    const tx = makeTx();
    const result = await appendProductionStageTasks(tx as never, 1n, fullSubs, fullRoles);
    expect(result.created).toBe(4);
    expect(tx.designTask.create).toHaveBeenCalledTimes(4);
    expect(tx.designTask.create.mock.calls[0][0].data.subProcessId).toBe(101);
    expect(tx.designTask.create.mock.calls[0][0].data.status).toBe("PENDING");
  });

  it("fills only missing stages when ladder is partial", async () => {
    const tx = makeTx();
    tx.designTask.findMany.mockResolvedValue([{ subProcess: { code: "PROD_HANDOFF" } }]);
    const result = await appendProductionStageTasks(tx as never, 1n, fullSubs, fullRoles);
    expect(result.created).toBe(3);
    expect(tx.designTask.create).toHaveBeenCalledTimes(3);
  });

  it("throws when required ladder roles are missing", async () => {
    const tx = makeTx();
    await expect(
      appendProductionStageTasks(tx as never, 1n, fullSubs, {
        DESIGN_HEAD: fullRoles.DESIGN_HEAD,
      }),
    ).rejects.toThrow(/missing roles/i);
  });
});

describe("ensureProductionLadderAndUnlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appends ladder then unlocks PENDING handoff (Spec 8-Step path)", async () => {
    const tx = makeTx();
    // 1) existing ladder check during append → empty
    // 2) PENDING candidates during unlock → handoff row
    tx.designTask.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 55n,
          assignedEmployeeId: null,
          assignedRoleId: 1,
          subProcess: { code: "PROD_HANDOFF", capabilities: { unlockAfterDesignApproved: true } },
        },
      ]);

    const result = await ensureProductionLadderAndUnlock(tx as never, 1n, "corr-e2e");

    expect(result.appended).toBe(true);
    expect(result.unlockedTaskId).toBe(55n);
    expect(tx.designTask.create).toHaveBeenCalled();
    expect(tx.designTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 55n },
        data: expect.objectContaining({ status: "ASSIGNED" }),
      }),
    );
  });

  it("does not report appended when full ladder already existed", async () => {
    const tx = makeTx();
    tx.designTask.findMany
      .mockResolvedValueOnce(
        ["PROD_HANDOFF", "PROD_INSTRUCTION", "PROD_RELEASE", "LIVE_REVIEW"].map((code) => ({
          subProcess: { code },
        })),
      )
      .mockResolvedValueOnce([
        {
          id: 10n,
          assignedEmployeeId: 7,
          assignedRoleId: 1,
          subProcess: { code: "PROD_HANDOFF", capabilities: { unlockAfterDesignApproved: true } },
        },
      ]);

    const result = await ensureProductionLadderAndUnlock(tx as never, 1n, "corr-existing");

    expect(result.appended).toBe(false);
    expect(result.unlockedTaskId).toBe(10n);
    expect(tx.designTask.create).not.toHaveBeenCalled();
  });
});

describe("unlockProductionHandoffTask", () => {
  it("returns null when no PENDING handoff", async () => {
    const tx = makeTx();
    tx.designTask.findMany.mockResolvedValue([]);
    const id = await unlockProductionHandoffTask(tx as never, 1n, "c");
    expect(id).toBeNull();
  });
});

