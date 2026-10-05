import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import {
  DESIGN_PIPELINE_VIEW_PERMISSIONS,
  hasPermission,
  PERMISSIONS,
} from "@/lib/permissions";
import { permissionDeniedMessage } from "@/lib/user-messages";

export {
  canListDesigns,
  DESIGN_LIST_VIEW_PERMISSIONS,
  DESIGN_PIPELINE_VIEW_PERMISSIONS,
} from "@/lib/permissions";

/**
 * Detail/files: pipeline viewers, or task executors assigned on that design
 * (or the design head).
 */
export async function canReadDesign(input: {
  designId: bigint;
  employeeId: number;
  permissions: string[];
  companyId?: number;
}): Promise<boolean> {
  const design = await prisma.designConcept.findUnique({
    where: { id: input.designId },
    select: { designHeadEmployeeId: true, companyId: true },
  });
  if (!design) return false;
  if (input.companyId != null && design.companyId !== input.companyId) {
    return false;
  }

  if (hasPermission(input.permissions, DESIGN_PIPELINE_VIEW_PERMISSIONS)) {
    return true;
  }
  if (!hasPermission(input.permissions, PERMISSIONS.TASK_EXECUTE)) {
    return false;
  }

  if (design.designHeadEmployeeId === input.employeeId) return true;

  const assigned = await prisma.designTask.findFirst({
    where: {
      designId: input.designId,
      assignedEmployeeId: input.employeeId,
      status: { not: "CANCELLED" },
    },
    select: { id: true },
  });
  return assigned != null;
}

export async function assertCanReadDesign(input: {
  designId: bigint;
  employeeId: number;
  permissions: string[];
  companyId?: number;
}): Promise<void> {
  const allowed = await canReadDesign(input);
  if (!allowed) {
    throw new ApiError(
      permissionDeniedMessage(DESIGN_PIPELINE_VIEW_PERMISSIONS),
      403,
      { requiredPermissions: DESIGN_PIPELINE_VIEW_PERMISSIONS },
    );
  }
}

export async function assertCanUpdateMaterialLine(input: {
  lineId: bigint;
  employeeId: number;
  permissions: string[];
}): Promise<void> {
  if (
    hasPermission(input.permissions, [
      PERMISSIONS.DESIGN_CREATE,
      PERMISSIONS.PRODUCTION_RELEASE,
      PERMISSIONS.MASTER_ADMIN,
    ])
  ) {
    return;
  }

  if (!hasPermission(input.permissions, PERMISSIONS.TASK_EXECUTE)) {
    throw new ApiError(
      permissionDeniedMessage([
        PERMISSIONS.DESIGN_CREATE,
        PERMISSIONS.PRODUCTION_RELEASE,
        PERMISSIONS.TASK_EXECUTE,
      ]),
      403,
    );
  }

  const line = await prisma.designMaterialLine.findUnique({
    where: { id: input.lineId },
    select: {
      designId: true,
      design: { select: { designHeadEmployeeId: true } },
    },
  });
  if (!line) {
    throw new ApiError("Material line not found", 404);
  }
  if (line.design.designHeadEmployeeId === input.employeeId) return;

  const assigned = await prisma.designTask.findFirst({
    where: {
      designId: line.designId,
      assignedEmployeeId: input.employeeId,
      status: { not: "CANCELLED" },
    },
    select: { id: true },
  });
  if (!assigned) {
    throw new ApiError(
      "You can only update materials on designs where you have an assigned task",
      403,
    );
  }
}
