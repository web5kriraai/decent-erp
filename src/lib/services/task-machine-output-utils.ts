/** Machine sample / receive / resample tasks record stitch, format, and qty metrics. */
export function isMachineOutputTask(subProcessCode?: string | null): boolean {
  const code = subProcessCode?.toUpperCase() ?? "";
  return (
    code === "MACHINE_SAMPLE" ||
    code === "SAMPLE_RECEIVE" ||
    code.includes("RESAMPLE")
  );
}

export const MACHINE_FORMAT_OPTIONS = [
  { value: "EMB", label: "EMB" },
  { value: "DST", label: "DST" },
  { value: "OTHER", label: "Other" },
] as const;
