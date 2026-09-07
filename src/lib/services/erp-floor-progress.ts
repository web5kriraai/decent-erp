import { ERP_FLOOR_MODULES } from "@/lib/erp-rbac";
import { ERP_STAGE_LABELS } from "@/lib/services/erp-stage-constants";

export type FloorErpProgress = {
  ok: boolean;
  completed: number;
  total: number;
  missing: string[];
};

/** Pure Floor progress for PROD_RELEASE gate (no DB). */
export function computeFloorErpProgress(
  stages: Array<{ erpModule: string; status: string }>,
): FloorErpProgress {
  const total = ERP_FLOOR_MODULES.length;
  if (stages.length === 0) {
    return {
      ok: false,
      completed: 0,
      total,
      missing: ["Floor ERP stages (start Production Release to seed the chain)"],
    };
  }

  const byModule = new Map(stages.map((s) => [s.erpModule, s.status]));
  const missing: string[] = [];
  let completed = 0;
  for (const module of ERP_FLOOR_MODULES) {
    const status = byModule.get(module);
    if (status === "COMPLETED") {
      completed += 1;
      continue;
    }
    const label =
      ERP_STAGE_LABELS[module as keyof typeof ERP_STAGE_LABELS] ?? module.replaceAll("_", " ");
    missing.push(status ? `${label} (${status.toLowerCase().replaceAll("_", " ")})` : label);
  }

  return { ok: missing.length === 0, completed, total, missing };
}
