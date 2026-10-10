import { describe, expect, it } from "vitest";
import {
  erpStageBlockedNotice,
  releaseApprovalGapMessage,
  releaseApprovalNotice,
} from "@/lib/erp-stage-guidance";

describe("erp stage guidance", () => {
  it("names Costing as the owner of a ready Accounts stage", () => {
    const notice = erpStageBlockedNotice("ACCOUNTS", "READY");
    expect(notice?.title).toBe("Accounts is waiting on Costing");
    expect(notice?.body).toContain("margin percent");
    expect(notice?.body).toContain("Only Costing");
  });

  it("explains an Active design that has not been sent for sign-off", () => {
    const notice = releaseApprovalNotice("ACTIVE");
    expect(notice?.title).toContain("waiting on approval");
    expect(notice?.body).toContain("Design Head requests sign-off");
    expect(notice?.body).toContain("Management");
    expect(releaseApprovalGapMessage("ACTIVE")).toBe(notice?.body);
  });

  it("explains a design already waiting in Approvals", () => {
    const notice = releaseApprovalNotice("APPROVAL_PENDING");
    expect(notice?.title).toContain("Management");
    expect(notice?.body).toContain("Approvals");
  });

  it("hides the approval notice after the design is approved", () => {
    expect(releaseApprovalNotice("APPROVED")).toBeNull();
    expect(releaseApprovalNotice("PRODUCTION_RELEASED")).toBeNull();
  });
});
