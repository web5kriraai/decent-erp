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

const AUTO_COSTING_REMARK =
  /^Costing submitted:\s*.+?[;:]\s*total ₹[\d,]+\.\d{2}\.?\s*/i;

/** Extra note after the auto costing line. The generated totals line itself is not a note. */
export function extractCostingAdditionalNote(remark?: string | null): string | null {
  const cleaned = sanitizeHandoffRemark(remark);
  if (!cleaned) return null;
  if (!AUTO_COSTING_REMARK.test(cleaned)) return cleaned;
  const note = cleaned.replace(AUTO_COSTING_REMARK, "").trim();
  return isMeaningfulCostingNote(note) ? note : null;
}

/** Empty means 0. A negative or non-numeric value is invalid. */
export function parseCostAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

/** Auto remark so Costing does not need a long free-text essay. Every type is listed; a missing type is 0. */
export function buildCostingOutputRemark(
  byType: Record<string, number>,
  total: number,
  additionalNote?: string,
): string {
  const parts = COST_ENTRY_TYPES.map(
    (type) => `${type} ₹${Number(byType[type] ?? 0).toFixed(2)}`,
  );
  const base = `Costing submitted: ${parts.join(", ")}; total ₹${total.toFixed(2)}`;
  if (!isMeaningfulCostingNote(additionalNote)) return base;
  return `${base}. ${additionalNote!.trim()}`;
}
