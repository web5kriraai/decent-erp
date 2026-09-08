import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";

export const MACHINE_FORMATS = ["EMB", "DST", "OTHER"] as const;
export type MachineFormat = (typeof MACHINE_FORMATS)[number];

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

/** Prefer the SAMPLE_OUTPUT row that already carries metrics (or a file). */
export function pickPreferredSampleOutput<
  T extends {
    artifactType: string;
    uploadedAtUtc?: string | Date | null;
    stitchCount?: number | null;
    machineFormat?: string | null;
    sampleQty?: number | null;
    wastageQty?: number | null;
    storageKey?: string | null;
  },
>(artifacts: T[]): T | null {
  const sampleOutputs = artifacts.filter((a) => a.artifactType === "SAMPLE_OUTPUT");
  if (sampleOutputs.length === 0) return null;

  const scored = [...sampleOutputs].sort((a, b) => {
    const score = (row: T) => {
      let s = 0;
      if (hasMachineMetricsInPayload(row)) s += 2;
      if (row.storageKey) s += 1;
      return s;
    };
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    const aTime = a.uploadedAtUtc ? new Date(a.uploadedAtUtc).getTime() : 0;
    const bTime = b.uploadedAtUtc ? new Date(b.uploadedAtUtc).getTime() : 0;
    return bTime - aTime;
  });

  return scored[0] ?? null;
}

export function formatMachineOutputSummary(row: {
  stitchCount?: number | null;
  machineFormat?: string | null;
  sampleQty?: number | null;
  wastageQty?: number | null;
} | null | undefined): string | null {
  if (!row || !hasMachineMetricsInPayload(row)) return null;
  const parts = [
    row.machineFormat?.trim() || null,
    row.sampleQty != null ? `${row.sampleQty} pcs` : null,
    row.stitchCount != null ? `${row.stitchCount.toLocaleString()} stitches` : null,
    row.wastageQty != null ? `${row.wastageQty} wastage` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export const MACHINE_FORMAT_OPTIONS = [
  { value: "EMB", label: "EMB" },
  { value: "DST", label: "DST" },
  { value: "OTHER", label: "Other" },
] as const;
