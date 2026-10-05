import { prisma } from "@/lib/db";
import { getErpIntegrationMode } from "@/lib/services/erp-integration-config";
import { ingestDesignSuccessFromErp } from "@/lib/services/erp-handoff-service";

export type DesignSuccessBatchSyncResult = {
  mode: "simulated" | "live";
  scanned: number;
  ingested: number;
  skipped: number;
  failed: number;
  errors: Array<{ designId: string; designNumber: string; reason: string }>;
};

/**
 * Pull partner design-success metrics for released/live designs in a period.
 * No-op (scanned=0) when ERP is simulated.
 */
export async function batchSyncDesignSuccessFromErp(options?: {
  periodYear?: number;
  periodMonth?: number;
  companyId?: number;
  limit?: number;
}): Promise<DesignSuccessBatchSyncResult> {
  const mode = getErpIntegrationMode();
  const now = new Date();
  const periodYear = options?.periodYear ?? now.getUTCFullYear();
  const periodMonth = options?.periodMonth ?? now.getUTCMonth() + 1;
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);

  if (mode === "simulated") {
    return {
      mode,
      scanned: 0,
      ingested: 0,
      skipped: 0,
      failed: 0,
      errors: [
        {
          designId: "",
          designNumber: "",
          reason:
            "ERP_API_BASE_URL is not configured - batch partner sync is inactive in simulated mode.",
        },
      ],
    };
  }

  const designs = await prisma.designConcept.findMany({
    where: {
      ...(options?.companyId != null ? { companyId: options.companyId } : {}),
      status: { in: ["PRODUCTION_RELEASED", "LIVE", "PRODUCTION_ACCEPTED"] },
      OR: [
        { designNumber: { not: null } },
        { ideaRef: { not: "" } },
      ],
    },
    select: { id: true, designNumber: true, ideaRef: true },
    orderBy: { updatedAtUtc: "desc" },
    take: limit,
  });

  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  const errors: DesignSuccessBatchSyncResult["errors"] = [];

  for (const design of designs) {
    const designNumber =
      design.designNumber ?? `DN-${design.ideaRef.replace(/^IDEA-/, "")}`;
    try {
      const result = await ingestDesignSuccessFromErp(design.id, designNumber, {
        periodYear,
        periodMonth,
      });
      if (result.ingested) {
        ingested += 1;
      } else {
        skipped += 1;
        if (result.reason) {
          errors.push({
            designId: design.id.toString(),
            designNumber,
            reason: result.reason,
          });
        }
      }
    } catch (error) {
      failed += 1;
      errors.push({
        designId: design.id.toString(),
        designNumber,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    mode,
    scanned: designs.length,
    ingested,
    skipped,
    failed,
    errors: errors.slice(0, 25),
  };
}
