/**
 * Active KPI metric weights for a role must total 100%.
 */
export function roleKpiWeightsSumOk(
  weights: number[],
  tolerance = 0.01,
): { ok: boolean; sum: number } {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  return { ok: Math.abs(sum - 100) <= tolerance, sum };
}
