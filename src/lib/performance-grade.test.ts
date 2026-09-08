import { describe, expect, it } from "vitest";
import { gradeFromWeightedScore } from "@/lib/performance-grade";

describe("gradeFromWeightedScore", () => {
  it("maps bands A–E", () => {
    expect(gradeFromWeightedScore(95)).toBe("A");
    expect(gradeFromWeightedScore(90)).toBe("A");
    expect(gradeFromWeightedScore(89.9)).toBe("B");
    expect(gradeFromWeightedScore(75)).toBe("B");
    expect(gradeFromWeightedScore(60)).toBe("C");
    expect(gradeFromWeightedScore(40)).toBe("D");
    expect(gradeFromWeightedScore(39.9)).toBe("E");
    expect(gradeFromWeightedScore(0)).toBe("E");
  });
});
