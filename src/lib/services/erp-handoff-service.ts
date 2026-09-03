import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { upsertDesignSuccessMetric } from "@/lib/services/production-service";
import {
  ERP_MODULE_SYNC_ORDER,
  PRIMARY_ERP_MODULES,
  getErpIntegrationMode,
} from "@/lib/services/erp-integration-config";
import {
  hasIngestableDesignSuccessMetrics,
  normalizeDesignSuccessPayload,
  type ErpDesignSuccessPayload,
} from "@/lib/services/erp-design-success-payload";

export type { ErpDesignSuccessPayload } from "@/lib/services/erp-design-success-payload";
export { normalizeDesignSuccessPayload } from "@/lib/services/erp-design-success-payload";

export {
  ERP_MODULE_SYNC_ORDER,
  getErpIntegrationMode,
  isSimulatedErpReference,
  PRIMARY_ERP_MODULES,
  DOWNSTREAM_ERP_MODULES,
} from "@/lib/services/erp-integration-config";
export type { ErpIntegrationMode } from "@/lib/services/erp-integration-config";

type ErpModule = (typeof PRIMARY_ERP_MODULES)[number] | string;

/** Modules whose successful sync should refresh Design Success metrics from live ERP. */
const DESIGN_SUCCESS_TRIGGER_MODULES = new Set(["SALES", "SALES_RETURN"]);

export const ERP_HANDOFF_CONTRACT_VERSION = 1;

type HandoffPayload = {
  contractVersion: number;
  designId: string;
  designNumber: string;
  ideaRef: string;
  collectionName: string;
  productTypeId: number;
  productTypeName?: string | null;
  seasonId?: number | null;
  seasonName?: string | null;
  sourceModule: "DESIGN_MANAGEMENT";
};

const MODULE_ENDPOINTS: Record<string, string> = {
  GREY_MATERIAL: "/grey-material/designs",
  CUTTING: "/cutting/designs",
  EMBROIDERY: "/embroidery/designs",
  GARMENTING: "/garmenting/designs",
  FINISHING: "/finishing/designs",
  READY_STOCK: "/ready-stock/designs",
  SALES: "/sales/designs",
  SALES_RETURN: "/sales-return/designs",
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
      contractVersion: payload.contractVersion,
      sourceModule: payload.sourceModule,
      designId: payload.designId,
      designNumber: payload.designNumber,
      ideaRef: payload.ideaRef,
      collectionName: payload.collectionName,
      productTypeId: payload.productTypeId,
      productTypeName: payload.productTypeName ?? null,
      seasonId: payload.seasonId ?? null,
      seasonName: payload.seasonName ?? null,
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

function buildHandoffPayload(input: {
  designId: bigint;
  designNumber: string;
  ideaRef: string;
  collectionName: string;
  productTypeId: number;
  productTypeName?: string | null;
  seasonId?: number | null;
  seasonName?: string | null;
}): HandoffPayload {
  return {
    contractVersion: ERP_HANDOFF_CONTRACT_VERSION,
    sourceModule: "DESIGN_MANAGEMENT",
    designId: input.designId.toString(),
    designNumber: input.designNumber,
    ideaRef: input.ideaRef,
    collectionName: input.collectionName,
    productTypeId: input.productTypeId,
    productTypeName: input.productTypeName ?? null,
    seasonId: input.seasonId ?? null,
    seasonName: input.seasonName ?? null,
  };
}

export async function syncProductionHandoff(
  handoffId: bigint,
  actorId: number,
  correlationId: string,
) {
  const handoff = await prisma.productionHandoff.findUnique({
    where: { id: handoffId },
    include: {
      design: {
        include: {
          productType: { select: { name: true } },
          season: { select: { name: true } },
        },
      },
    },
  });
  if (!handoff) throw new ApiError("Handoff not found", 404);
  if (handoff.status === "SYNCED") {
    return handoff;
  }

  const payload = buildHandoffPayload({
    designId: handoff.designId,
    designNumber: handoff.designNumber,
    ideaRef: handoff.design.ideaRef,
    collectionName: handoff.design.collectionName,
    productTypeId: handoff.design.productTypeId,
    productTypeName: handoff.design.productType?.name,
    seasonId: handoff.design.seasonId,
    seasonName: handoff.design.season?.name,
  });

  try {
    const result = await postToErpModule(handoff.erpModule, payload);
    const updated = await prisma.productionHandoff.update({
      where: { id: handoffId },
      data: {
        status: "SYNCED",
        erpReference: result.erpReference,
        payload: {
          ...(typeof handoff.payload === "object" && handoff.payload !== null
            ? (handoff.payload as object)
            : {}),
          ...payload,
          syncResponse: result.response as object,
        },
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
    await prisma.productionHandoff.update({
      where: { id: handoffId },
      data: {
        status: "FAILED",
        payload: {
          ...(typeof handoff.payload === "object" && handoff.payload !== null
            ? (handoff.payload as object)
            : {}),
          ...payload,
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

/** Sync all ERP handoffs for a design in module order (primary first, then downstream). */
export async function syncAllErpModules(
  designId: bigint,
  actorId: number,
  correlationId: string,
) {
  const handoffs = await prisma.productionHandoff.findMany({
    where: {
      designId,
      erpModule: { in: [...ERP_MODULE_SYNC_ORDER] },
      status: { in: ["QUEUED", "FAILED"] },
    },
  });

  const orderIndex = new Map(ERP_MODULE_SYNC_ORDER.map((module, index) => [module, index]));
  handoffs.sort(
    (a, b) =>
      (orderIndex.get(a.erpModule as (typeof ERP_MODULE_SYNC_ORDER)[number]) ?? 99) -
      (orderIndex.get(b.erpModule as (typeof ERP_MODULE_SYNC_ORDER)[number]) ?? 99),
  );

  const results = [];
  for (const handoff of handoffs) {
    try {
      const synced = await syncProductionHandoff(handoff.id, actorId, correlationId);
      results.push({
        handoffId: handoff.id.toString(),
        status: synced.status,
        erpModule: handoff.erpModule,
        erpReference: synced.erpReference,
      });
      if (DESIGN_SUCCESS_TRIGGER_MODULES.has(handoff.erpModule) && synced.status === "SYNCED") {
        await ingestDesignSuccessFromErp(designId, synced.designNumber).catch(() => undefined);
      }
    } catch {
      results.push({
        handoffId: handoff.id.toString(),
        status: "FAILED",
        erpModule: handoff.erpModule,
      });
    }
  }
  return results;
}

/** @deprecated Use syncAllErpModules */
export async function syncPrimaryErpModules(
  designId: bigint,
  actorId: number,
  correlationId: string,
) {
  return syncAllErpModules(designId, actorId, correlationId);
}

export async function syncDesignHandoffs(
  designId: bigint,
  actorId: number,
  correlationId: string,
) {
  return syncAllErpModules(designId, actorId, correlationId);
}

/** Partner success-metrics payload (Sales / Sales Return refresh). */
export type DesignSuccessIngestResult = {
  ingested: boolean;
  mode: "simulated" | "live";
  reason?: string;
  metric?: Awaited<ReturnType<typeof upsertDesignSuccessMetric>>;
};

export async function ingestDesignSuccessFromErp(
  designId: bigint,
  designNumber: string,
): Promise<DesignSuccessIngestResult> {
  const mode = getErpIntegrationMode();
  const now = new Date();
  const periodYear = now.getUTCFullYear();
  const periodMonth = now.getUTCMonth() + 1;

  if (mode === "simulated") {
    return {
      ingested: false,
      mode,
      reason:
        "ERP_API_BASE_URL is not configured — design-success metrics are not fabricated in simulated mode. Add metrics manually or configure live ERP.",
    };
  }

  const base = process.env.ERP_API_BASE_URL!.replace(/\/$/, "");
  const url = `${base}/sales/designs/${encodeURIComponent(designNumber)}/success-metrics?year=${periodYear}&month=${periodMonth}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ERP_API_KEY ? { Authorization: `Bearer ${process.env.ERP_API_KEY}` } : {}),
    },
  });

  if (!res.ok) {
    return {
      ingested: false,
      mode,
      reason: `Live ERP returned ${res.status} for design ${designNumber}.`,
    };
  }

  const json = (await res.json()) as ErpDesignSuccessPayload;
  const normalized = normalizeDesignSuccessPayload(json);
  if (!hasIngestableDesignSuccessMetrics(normalized)) {
    return {
      ingested: false,
      mode,
      reason: "Live ERP returned no production/sales/return/margin metrics for this design.",
    };
  }

  const metric = await upsertDesignSuccessMetric(designId, {
    periodYear: normalized.periodYear ?? periodYear,
    periodMonth: normalized.periodMonth ?? periodMonth,
    productionQty: normalized.productionQty,
    salesQty: normalized.salesQty,
    salesValue: normalized.salesValue,
    returnQty: normalized.returnQty,
    marginPercent: normalized.marginPercent,
    repeatOrders: normalized.repeatOrders,
  });

  return { ingested: true, mode, metric };
}
