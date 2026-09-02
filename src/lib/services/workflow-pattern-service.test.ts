import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-utils", () => ({
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 500) {
      super(message);
      this.name = "ApiError";
      this.statusCode = statusCode;
    }
  },
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    designSubProcessMaster: { findFirst: vi.fn() },
    role: { findUnique: vi.fn() },
    productType: { findUnique: vi.fn() },
    workflowPattern: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    workflowPatternTask: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/audit", () => ({
  writeAuditLogDirect: vi.fn().mockResolvedValue(undefined),
}));

import {
  cloneWorkflowPattern,
  createWorkflowPattern,
  updateWorkflowPatternTasks,
  validatePatternTasks,
} from "@/lib/services/workflow-pattern-service";

const baseTask = {
  processId: 1,
  subProcessId: 10,
  defaultRoleId: 2,
  expectedMinutes: 60,
  sequence: 1,
};

describe("validatePatternTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.designSubProcessMaster.findFirst.mockResolvedValue({ id: 10 });
    prismaMock.role.findUnique.mockResolvedValue({ id: 2 });
  });

  it("rejects duplicate sequence values", async () => {
    await expect(
      validatePatternTasks([
        { ...baseTask, sequence: 1 },
        { ...baseTask, subProcessId: 11, sequence: 1 },
      ]),
    ).rejects.toThrow(/unique/i);
  });

  it("rejects invalid sub-process and process pairing", async () => {
    prismaMock.designSubProcessMaster.findFirst.mockResolvedValue(null);
    await expect(validatePatternTasks([baseTask])).rejects.toThrow(/does not belong/);
  });
});

describe("createWorkflowPattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.designSubProcessMaster.findFirst.mockResolvedValue({ id: 10 });
    prismaMock.role.findUnique.mockResolvedValue({ id: 2 });
    prismaMock.productType.findUnique.mockResolvedValue({ id: 1 });
  });

  it("persists dayOffset, priority, and dependencySequence", async () => {
    const createFn = vi.fn().mockResolvedValue({
      id: 99,
      name: "Test Pattern",
      versionNo: 1,
      tasks: [],
    });
    prismaMock.$transaction.mockImplementation(async (fn) =>
      fn({ workflowPattern: { create: createFn } }),
    );

    await createWorkflowPattern(
      {
        name: "Test Pattern",
        productTypeId: 1,
        tasks: [
          {
            ...baseTask,
            dayOffset: 2,
            priority: "HIGH",
            dependencySequence: null,
          },
        ],
      },
      1,
      "corr-1",
    );

    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tasks: {
            create: [
              expect.objectContaining({
                dayOffset: 2,
                priority: "HIGH",
                dependencySequence: null,
              }),
            ],
          },
        }),
      }),
    );
  });
});

describe("updateWorkflowPatternTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.designSubProcessMaster.findFirst.mockResolvedValue({ id: 10 });
    prismaMock.role.findUnique.mockResolvedValue({ id: 2 });
    prismaMock.workflowPattern.findUnique.mockResolvedValue({
      id: 5,
      tasks: [{ sequence: 1 }],
    });
    prismaMock.$transaction.mockImplementation(async (fn) =>
      fn({
        workflowPatternTask: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        workflowPattern: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 5,
            name: "Updated",
            tasks: [{ sequence: 1, dayOffset: 1, priority: "LOW" }],
          }),
        },
      }),
    );
  });

  it("replaces tasks atomically", async () => {
    const result = await updateWorkflowPatternTasks(
      5,
      [{ ...baseTask, dayOffset: 1, priority: "LOW" }],
      1,
      "corr-2",
    );
    expect(result.tasks).toHaveLength(1);
  });
});

describe("cloneWorkflowPattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.workflowPattern.findUnique.mockResolvedValue({
      id: 3,
      name: "Standard",
      versionNo: 1,
      productTypeId: 1,
      tasks: [
        {
          processId: 1,
          subProcessId: 10,
          defaultRoleId: 2,
          expectedMinutes: 60,
          sequence: 1,
          dayOffset: 0,
          priority: "MEDIUM",
          dependencySequence: null,
        },
      ],
    });
  });

  it("creates new version and deactivates source", async () => {
    const updateFn = vi.fn().mockResolvedValue({});
    const createFn = vi.fn().mockResolvedValue({
      id: 4,
      name: "Standard",
      versionNo: 2,
      active: true,
      tasks: [],
      productType: null,
    });
    prismaMock.$transaction.mockImplementation(async (fn) =>
      fn({
        workflowPattern: { update: updateFn, create: createFn },
      }),
    );

    const cloned = await cloneWorkflowPattern(3, 1, "corr-3");
    expect(updateFn).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { active: false },
    });
    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ versionNo: 2, active: true }),
      }),
    );
    expect(cloned.versionNo).toBe(2);
  });
});
