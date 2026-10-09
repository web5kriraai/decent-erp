import { z } from "zod";

/** Partner success-metrics payload (Sales / Sales Return refresh). */
export type ErpDesignSuccessPayload = {
  productionQty?: number;
  salesQty?: number;
  salesValue?: number;
  returnQty?: number;
  marginPercent?: number;
  repeatOrders?: number;
  periodYear?: number;
  periodMonth?: number;
  /** Aliases accepted for partner flexibility */
  producedQty?: number;
  soldQty?: number;
  revenue?: number;
  cost?: number;
  margin?: number;
};

export type NormalizedDesignSuccessMetrics = {
  productionQty?: number;
  salesQty?: number;
  salesValue?: number;
  returnQty?: number;
  marginPercent?: number;
  repeatOrders?: number;
  periodYear?: number;
  periodMonth?: number;
};

const optionalNumber = z.coerce.number().finite().optional();

/** Loose Zod schema - unknown partner fields ignored; numbers coerced when present. */
export const erpDesignSuccessPayloadSchema = z
  .object({
    productionQty: optionalNumber,
    salesQty: optionalNumber,
    salesValue: optionalNumber,
    returnQty: optionalNumber,
    marginPercent: optionalNumber,
    repeatOrders: optionalNumber,
    periodYear: optionalNumber,
    periodMonth: optionalNumber,
    producedQty: optionalNumber,
    soldQty: optionalNumber,
    revenue: optionalNumber,
    cost: optionalNumber,
    margin: optionalNumber,
  })
  .passthrough();

export function parseErpDesignSuccessPayload(
  raw: unknown,
): { ok: true; data: ErpDesignSuccessPayload } | { ok: false; reason: string } {
  const parsed = erpDesignSuccessPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "Live ERP returned an invalid success-metrics payload." };
  }
  return { ok: true, data: parsed.data as ErpDesignSuccessPayload };
}

function deriveMarginPercent(salesValue?: number, cost?: number, explicit?: number): number | undefined {
  if (explicit != null && Number.isFinite(explicit)) return explicit;
  if (
    salesValue != null &&
    cost != null &&
    Number.isFinite(salesValue) &&
    Number.isFinite(cost) &&
    salesValue !== 0
  ) {
    return Number((((salesValue - cost) / salesValue) * 100).toFixed(2));
  }
  return undefined;
}

/** Maps partner aliases onto DesignSuccessMetric fields. */
export function normalizeDesignSuccessPayload(
  json: ErpDesignSuccessPayload,
): NormalizedDesignSuccessMetrics {
  const salesValue = json.salesValue ?? json.revenue;
  const marginExplicit = json.marginPercent ?? json.margin;
  return {
    productionQty: json.productionQty ?? json.producedQty,
    salesQty: json.salesQty ?? json.soldQty,
    salesValue,
    returnQty: json.returnQty,
    marginPercent: deriveMarginPercent(salesValue, json.cost, marginExplicit),
    repeatOrders: json.repeatOrders,
    periodYear: json.periodYear,
    periodMonth: json.periodMonth,
  };
}

export function hasIngestableDesignSuccessMetrics(
  metrics: NormalizedDesignSuccessMetrics,
): boolean {
  return (
    metrics.productionQty != null ||
    metrics.salesQty != null ||
    metrics.salesValue != null ||
    metrics.marginPercent != null ||
    metrics.returnQty != null
  );
}
