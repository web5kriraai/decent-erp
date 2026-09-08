/** Performance grade bands from weighted KPI score (0–100). */
export const PERFORMANCE_GRADE_BANDS = [
  { code: "A", minScore: 90 },
  { code: "B", minScore: 75 },
  { code: "C", minScore: 60 },
  { code: "D", minScore: 40 },
  { code: "E", minScore: 0 },
] as const;

export type PerformanceGradeCode = (typeof PERFORMANCE_GRADE_BANDS)[number]["code"];

export const PERFORMANCE_MARK_SOURCES = [
  "KPI_MONTHLY",
  "DESIGN_CONTRIBUTION",
  "CORRECTION_IMPACT",
  "CREATIVITY_RATING",
  "MANUAL_ADJUST",
] as const;

export type PerformanceMarkSource = (typeof PERFORMANCE_MARK_SOURCES)[number];

export function gradeFromWeightedScore(score: number): PerformanceGradeCode {
  const n = Number.isFinite(score) ? score : 0;
  for (const band of PERFORMANCE_GRADE_BANDS) {
    if (n >= band.minScore) return band.code;
  }
  return "E";
}
