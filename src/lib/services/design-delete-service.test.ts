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
  isDesignStorageKey: (designId: bigint | string, key: string) =>
    key.startsWith(`designs/${designId}/`),
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    designConcept: { findUnique: vi.fn(), delete: vi.fn() },
    taskTimeEvent: { count: vi.fn() },
    taskArtifact: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { writeAuditLog } from "@/lib/audit";
import { deleteObject } from "@/lib/storage";
import { deleteDesign, getDesignDeleteEligibility } from "@/lib/services/design-delete-service";

const owner = { employeeId: 2, permissions: ["DESIGN_CREATE"] };
const stranger = { employeeId: 99, permissions: ["DESIGN_CREATE"] };
const admin = { employeeId: 99, permissions: ["DESIGN_CREATE", "MASTER_ADMIN"] };

const idleDesign = {
  id: 8n,
  companyId: 1,
  ideaRef: "IDEA-1",
  collectionName: "Mistake",
  status: "ACTIVE",
  createdById: 2,
  designHeadEmployeeId: 5,
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
    const result = await getDesignDeleteEligibility(8n, 1, owner);
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks when time has been logged", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue(idleDesign);
    prismaMock.taskTimeEvent.count.mockResolvedValue(1);
    const result = await getDesignDeleteEligibility(8n, 1, owner);
    expect(result.allowed).toBe(false);
    expect(result.reasons.map((reason) => reason.code)).toContain("TIME_LOGGED");
  });

  it("blocks when a task is completed", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue({
      ...idleDesign,
      tasks: [{ id: 3n, status: "COMPLETED" }],
    });
    const result = await getDesignDeleteEligibility(8n, 1, owner);
    expect(result.reasons.map((reason) => reason.code)).toContain("TASK_STARTED");
  });

  it("blocks when an approval exists", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue({
      ...idleDesign,
      _count: { ...idleDesign._count, approvals: 1 },
    });
    const result = await getDesignDeleteEligibility(8n, 1, owner);
    expect(result.reasons.map((reason) => reason.code)).toContain("APPROVAL");
  });

  it("blocks a later status", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue({
      ...idleDesign,
      status: "APPROVED",
      tasks: [],
    });
    const result = await getDesignDeleteEligibility(8n, 1, owner);
    expect(result.reasons.map((reason) => reason.code)).toContain("STATUS");
  });

  it("blocks someone who is not the creator, design head, or an admin", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue(idleDesign);
    const result = await getDesignDeleteEligibility(8n, 1, stranger);
    expect(result.reasons.map((reason) => reason.code)).toEqual(["NOT_OWNER"]);
  });

  it("allows the design head and admins", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue(idleDesign);
    const head = await getDesignDeleteEligibility(8n, 1, {
      employeeId: 5,
      permissions: ["DESIGN_CREATE"],
    });
    const asAdmin = await getDesignDeleteEligibility(8n, 1, admin);
    expect(head.allowed).toBe(true);
    expect(asAdmin.allowed).toBe(true);
  });
});

describe("deleteDesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock),
    );
    prismaMock.$queryRaw.mockResolvedValue([{ design_id: 8n }]);
    prismaMock.taskTimeEvent.count.mockResolvedValue(0);
    prismaMock.taskArtifact.findMany.mockResolvedValue([]);
    prismaMock.designConcept.delete.mockResolvedValue({});
  });

  it("refuses to delete when the design is blocked", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue({
      ...idleDesign,
      status: "LIVE",
      tasks: [],
    });
    await expect(deleteDesign(8n, 1, owner, "corr")).rejects.toThrow(/cannot be deleted/i);
    expect(prismaMock.designConcept.delete).not.toHaveBeenCalled();
  });

  it("scopes the design lock to the caller's company and stops when it matches nothing", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    await expect(deleteDesign(8n, 1, owner, "corr")).rejects.toMatchObject({ status: 404 });
    const [strings, ...values] = prismaMock.$queryRaw.mock.calls[0] as [string[], ...unknown[]];
    expect(strings.join("?")).toMatch(/design_concepts[\s\S]*company_id[\s\S]*FOR UPDATE/);
    expect(values).toEqual([8n, 1]);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.designConcept.delete).not.toHaveBeenCalled();
  });

  it("retries when Postgres aborts the delete as a deadlock", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue(idleDesign);
    prismaMock.$transaction
      .mockRejectedValueOnce(Object.assign(new Error("deadlock"), { code: "P2034" }))
      .mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
    await expect(deleteDesign(8n, 1, owner, "corr")).resolves.toEqual({ deleted: true });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("does not retry other errors", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error("boom"));
    await expect(deleteDesign(8n, 1, owner, "corr")).rejects.toThrow("boom");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("refuses with 403 when the caller does not own the design", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue(idleDesign);
    await expect(deleteDesign(8n, 1, stranger, "corr")).rejects.toMatchObject({ status: 403 });
    expect(prismaMock.designConcept.delete).not.toHaveBeenCalled();
  });

  it("locks rows before checking, then audits, deletes, and removes this design's files", async () => {
    prismaMock.designConcept.findUnique.mockResolvedValue({
      ...idleDesign,
      images: [{ storageKey: "designs/8/1-front.png" }, { storageKey: "seed/IDEA-1/primary.png" }],
    });
    prismaMock.taskArtifact.findMany.mockResolvedValue([
      { storageKey: "designs/8/1-front.png" },
      { storageKey: "designs/8/2-punch.dst" },
      { storageKey: "designs/77/3-other-design.png" },
    ]);

    await expect(deleteDesign(8n, 1, owner, "corr")).resolves.toEqual({ deleted: true });

    // design → tasks, both before the eligibility read.
    const lockSql = prismaMock.$queryRaw.mock.calls.map(([sql]) => (sql as string[]).join("?"));
    expect(lockSql).toEqual([
      expect.stringContaining("FROM design_concepts"),
      expect.stringContaining("FROM design_tasks"),
    ]);
    expect(prismaMock.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      prismaMock.designConcept.findUnique.mock.invocationCallOrder[0],
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({ entityId: "8", action: "DELETE", userId: 2 }),
    );
    expect(prismaMock.designConcept.delete).toHaveBeenCalledWith({ where: { id: 8n } });
    // Image keys are trusted wherever they live; artifact keys only under designs/8/.
    expect(vi.mocked(deleteObject).mock.calls.map(([key]) => key)).toEqual([
      "designs/8/1-front.png",
      "seed/IDEA-1/primary.png",
      "designs/8/2-punch.dst",
    ]);
  });
});
