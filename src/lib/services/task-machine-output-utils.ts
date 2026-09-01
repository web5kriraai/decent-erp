/** Machine sample / receive / resample tasks record stitch, format, and qty metrics. */
export function isMachineOutputTask(subProcessCode?: string | null): boolean {
  const code = subProcessCode?.toUpperCase() ?? "";
  return (
    code === "MACHINE_SAMPLE" ||
    code === "SAMPLE_RECEIVE" ||
    code.includes("RESAMPLE")
  );
}

export function hasMachineMetricsInPayload(body: {
  stitchCount?: number | null;
  machineFormat?: string | null;
  sampleQty?: number | null;
  wastageQty?: number | null;
}): boolean {
  return (
    body.stitchCount != null ||
    body.sampleQty != null ||
    body.wastageQty != null ||
    !!(body.machineFormat && body.machineFormat.trim())
  );
}

export function canRecordMachineMetrics(
  subProcessCode: string | null | undefined,
  body: {
    stitchCount?: number | null;
    machineFormat?: string | null;
    sampleQty?: number | null;
    wastageQty?: number | null;
  },
): boolean {
  if (!hasMachineMetricsInPayload(body)) return true;
  return isMachineOutputTask(subProcessCode);
}

export const MACHINE_FORMAT_OPTIONS = [
  { value: "EMB", label: "EMB" },
  { value: "DST", label: "DST" },
  { value: "OTHER", label: "Other" },
] as const;
