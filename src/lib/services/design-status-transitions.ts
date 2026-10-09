/** Kanban/API-safe transitions. Gate statuses use dedicated services. */
export const DESIGN_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["ACTIVE", "ON_HOLD", "CLOSED"],
  ACTIVE: ["ON_HOLD", "APPROVAL_PENDING", "DRAFT", "CLOSED"],
  ON_HOLD: ["ACTIVE", "DRAFT", "CLOSED"],
  APPROVAL_PENDING: ["ACTIVE", "ON_HOLD", "REJECTED"],
  APPROVED: ["ON_HOLD", "CLOSED"],
  PRODUCTION_ACCEPTED: ["ON_HOLD", "CLOSED"],
  REJECTED: ["ACTIVE", "DRAFT", "CLOSED"],
  PRODUCTION_RELEASED: ["CLOSED"],
  LIVE: ["CLOSED"],
  CLOSED: [],
};

export class DesignStatusTransitionError extends Error {
  readonly status = 422;
  constructor(message: string) {
    super(message);
    this.name = "DesignStatusTransitionError";
  }
}

export function assertAllowedDesignStatusTransition(from: string, to: string): void {
  if (from === to) return;
  const allowed = DESIGN_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DesignStatusTransitionError(
      `Cannot change design status from ${from} to ${to}. Use the approval or production release flows for gated transitions.`,
    );
  }
}
