import { describe, expect, it } from "vitest";
import { selectUnlockPeerIds } from "@/lib/services/task-dependency-unlock";

describe("selectUnlockPeerIds", () => {
  const neverSkip = () => false;

  it("unlocks Sample Check only when Machine Sample completes/checking", () => {
    const from = {
      id: "5",
      dependencySequence: null,
      sequence: 5,
      subProcessCode: "MACHINE_SAMPLE",
    };
    const siblings = [
      {
        id: "6",
        dependencySequence: null,
        sequence: 6,
        status: "PENDING",
        subProcess: { code: "SAMPLE_CHECK", isApproval: true },
      },
      {
        id: "7",
        dependencySequence: null,
        sequence: 7,
        status: "PENDING",
        subProcess: { code: "COSTING" },
      },
    ];

    expect(selectUnlockPeerIds(from, siblings, neverSkip).map(String)).toEqual(["6"]);
  });

  it("does not skip Sample Checking ASSIGNED to unlock Costing", () => {
    const from = {
      id: "5",
      dependencySequence: null,
      sequence: 5,
      subProcessCode: "MACHINE_SAMPLE",
    };
    const siblings = [
      {
        id: "6",
        dependencySequence: null,
        sequence: 6,
        status: "ASSIGNED",
        subProcess: { code: "SAMPLE_CHECK", isApproval: true },
      },
      {
        id: "7",
        dependencySequence: null,
        sequence: 7,
        status: "PENDING",
        subProcess: { code: "COSTING" },
      },
    ];

    expect(selectUnlockPeerIds(from, siblings, neverSkip)).toEqual([]);
  });

  it("does not unlock Costing while Sample Checking is CORRECTION_REQUIRED", () => {
    const from = {
      id: "5",
      dependencySequence: null,
      sequence: 5,
      subProcessCode: "MACHINE_SAMPLE",
    };
    const siblings = [
      {
        id: "6",
        dependencySequence: null,
        sequence: 6,
        status: "CORRECTION_REQUIRED",
        subProcess: { code: "SAMPLE_CHECK", isApproval: true },
      },
      {
        id: "7",
        dependencySequence: null,
        sequence: 7,
        status: "PENDING",
        subProcess: { code: "COSTING" },
      },
    ];

    expect(selectUnlockPeerIds(from, siblings, neverSkip)).toEqual([]);
  });

  it("unlocks Costing after Sample Check is completed", () => {
    const from = {
      id: "6",
      dependencySequence: null,
      sequence: 6,
      subProcessCode: "SAMPLE_CHECK",
    };
    const siblings = [
      {
        id: "5",
        dependencySequence: null,
        sequence: 5,
        status: "CHECKING",
        subProcess: { code: "MACHINE_SAMPLE" },
      },
      {
        id: "7",
        dependencySequence: null,
        sequence: 7,
        status: "PENDING",
        subProcess: { code: "COSTING" },
      },
      {
        id: "8",
        dependencySequence: null,
        sequence: 8,
        status: "PENDING",
        subProcess: { code: "FINAL_APPROVAL", isApproval: true },
      },
    ];

    expect(selectUnlockPeerIds(from, siblings, neverSkip).map(String)).toEqual(["7"]);
  });
});
