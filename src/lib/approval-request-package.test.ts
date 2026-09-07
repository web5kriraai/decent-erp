import { describe, expect, it } from "vitest";
import {
  buildLiveApprovalPackagePreview,
  designFileDeepLink,
  parseApprovalRequestPackage,
  previewCorrectionAssignee,
  resolveCompletedStageDetails,
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
    expect(pkg?.snapshot.completedStages).toEqual(["Sketch"]);
    expect(pkg?.snapshot.completedStageDetails?.[0]).toMatchObject({ name: "Sketch" });
  });

  it("parses rich completedStageDetails and optional briefs/decisions", () => {
    const pkg = parseApprovalRequestPackage({
      requesterName: "Head",
      requesterRemark: "Please review all stages",
      requesterEmployeeId: 1,
      requestedAtUtc: "2026-01-01T00:00:00.000Z",
      snapshot: {
        ideaRef: "I-2",
        collectionName: "C",
        productType: "P",
        priority: "HIGH",
        statusBeforeRequest: "ACTIVE",
        completedStages: ["Sketch", "Punch"],
        completedStageDetails: [
          {
            code: "SKETCH",
            name: "Sketch",
            outputRemark: "Ready for punch",
            assigneeName: "Asha",
            completedAt: "2026-01-01T10:00:00.000Z",
          },
          {
            code: "PUNCH",
            name: "Punch",
            outputRemark: "DST attached",
            assigneeName: "Ravi",
          },
        ],
        openCorrections: 1,
        openCorrectionBriefs: [
          { id: "55", type: "IMPROVEMENT", rootCause: "Density too high" },
        ],
        priorManagementDecisions: [
          {
            levelName: "Design Director",
            decision: "CORRECTION_REQUIRED",
            remark: "Fix stitch density",
            decidedBy: "Director",
            decidedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
        costingEntryCount: 0,
        costingTotal: 0,
        primaryFiles: [],
      },
    });

    expect(pkg?.snapshot.completedStageDetails).toHaveLength(2);
    expect(pkg?.snapshot.completedStageDetails?.[0]?.outputRemark).toBe("Ready for punch");
    expect(pkg?.snapshot.openCorrectionBriefs?.[0]?.rootCause).toBe("Density too high");
    expect(pkg?.snapshot.priorManagementDecisions?.[0]?.decision).toBe("CORRECTION_REQUIRED");
    expect(resolveCompletedStageDetails(pkg?.snapshot)).toHaveLength(2);
  });

  it("accepts completedStages as detail objects for backward-compatible payloads", () => {
    const pkg = parseApprovalRequestPackage({
      requesterName: "Head",
      requesterRemark: "Please review all stages",
      requesterEmployeeId: 1,
      requestedAtUtc: "2026-01-01T00:00:00.000Z",
      snapshot: {
        ideaRef: "I-3",
        collectionName: "C",
        productType: "P",
        priority: "LOW",
        statusBeforeRequest: "ACTIVE",
        completedStages: [
          { code: "SKETCH", name: "Sketch", outputRemark: "Done", assigneeName: "A" },
        ],
        openCorrections: 0,
        costingEntryCount: 0,
        costingTotal: 0,
        primaryFiles: [],
      },
    });
    expect(pkg?.snapshot.completedStages).toEqual(["Sketch"]);
    expect(pkg?.snapshot.completedStageDetails?.[0]?.outputRemark).toBe("Done");
  });

  it("builds live package preview from design detail props", () => {
    const preview = buildLiveApprovalPackagePreview({
      requesterRemark: "Ready for director review now",
      summaryNote: "All stages done",
      design: {
        ideaRef: "IDEA-9",
        collectionName: "Spring",
        status: "ACTIVE",
        priority: "HIGH",
        productType: { name: "Saree" },
        designHead: { id: 2, name: "Design Head" },
        tasks: [
          {
            status: "COMPLETED",
            outputRemark: "Sketch OK",
            completedAt: "2026-01-01T00:00:00.000Z",
            assignedEmployee: { id: 3, name: "Sketch User" },
            subProcess: { code: "SKETCH", name: "Sketch", isApproval: false },
          },
          {
            status: "ASSIGNED",
            subProcess: { code: "FINAL_APPROVAL", name: "Final", isApproval: true },
          },
        ],
        corrections: [
          {
            id: 11,
            status: "OPEN",
            correctionType: "MISTAKE",
            rootCause: "Wrong colorway",
          },
        ],
        approvals: [
          {
            decision: "CORRECTION_REQUIRED",
            remark: "Please fix",
            decisionAtUtc: "2026-01-02T00:00:00.000Z",
            level: { name: "MD" },
            approver: { name: "Boss" },
          },
        ],
        images: [{ id: 1, fileName: "main.png", isPrimary: true }],
        costs: [{ amount: 250 }],
      },
    });

    expect(preview.snapshot.ideaRef).toBe("IDEA-9");
    expect(preview.snapshot.completedStageDetails?.[0]?.outputRemark).toBe("Sketch OK");
    expect(preview.snapshot.openCorrectionBriefs?.[0]?.rootCause).toBe("Wrong colorway");
    expect(preview.snapshot.priorManagementDecisions?.[0]?.levelName).toBe("MD");
    expect(preview.snapshot.costingTotal).toBe(250);
    expect(preview.summaryNote).toBe("All stages done");
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

describe("presence-driven requiresCosting on package preview", () => {
  it("sets requiresCosting false for Concept→Sketch without costing stage", () => {
    const pkg = buildLiveApprovalPackagePreview({
      design: {
        ideaRef: "IDEA-SHORT",
        collectionName: "Short",
        status: "ACTIVE",
        priority: "MEDIUM",
        productType: { name: "Saree" },
        tasks: [
          {
            status: "COMPLETED",
            subProcess: { code: "CONCEPT_REVIEW", name: "Concept", isApproval: true },
          },
          {
            status: "CHECKING",
            subProcess: { code: "SKETCH", name: "Sketch", isFileRequired: true },
          },
          {
            status: "COMPLETED",
            subProcess: { code: "SKETCH_APPROVAL", name: "Sketch Approval", isApproval: true },
          },
        ],
        costs: [],
      },
      requesterRemark: "Approve short pattern without finance costing",
    });
    expect(pkg.snapshot.requiresCosting).toBe(false);
    expect(pkg.snapshot.costingEntryCount).toBe(0);
  });

  it("sets requiresCosting true when COSTING stage is present and active", () => {
    const pkg = buildLiveApprovalPackagePreview({
      design: {
        ideaRef: "IDEA-FULL",
        collectionName: "Full",
        status: "ACTIVE",
        priority: "HIGH",
        productType: { name: "Saree" },
        tasks: [
          {
            status: "COMPLETED",
            subProcess: { code: "COSTING", name: "Costing" },
          },
          {
            status: "COMPLETED",
            subProcess: { code: "FINAL_APPROVAL", name: "Final", isApproval: true },
          },
        ],
        costs: [],
      },
      requesterRemark: "Full pattern still needs costing entries",
    });
    expect(pkg.snapshot.requiresCosting).toBe(true);
  });

  it("does not require costing when COSTING task is SKIPPED", () => {
    const pkg = buildLiveApprovalPackagePreview({
      design: {
        ideaRef: "IDEA-SKIP",
        collectionName: "Skip",
        status: "ACTIVE",
        priority: "MEDIUM",
        productType: { name: "Saree" },
        tasks: [
          {
            status: "SKIPPED",
            subProcess: { code: "COSTING", name: "Costing" },
          },
          {
            status: "COMPLETED",
            subProcess: { code: "SKETCH_APPROVAL", name: "Sketch Approval", isApproval: true },
          },
        ],
        costs: [],
      },
      requesterRemark: "Skipped costing should not block approve",
    });
    expect(pkg.snapshot.requiresCosting).toBe(false);
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
