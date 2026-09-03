import { describe, expect, it } from "vitest";
import {
  APP_ERROR_CODES,
  APP_ERROR_MESSAGES,
  formatZodFieldSummary,
  humanizeClientError,
  inferCodeFromMessage,
  sanitizeLegacyMessage,
} from "@/lib/errors/app-errors";
import { getTaskStartAvailability, getMarkLiveAvailability, canEnsureProductionLadder } from "@/lib/action-availability";
import { PERMISSIONS, ROLE_CODES } from "@/lib/permissions";

describe("app-errors", () => {
  it("maps auth and permission statuses", () => {
    expect(inferCodeFromMessage("", 401)).toBe(APP_ERROR_CODES.NOT_AUTHENTICATED);
    expect(inferCodeFromMessage("", 403)).toBe(APP_ERROR_CODES.PERMISSION_DENIED);
  });

  it("sanitizes technical messages", () => {
    expect(sanitizeLegacyMessage("Prisma P2002 unique constraint", 500)).toBe(
      APP_ERROR_MESSAGES.INTERNAL_ERROR,
    );
  });

  it("humanizes validation with field summary", () => {
    const details = { fieldErrors: { designName: ["Required"] } };
    expect(formatZodFieldSummary(details)).toContain("design Name");
    const { title } = humanizeClientError({
      message: APP_ERROR_MESSAGES.VALIDATION_FAILED,
      status: 400,
      code: APP_ERROR_CODES.VALIDATION_FAILED,
    });
    expect(title).toBe(APP_ERROR_MESSAGES.VALIDATION_FAILED);
  });
});

describe("action-availability", () => {
  const siblings = [
    {
      id: "1",
      sequence: 1,
      dependencySequence: 1,
      status: "RUNNING",
      subProcess: { name: "Sketch", code: "SKETCH" },
      assignedEmployee: { name: "Alice" },
    },
    {
      id: "2",
      sequence: 2,
      dependencySequence: 2,
      status: "ASSIGNED",
      subProcess: { name: "Punch", code: "PUNCH" },
      assignedEmployee: { name: "Bob" },
    },
  ];

  it("blocks start when prior stage incomplete", () => {
    const result = getTaskStartAvailability(
      {
        id: "2",
        status: "ASSIGNED",
        sequence: 2,
        dependencySequence: 2,
        assignedEmployeeId: 1,
      },
      siblings,
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain("Sketch");
  });

  it("blocks start when another task is running", () => {
    const result = getTaskStartAvailability(
      {
        id: "1",
        status: "ASSIGNED",
        sequence: 1,
        dependencySequence: 1,
        assignedEmployeeId: 1,
      },
      siblings,
      { hasRunningTask: true },
    );
    expect(result.available).toBe(false);
    expect(result.reason).toContain("running task");
  });

  it("blocks Mark Live until live review is completed", () => {
    const blocked = getMarkLiveAvailability("PRODUCTION_RELEASED", {
      liveReviewCompleted: false,
    });
    expect(blocked.available).toBe(false);
    expect(blocked.reason).toMatch(/live design review/i);

    const omitted = getMarkLiveAvailability("PRODUCTION_RELEASED", {
      roleCode: "MANAGEMENT",
    });
    expect(omitted.available).toBe(false);

    const ready = getMarkLiveAvailability("PRODUCTION_RELEASED", {
      liveReviewCompleted: true,
      roleCode: "MANAGEMENT",
    });
    expect(ready.available).toBe(true);
  });

  it("blocks Mark Live for Production Head role", () => {
    const blocked = getMarkLiveAvailability("PRODUCTION_RELEASED", {
      liveReviewCompleted: true,
      roleCode: "PRODUCTION_HEAD",
    });
    expect(blocked.available).toBe(false);
    expect(blocked.reason).toMatch(/only management/i);
  });
});

describe("canEnsureProductionLadder", () => {
  const prod = [PERMISSIONS.PRODUCTION_RELEASE];

  it("allows Management and Admin with PRODUCTION_RELEASE", () => {
    expect(canEnsureProductionLadder(ROLE_CODES.MANAGEMENT, prod)).toBe(true);
    expect(canEnsureProductionLadder(ROLE_CODES.ADMIN, Object.values(PERMISSIONS))).toBe(true);
  });

  it("allows WORKFLOW_OVERRIDE with PRODUCTION_RELEASE", () => {
    expect(
      canEnsureProductionLadder(ROLE_CODES.DESIGN_HEAD, [
        PERMISSIONS.PRODUCTION_RELEASE,
        PERMISSIONS.WORKFLOW_OVERRIDE,
      ]),
    ).toBe(true);
  });

  it("hides tool for Production Head without override", () => {
    expect(
      canEnsureProductionLadder(ROLE_CODES.PRODUCTION_HEAD, [
        PERMISSIONS.PRODUCTION_RELEASE,
        PERMISSIONS.TASK_EXECUTE,
      ]),
    ).toBe(false);
  });

  it("requires PRODUCTION_RELEASE even for Admin-like override", () => {
    expect(
      canEnsureProductionLadder(ROLE_CODES.DESIGN_HEAD, [PERMISSIONS.WORKFLOW_OVERRIDE]),
    ).toBe(false);
  });
});
