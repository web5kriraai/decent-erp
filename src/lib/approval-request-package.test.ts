import { describe, expect, it } from "vitest";
import {
  designFileDeepLink,
  parseApprovalRequestPackage,
  previewCorrectionAssignee,
  validateManagementSignOffRequest,
} from "@/lib/approval-request-package";
import {
  defaultApprovalDecisionFormState,
  isApprovalDecisionFormValid,
} from "@/components/approvals/ApprovalDecisionForm";

describe("approval-request-package", () => {
  it("rejects non–Design Head and short remarks", () => {
    expect(
      validateManagementSignOffRequest({ roleCode: "ADMIN", requesterRemark: "long enough" }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      validateManagementSignOffRequest({
        roleCode: "DESIGN_HEAD",
        requesterRemark: "short",
      }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      validateManagementSignOffRequest({
        roleCode: "DESIGN_HEAD",
        requesterRemark: "Ready for management review",
      }),
    ).toMatchObject({ ok: true, remark: "Ready for management review" });
  });

  it("parses packages and rejects legacy/invalid payloads", () => {
    expect(parseApprovalRequestPackage(null)).toBeNull();
    expect(parseApprovalRequestPackage({ requesterName: "A" })).toBeNull();
    const pkg = parseApprovalRequestPackage({
      requesterName: "Head",
      requesterRemark: "Please review all stages",
      requesterEmployeeId: 1,
      requestedAtUtc: "2026-01-01T00:00:00.000Z",
      snapshot: {
        ideaRef: "I-1",
        collectionName: "C",
        productType: "P",
        priority: "NORMAL",
        statusBeforeRequest: "ACTIVE",
        completedStages: ["Sketch"],
        openCorrections: 0,
        costingEntryCount: 1,
        costingTotal: 100,
        primaryFiles: [{ id: "9", fileName: "a.png", isPrimary: true }],
        stageAssignees: [
          { code: "PUNCH", name: "Punch", assigneeEmployeeId: 3, assigneeName: "Punch User" },
        ],
      },
    });
    expect(pkg?.requesterName).toBe("Head");
    expect(pkg?.snapshot.primaryFiles[0]?.fileName).toBe("a.png");
  });

  it("builds deep links into design files", () => {
    expect(designFileDeepLink("42")).toContain("/designs/42");
    expect(designFileDeepLink("42")).toContain("setup=images");
    expect(designFileDeepLink("42")).toContain("#design-files");
    expect(designFileDeepLink("42", "99")).toContain("image=99");
  });

  it("previews correction assignee from responsible override or stage owner", () => {
    const stages = [
      { code: "PUNCH", name: "Punch", assigneeEmployeeId: 3, assigneeName: "Punch User" },
      { code: "SKETCH", name: "Sketch", assigneeEmployeeId: 2, assigneeName: "Sketch User" },
    ];
    expect(
      previewCorrectionAssignee({
        routeSubProcessCode: "PUNCH",
        stageAssignees: stages,
      }),
    ).toBe("Punch User");
    expect(
      previewCorrectionAssignee({
        routeSubProcessCode: "PUNCH",
        stageAssignees: stages,
        responsibleEmployeeId: "7",
        employees: [{ id: 7, name: "Override Person" }],
      }),
    ).toBe("Override Person");
  });
});

describe("ApprovalDecisionForm validation", () => {
  it("requires costing on approve when not ready", () => {
    const state = defaultApprovalDecisionFormState();
    expect(isApprovalDecisionFormValid(state, false)).toBe(false);
    expect(isApprovalDecisionFormValid(state, true)).toBe(true);
  });

  it("requires remark for reject and correction", () => {
    const reject = {
      ...defaultApprovalDecisionFormState(),
      decision: "REJECTED" as const,
      remark: "",
    };
    expect(isApprovalDecisionFormValid(reject)).toBe(false);
    expect(isApprovalDecisionFormValid({ ...reject, remark: "Not viable" })).toBe(true);

    const correction = {
      ...defaultApprovalDecisionFormState(),
      decision: "CORRECTION_REQUIRED" as const,
      remark: "Fix stitch density",
      correctionType: "IMPROVEMENT",
      routeSubProcessCode: "PUNCH",
    };
    expect(isApprovalDecisionFormValid(correction)).toBe(true);
    expect(isApprovalDecisionFormValid({ ...correction, remark: "" })).toBe(false);
  });
});
