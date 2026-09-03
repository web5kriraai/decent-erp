/** Pure pattern-aware production release stage gaps (no DB). */

const SATISFIED = new Set(["COMPLETED", "CHECKING", "CANCELLED", "SKIPPED"]);

export type ReadinessTaskSnapshot = {
  status: string;
  isFileRequired?: boolean;
  hasFile?: boolean;
};

/**
 * Design-side stages required only when present; PROD ladder required when present
 * (or reported missing if absent — caller ensures ladder was appended).
 */
export function collectPresentStageGaps(
  tasksByCode: Record<string, ReadinessTaskSnapshot | undefined>,
): string[] {
  const missing: string[] = [];

  function check(
    code: string,
    label: string,
    options?: { mustBeCompleted?: boolean; fileLabel?: string },
  ) {
    const task = tasksByCode[code];
    if (!task) return;
    const ok = options?.mustBeCompleted
      ? task.status === "COMPLETED"
      : SATISFIED.has(task.status);
    if (!ok) {
      missing.push(label);
      return;
    }
    if (task.isFileRequired && !task.hasFile) {
      missing.push(options?.fileLabel ?? `${label} file`);
    }
  }

  check("SKETCH", "Sketch work", { fileLabel: "Sketch file" });
  check("SKETCH_APPROVAL", "Sketch approval", { mustBeCompleted: true });
  check("PUNCH", "Punching / Wilcom work", { fileLabel: "Punching file" });
  check("PUNCH_CHECK", "Punching checking approval", { mustBeCompleted: true });
  check("MAT_REQ", "Material requirement");
  check("FABRIC_ISSUE", "Fabric / component issue");
  check("MACHINE_SAMPLE", "Machine sample");
  check("SAMPLE_CHECK", "Sample approval", { mustBeCompleted: true });
  check("FINAL_APPROVAL", "Design Head final approval stage", { mustBeCompleted: true });

  const handoff = tasksByCode.PROD_HANDOFF;
  if (!handoff || handoff.status !== "COMPLETED") {
    missing.push("Production handoff from Design Head");
  }
  const instruction = tasksByCode.PROD_INSTRUCTION;
  if (!instruction || instruction.status !== "COMPLETED") {
    missing.push("Production instruction");
  }

  return missing;
}
