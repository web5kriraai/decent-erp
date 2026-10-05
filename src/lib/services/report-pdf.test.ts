import { describe, expect, it } from "vitest";
import { buildReportPdfBuffer } from "@/lib/services/report-pdf";

describe("report PDF export", () => {
  it("builds a non-empty PDF buffer", async () => {
    const buffer = await buildReportPdfBuffer({
      type: "design-performance",
      title: "Design Performance",
      headers: ["IdeaRef", "Status"],
      rows: [
        ["IDEA-1", "ACTIVE"],
        ["IDEA-2", "APPROVED"],
      ],
    });
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
