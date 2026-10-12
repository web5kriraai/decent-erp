import type { DesignStatus } from "@prisma/client";
import { PERMISSIONS } from "@/lib/permissions";

/** Design delete rules shared by the API and the UI. */
export const DELETABLE_DESIGN_STATUSES = [
  "DRAFT",
  "ACTIVE",
] as const satisfies readonly DesignStatus[];

export function isDesignStatusDeletable(status: string) {
  return (DELETABLE_DESIGN_STATUSES as readonly string[]).includes(status);
}

export type DesignDeleteActor = {
  employeeId: number;
  permissions: readonly string[];
};

/** The creator, the design head, or an admin may delete a design. */
export function canActorDeleteDesign(
  actor: DesignDeleteActor,
  design: { createdById?: number | null; designHeadEmployeeId?: number | null },
) {
  return (
    actor.permissions.includes(PERMISSIONS.MASTER_ADMIN) ||
    design.createdById === actor.employeeId ||
    design.designHeadEmployeeId === actor.employeeId
  );
}

/** Whether to offer the Delete action at all (the server still re-checks everything). */
export function canOfferDesignDelete(
  actor: DesignDeleteActor | null,
  design: { status: string; createdById?: number | null; designHeadEmployeeId?: number | null },
) {
  return !!actor && isDesignStatusDeletable(design.status) && canActorDeleteDesign(actor, design);
}
