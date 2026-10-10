import { describe, expect, it } from "vitest";
import {
  isProductionReturnRootCause,
  PRODUCTION_RETURN_ROOT_PREFIX,
} from "@/lib/production-return-reasons";

describe("isProductionReturnRootCause", () => {
  it("matches production return corrections and ignores other remarks", () => {
    expect(isProductionReturnRootCause(`${PRODUCTION_RETURN_ROOT_PREFIX} Missing file`)).toBe(true);
    expect(isProductionReturnRootCause("Sketch needs a cleaner outline")).toBe(false);
    expect(isProductionReturnRootCause(null)).toBe(false);
  });
});
