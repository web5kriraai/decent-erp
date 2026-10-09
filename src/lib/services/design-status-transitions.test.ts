import { describe, expect, it } from "vitest";
import {
  assertAllowedDesignStatusTransition,
  DesignStatusTransitionError,
} from "@/lib/services/design-status-transitions";

describe("design status transitions", () => {
  it("allows ACTIVE to ON_HOLD", () => {
    expect(() => assertAllowedDesignStatusTransition("ACTIVE", "ON_HOLD")).not.toThrow();
  });

  it("rejects APPROVED to ACTIVE via generic patch", () => {
    expect(() => assertAllowedDesignStatusTransition("APPROVED", "ACTIVE")).toThrow(
      DesignStatusTransitionError,
    );
  });

  it("allows no-op same status", () => {
    expect(() => assertAllowedDesignStatusTransition("DRAFT", "DRAFT")).not.toThrow();
  });
});
