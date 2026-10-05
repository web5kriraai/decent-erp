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
  needleCount?: number | null;
  colorCount?: number | null;
  hoopSize?: string | null;
  softwareName?: string | null;
  stitchDensity?: number | null;
}): boolean {
  return (
    body.stitchCount != null ||
    body.sampleQty != null ||
    body.wastageQty != null ||
    body.needleCount != null ||
    body.colorCount != null ||
    body.stitchDensity != null ||
    !!(body.machineFormat && body.machineFormat.trim()) ||
    !!(body.hoopSize && body.hoopSize.trim()) ||
    !!(body.softwareName && body.softwareName.trim())
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

/** Prefer SAMPLE_OUTPUT or PUNCHING_FILE row that already carries metrics (or a file). */
export function pickPreferredSampleOutput<
  T extends {
    artifactType: string;
    uploadedAtUtc?: string | Date | null;
    stitchCount?: number | null;
    machineFormat?: string | null;
    sampleQty?: number | null;
    wastageQty?: number | null;
    needleCount?: number | null;
    colorCount?: number | null;
    hoopSize?: string | null;
    softwareName?: string | null;
    storageKey?: string | null;
  },
>(artifacts: T[]): T | null {
  const candidates = artifacts.filter(
    (a) => a.artifactType === "SAMPLE_OUTPUT" || a.artifactType === "PUNCHING_FILE",
  );
  if (candidates.length === 0) return null;

  const scored = [...candidates].sort((a, b) => {
    const score = (row: T) => {
      let s = 0;
      if (hasMachineMetricsInPayload(row)) s += 2;
      if (row.storageKey) s += 1;
      if (row.artifactType === "PUNCHING_FILE") s += 0.5;
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

/** True when any SAMPLE_OUTPUT / PUNCHING_FILE row carries machine metrics. */
export function artifactsIncludeMachineMetrics(
  artifacts: Array<{
    artifactType: string;
    stitchCount?: number | null;
    machineFormat?: string | null;
    sampleQty?: number | null;
    wastageQty?: number | null;
    needleCount?: number | null;
    colorCount?: number | null;
    hoopSize?: string | null;
    softwareName?: string | null;
    stitchDensity?: number | null;
  }>,
): boolean {
  return artifacts.some(
    (row) =>
      (row.artifactType === "SAMPLE_OUTPUT" || row.artifactType === "PUNCHING_FILE") &&
      hasMachineMetricsInPayload(row),
  );
}

export const MACHINE_FORMAT_OPTIONS = [
  { value: "EMB", label: "EMB" },
  { value: "DST", label: "DST" },
  { value: "OTHER", label: "Other" },
] as const;
