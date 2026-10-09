export const COST_ENTRY_TYPES = ["TIME", "MATERIAL", "MACHINE", "CORRECTION"] as const;
export type CostType = (typeof COST_ENTRY_TYPES)[number];

export const COST_CATEGORIES = ["FABRIC", "EMBROIDERY", "STITCHING", "SALARY", "OTHER"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export type CostEntryInput = {
  costType: CostType;
  costCategory?: CostCategory | null;
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

const PLACEHOLDER_COSTING_NOTE =
  /^(nothing|n\/?a|na|none|nil|-|-|–|\.|…)$/i;

/** True when an optional costing note is worth appending to the auto remark. */
export function isMeaningfulCostingNote(note?: string | null): boolean {
  const trimmed = note?.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_COSTING_NOTE.test(trimmed);
}

/**
 * Drop trailing placeholder notes from stored remarks (e.g. "… total ₹800.00, nothing").
 * Keeps the auto-generated costing summary intact.
 */
export function sanitizeHandoffRemark(remark?: string | null): string | null {
  const trimmed = remark?.trim();
  if (!trimmed) return null;
  const cleaned = trimmed
    .replace(/[.,;]\s*(nothing|n\/?a|na|none|nil|-|-|–)\s*$/i, "")
    .trim();
  return cleaned || null;
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
  if (!isMeaningfulCostingNote(additionalNote)) return base;
  return `${base}. ${additionalNote!.trim()}`;
}
