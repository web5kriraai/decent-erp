import { describe, expect, it } from "vitest";
import {
  accessRestrictedMessage,
  formatPermissionLabel,
  permissionDeniedMessage,
} from "@/lib/user-messages";
import { PERMISSIONS } from "@/lib/permissions";

describe("user-messages", () => {
  it("formats permission labels in plain language", () => {
    expect(formatPermissionLabel(PERMISSIONS.DESIGN_CREATE)).toContain("design concepts");
  });

  it("explains permission denial with admin path", () => {
    expect(permissionDeniedMessage(PERMISSIONS.DESIGN_CREATE)).toMatch(/system admin/i);
    expect(permissionDeniedMessage(PERMISSIONS.DESIGN_CREATE)).toMatch(/Roles & Access/i);
  });

  it("explains restricted sections without raw codes", () => {
    expect(accessRestrictedMessage(PERMISSIONS.MASTER_ADMIN)).not.toContain("MASTER_ADMIN");
  });
});
