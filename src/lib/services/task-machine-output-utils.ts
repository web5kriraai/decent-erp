import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";

/** Machine sample / receive / resample tasks record stitch, format, and qty metrics. */
export function isMachineOutputTask(
  subProcessCode?: string | null,
  capabilities?: unknown,
): boolean {
  if (!subProcessCode) return false;
  return resolveStageBehavior({ code: subProcessCode, capabilities }).machineOutput;
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
  capabilities?: unknown,
): boolean {
  if (!hasMachineMetricsInPayload(body)) return true;
  return isMachineOutputTask(subProcessCode, capabilities);
}

export const MACHINE_FORMAT_OPTIONS = [
  { value: "EMB", label: "EMB" },
  { value: "DST", label: "DST" },
  { value: "OTHER", label: "Other" },
] as const;
