import { describe, expect, it } from "vitest";
import {
  buildCorrectionScopeForEmployee,
  correctionVisibleToEmployee,
} from "@/lib/services/correction-queue-utils";

describe("correctionVisibleToEmployee", () => {
  it("allows the responsible employee", () => {
    expect(
      correctionVisibleToEmployee(
        { responsibleEmployeeId: 5, raisedById: 2, task: { assignedEmployeeId: 3 } },
        5,
      ),
    ).toBe(true);
  });

  it("allows the employee who raised the correction", () => {
    expect(
      correctionVisibleToEmployee(
        { responsibleEmployeeId: null, raisedById: 2, task: { assignedEmployeeId: 3 } },
        2,
      ),
    ).toBe(true);
  });

  it("allows the source task assignee", () => {
    expect(
      correctionVisibleToEmployee(
        { responsibleEmployeeId: null, raisedById: 9, task: { assignedEmployeeId: 3 } },
        3,
      ),
    ).toBe(true);
  });

  it("denies unrelated employees", () => {
    expect(
      correctionVisibleToEmployee(
        { responsibleEmployeeId: 5, raisedById: 2, task: { assignedEmployeeId: 3 } },
        99,
      ),
    ).toBe(false);
  });
});

describe("buildCorrectionScopeForEmployee", () => {
  it("scopes by responsibility, raised-by, and source task assignee", () => {
    expect(buildCorrectionScopeForEmployee(7)).toEqual({
      OR: [
        { responsibleEmployeeId: 7 },
        { raisedById: 7 },
        { task: { assignedEmployeeId: 7 } },
      ],
    });
  });
});
