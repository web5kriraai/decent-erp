export const COST_ENTRY_TYPES = ["TIME", "MATERIAL", "MACHINE", "CORRECTION"] as const;
export type CostType = (typeof COST_ENTRY_TYPES)[number];

export type CostEntryInput = {
  costType: CostType;
  description?: string;
  amount: number;
};

/** True when existing DB costs or draft lines include at least one positive amount. */
export function costingEndHasPositiveCosts(
  existingHasCosting: boolean,
  draftEntries: Array<{ amount: number }>,
): boolean {
  if (existingHasCosting) return true;
  return draftEntries.some((e) => Number(e.amount) > 0);
}

export function mergeCostAmountsByType(
  existingByType: Record<string, number>,
  draftEntries: CostEntryInput[],
): Record<string, number> {
  const byType: Record<string, number> = { ...existingByType };
  for (const entry of draftEntries) {
    const amount = Number(entry.amount);
    if (!(amount > 0)) continue;
    byType[entry.costType] = (byType[entry.costType] ?? 0) + amount;
  }
  return byType;
}

export function totalFromByType(byType: Record<string, number>): number {
  return Object.values(byType).reduce((sum, n) => sum + Number(n), 0);
}

/** Auto remark so Costing does not need a long free-text essay. */
export function buildCostingOutputRemark(
  byType: Record<string, number>,
  total: number,
  additionalNote?: string,
): string {
  const parts = Object.entries(byType)
    .filter(([, amount]) => Number(amount) > 0)
    .map(([type, amount]) => `${type} ₹${Number(amount).toFixed(2)}`);
  const base =
    parts.length > 0
      ? `Costing submitted: ${parts.join(", ")}; total ₹${total.toFixed(2)}`
      : "Costing submitted";
  const note = additionalNote?.trim();
  return note ? `${base}. ${note}` : base;
}
