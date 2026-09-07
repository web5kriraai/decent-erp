/** Pure pattern-aware production release stage gaps (no DB). */

import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";

const SATISFIED = new Set(["COMPLETED", "CHECKING", "CANCELLED", "SKIPPED"]);

/** Textile-friendly labels for parity with historical readiness messages. */
const TEXTILE_LABELS: Record<string, { label: string; fileLabel?: string }> = {
  SKETCH: { label: "Sketch work", fileLabel: "Sketch file" },
  SKETCH_APPROVAL: { label: "Sketch approval" },
  PUNCH: { label: "Punching / Wilcom work", fileLabel: "Punching file" },
  PUNCH_CHECK: { label: "Punching checking approval" },
  MAT_REQ: { label: "Material requirement" },
  FABRIC_ISSUE: { label: "Fabric / component issue" },
  MACHINE_SAMPLE: { label: "Machine sample" },
  SAMPLE_CHECK: { label: "Sample approval" },
  FINAL_APPROVAL: { label: "Design Head final approval stage" },
  PROD_HANDOFF: { label: "Production handoff from Design Head" },
  PROD_INSTRUCTION: { label: "Production instruction" },
};

export type ReadinessTaskSnapshot = {
  status: string;
  isFileRequired?: boolean;
  hasFile?: boolean;
  isApproval?: boolean;
  capabilities?: unknown;
  code?: string;
  name?: string;
};

/**
 * Design-side and production-ladder stages required only when present on the design.
 * Absent PROD_HANDOFF / PROD_INSTRUCTION are not gaps (flexible / short patterns).
 */
export function collectPresentStageGaps(
  tasksByCode: Record<string, ReadinessTaskSnapshot | undefined>,
): string[] {
  const missing: string[] = [];

  for (const [code, task] of Object.entries(tasksByCode)) {
    if (!task) continue;
    if (code === "PROD_RELEASE" || code === "LIVE_REVIEW") continue;

    const behavior = resolveStageBehavior({
      code,
      isApproval: task.isApproval,
      isFileRequired: task.isFileRequired,
      capabilities: task.capabilities,
    });

    const textile = TEXTILE_LABELS[code];
    const label = textile?.label ?? task.name ?? code;

    if (code === "PROD_HANDOFF" || code === "PROD_INSTRUCTION") {
      if (task.status !== "COMPLETED") {
        missing.push(textile?.label ?? label);
      }
      continue;
    }

    const mustBeCompleted = behavior.isApproval;
    const ok = mustBeCompleted ? task.status === "COMPLETED" : SATISFIED.has(task.status);
    if (!ok) {
      missing.push(label);
      continue;
    }

    const requiresFile = task.isFileRequired === true;
    if (requiresFile && !task.hasFile) {
      missing.push(textile?.fileLabel ?? `${label} file`);
    }
  }

  return missing;
}
