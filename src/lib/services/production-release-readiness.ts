import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { designHasCosting } from "@/lib/services/costing-service";

type Tx = Prisma.TransactionClient;

const SATISFIED = new Set(["COMPLETED", "CHECKING", "CANCELLED"]);

export type ProductionReleaseReadiness = {
  ok: boolean;
  missing: string[];
};

async function taskByCode(
  tx: Tx | typeof prisma,
  designId: bigint,
  code: string,
) {
  return (tx as Tx).designTask.findFirst({
    where: { designId, subProcess: { code } },
    include: { subProcess: { select: { name: true, code: true, isFileRequired: true } } },
  });
}

/**
 * Server-authoritative checklist before production release (master prompt §13).
 */
export async function validateProductionReleaseReadiness(
  designId: bigint,
  tx?: Tx,
): Promise<ProductionReleaseReadiness> {
  const db = tx ?? prisma;
  const missing: string[] = [];

  const design = await db.designConcept.findUnique({
    where: { id: designId },
    select: { status: true },
  });
  if (!design) {
    return { ok: false, missing: ["Design record"] };
  }

  if (design.status !== "APPROVED" && design.status !== "PRODUCTION_RELEASED") {
    missing.push("Management / final approval (design must be Approved)");
  }

  const hasCosting = await designHasCosting(designId);
  if (!hasCosting) {
    missing.push("Development costing");
  }

  const levels = await db.approvalLevel.findMany({
    where: { active: true },
    orderBy: { sequence: "asc" },
  });
  if (levels.length > 0) {
    const approvals = await db.designApproval.findMany({
      where: { designId, decision: { in: ["APPROVED", "SKIPPED"] } },
    });
    const passedIds = new Set(approvals.map((a) => a.approvalLevelId));
    for (const level of levels) {
      if (!passedIds.has(level.id)) {
        missing.push(`${level.name} approval`);
      }
    }
  }

  const sketch = await taskByCode(db, designId, "SKETCH");
  if (!sketch || !SATISFIED.has(sketch.status)) {
    missing.push("Sketch work");
  } else if (sketch.subProcess.isFileRequired) {
    const files = await db.taskArtifact.count({
      where: { taskId: sketch.id, storageKey: { not: null } },
    });
    if (files === 0) missing.push("Sketch file");
  }

  const sketchApproval = await taskByCode(db, designId, "SKETCH_APPROVAL");
  if (!sketchApproval || sketchApproval.status !== "COMPLETED") {
    missing.push("Sketch approval");
  }

  const punch = await taskByCode(db, designId, "PUNCH");
  if (!punch || !SATISFIED.has(punch.status)) {
    missing.push("Punching / Wilcom work");
  } else if (punch.subProcess.isFileRequired) {
    const files = await db.taskArtifact.count({
      where: { taskId: punch.id, storageKey: { not: null } },
    });
    if (files === 0) missing.push("Punching file");
  }

  const punchCheck = await taskByCode(db, designId, "PUNCH_CHECK");
  if (punchCheck && punchCheck.status !== "COMPLETED") {
    missing.push("Punching checking approval");
  }

  const matReq = await taskByCode(db, designId, "MAT_REQ");
  if (matReq && !SATISFIED.has(matReq.status)) {
    missing.push("Material requirement");
  }

  const fabricIssue = await taskByCode(db, designId, "FABRIC_ISSUE");
  if (fabricIssue && !SATISFIED.has(fabricIssue.status)) {
    missing.push("Fabric / component issue");
  }

  const sampleCheck = await taskByCode(db, designId, "SAMPLE_CHECK");
  if (!sampleCheck || sampleCheck.status !== "COMPLETED") {
    missing.push("Sample approval");
  }

  const machineSample = await taskByCode(db, designId, "MACHINE_SAMPLE");
  if (!machineSample || !SATISFIED.has(machineSample.status)) {
    missing.push("Machine sample");
  }

  const finalApproval = await taskByCode(db, designId, "FINAL_APPROVAL");
  if (!finalApproval || finalApproval.status !== "COMPLETED") {
    missing.push("Design Head final approval stage");
  }

  const prodHandoff = await taskByCode(db, designId, "PROD_HANDOFF");
  if (!prodHandoff || prodHandoff.status !== "COMPLETED") {
    missing.push("Production handoff from Design Head");
  }

  const prodInstruction = await taskByCode(db, designId, "PROD_INSTRUCTION");
  if (!prodInstruction || prodInstruction.status !== "COMPLETED") {
    missing.push("Production instruction");
  }

  return { ok: missing.length === 0, missing };
}
