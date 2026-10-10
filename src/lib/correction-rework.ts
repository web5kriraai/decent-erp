const ROUTED_REWORK_SATISFIED = new Set(["COMPLETED", "CHECKING", "SKIPPED"]);

/** Done is refused until the routed rework task is finished. */
export function correctionReworkStillOpen(correction: {
  routedTask?: { status: string } | null;
}): boolean {
  const status = correction.routedTask?.status;
  if (!status) return false;
  return !ROUTED_REWORK_SATISFIED.has(status);
}
