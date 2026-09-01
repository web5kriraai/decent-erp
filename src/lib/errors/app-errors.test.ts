import { describe, expect, it } from "vitest";
import {
  APP_ERROR_CODES,
  APP_ERROR_MESSAGES,
  formatZodFieldSummary,
  humanizeClientError,
  inferCodeFromMessage,
  sanitizeLegacyMessage,
} from "@/lib/errors/app-errors";
import { getTaskStartAvailability } from "@/lib/action-availability";

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
});
