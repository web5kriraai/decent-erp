import { describe, expect, it } from "vitest";
import { designImagesRejectWhere } from "@/lib/services/design-image-reject";

describe("designImagesRejectWhere", () => {
  it("targets all images for a design including primary (no isPrimary filter)", () => {
    const where = designImagesRejectWhere(42);
    expect(where).toEqual({ designId: 42 });
    expect(where).not.toHaveProperty("isPrimary");
  });
});
