import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";
import { enqueueOutboxAndNotify } from "@/lib/notifications";

/** Primary ERP modules wired for real handoff (spec §2 Integration). */
export const PRIMARY_ERP_MODULES = ["GREY_MATERIAL", "CUTTING", "SALES"] as const;

type ErpModule = (typeof PRIMARY_ERP_MODULES)[number] | string;

type HandoffPayload = {
  designId: string;
  designNumber: string;
  ideaRef: string;
  collectionName: string;
  productTypeId: number;
};

const MODULE_ENDPOINTS: Record<string, string> = {
  GREY_MATERIAL: "/grey-material/designs",
  CUTTING: "/cutting/designs",
  SALES: "/sales/designs",
  EMBROIDERY: "/embroidery/designs",
  GARMENTING: "/garmenting/designs",
  FINISHING: "/finishing/designs",
  READY_STOCK: "/ready-stock/designs",
  ACCOUNTS: "/accounts/designs",
};

function buildErpUrl(module: string): string | null {
  const base = process.env.ERP_API_BASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  const path = MODULE_ENDPOINTS[module] ?? `/modules/${module.toLowerCase()}/designs`;
  return `${base}${path}`;
}

async function postToErpModule(
  module: ErpModule,
  payload: HandoffPayload,
): Promise<{ erpReference: string; response: unknown }> {
  const url = buildErpUrl(module);

  if (!url) {
    const ref = `LOCAL-${module}-${payload.designNumber}-${Date.now()}`;
    return {
      erpReference: ref,
      response: { mode: "simulated", module, designNumber: payload.designNumber },
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ERP_API_KEY ? { Authorization: `Bearer ${process.env.ERP_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      designNumber: payload.designNumber,
      ideaRef: payload.ideaRef,
      collectionName: payload.collectionName,
      productTypeId: payload.productTypeId,
      sourceModule: "DESIGN_MANAGEMENT",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ERP ${module} returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { reference?: string; id?: string };
  const erpReference = json.reference ?? json.id ?? `ERP-${module}-${Date.now()}`;
  return { erpReference, response: json };
}

export async function listProductionHandoffs(designId?: bigint) {
  return prisma.productionHandoff.findMany({
    where: designId ? { designId } : {},
    orderBy: [{ releasedAtUtc: "desc" }],
    include: {
      design: {
        select: {
          id: true,
          ideaRef: true,
          designNumber: true,
          collectionName: true,
          status: true,
        },
      },
      releasedBy: { select: { id: true, name: true } },
    },
    take: designId ? undefined : 100,
  });
}

export async function syncProductionHandoff(
  handoffId: bigint,
  actorId: number,
  correlationId: string,
) {
  const handoff = await prisma.productionHandoff.findUnique({
    where: { id: handoffId },
    include: { design: true },
  });
  if (!handoff) throw new ApiError("Handoff not found", 404);
  if (handoff.status === "SYNCED") {
    return handoff;
  }

  const payload: HandoffPayload = {
    designId: handoff.designId.toString(),
    designNumber: handoff.designNumber,
    ideaRef: handoff.design.ideaRef,
    collectionName: handoff.design.collectionName,
    productTypeId: handoff.design.productTypeId,
  };

  try {
    const result = await postToErpModule(handoff.erpModule, payload);
    const updated = await prisma.productionHandoff.update({
      where: { id: handoffId },
      data: {
        status: "SYNCED",
        erpReference: result.erpReference,
        payload: { ...(handoff.payload as object), syncResponse: result.response as object },
      },
    });

    await writeAuditLogDirect({
      entityType: "ProductionHandoff",
      entityId: handoffId.toString(),
      action: "ERP_SYNCED",
      userId: actorId,
      correlationId,
      after: updated,
    });

    await enqueueOutboxAndNotify(
      "ERP_HANDOFF_SYNCED",
      {
        handoffId: handoffId.toString(),
        erpModule: handoff.erpModule,
        erpReference: result.erpReference,
        designId: handoff.designId.toString(),
      },
      correlationId,
    );

    return updated;
  } catch (error) {
    const updated = await prisma.productionHandoff.update({
      where: { id: handoffId },
      data: {
        status: "FAILED",
        payload: {
          ...(handoff.payload as object),
          error: error instanceof Error ? error.message : String(error),
        },
      },
    });

    await enqueueOutboxAndNotify(
      "ERP_HANDOFF_FAILED",
      {
        handoffId: handoffId.toString(),
        erpModule: handoff.erpModule,
        designId: handoff.designId.toString(),
      },
      correlationId,
    );

    throw new ApiError(
      `ERP sync failed for ${handoff.erpModule}`,
      502,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Sync Grey, Cutting, Sales handoffs for a design (called after production release). */
export async function syncPrimaryErpModules(
  designId: bigint,
  actorId: number,
  correlationId: string,
) {
  const handoffs = await prisma.productionHandoff.findMany({
    where: {
      designId,
      erpModule: { in: [...PRIMARY_ERP_MODULES] },
      status: "QUEUED",
    },
  });

  const results = [];
  for (const handoff of handoffs) {
    try {
      const synced = await syncProductionHandoff(handoff.id, actorId, correlationId);
      results.push({ handoffId: handoff.id.toString(), status: synced.status, erpModule: handoff.erpModule });
    } catch {
      results.push({ handoffId: handoff.id.toString(), status: "FAILED", erpModule: handoff.erpModule });
    }
  }
  return results;
}
