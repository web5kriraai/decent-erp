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

/** Maps partner aliases onto DesignSuccessMetric fields. */
export function normalizeDesignSuccessPayload(
  json: ErpDesignSuccessPayload,
): NormalizedDesignSuccessMetrics {
  return {
    productionQty: json.productionQty ?? json.producedQty,
    salesQty: json.salesQty ?? json.soldQty,
    salesValue: json.salesValue ?? json.revenue,
    returnQty: json.returnQty,
    marginPercent: json.marginPercent ?? json.margin,
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
