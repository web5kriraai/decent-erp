import type { KanbanDesignItem } from "@/lib/types/api";

/** Seven dashboard lanes mapped from real workflow stage codes. */
export const WORKFLOW_LANES = [
  {
    id: "new_idea",
    label: "New Idea",
    codes: ["CONCEPT_REVIEW", "CONCEPT"],
  },
  {
    id: "sketch",
    label: "Sketch",
    codes: ["SKETCH", "SKETCH_APPROVAL"],
  },
  {
    id: "punching",
    label: "Punching",
    codes: ["PUNCH", "PUNCH_CHECK"],
  },
  {
    id: "machine_sample",
    label: "Machine Sample",
    codes: [
      "MACHINE_SAMPLE",
      "SAMPLE_CUTTING",
      "SAMPLE_STITCHING",
      "SAMPLE_RECEIVE",
      "SAMPLE_CHECK",
      "MAT_REQ",
      "FABRIC_ISSUE",
    ],
  },
  {
    id: "correction",
    label: "Correction",
    codes: ["CORRECTION"],
  },
  {
    id: "final_approval",
    label: "Final Approval",
    codes: ["COSTING", "FINAL_APPROVAL"],
  },
  {
    id: "production_release",
    label: "Production Release",
    codes: ["PROD_HANDOFF", "PROD_INSTRUCTION", "PROD_RELEASE", "LIVE_REVIEW", "DONE"],
  },
] as const;

export type WorkflowLaneId = (typeof WORKFLOW_LANES)[number]["id"];

export const KANBAN_PAGE_SIZES = [10, 25, 50, 100] as const;

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

type LaneDesign = {
  status: string;
  priority: string;
  createdAtUtc?: string;
  currentStage?: string | null;
  openCorrectionCount?: number;
  workflow: { currentStageCode?: string | null };
};

export function resolveLaneId(design: LaneDesign): WorkflowLaneId {
  if (
    (design.openCorrectionCount ?? 0) > 0 ||
    design.status === "ON_HOLD" ||
    (design.workflow.currentStageCode ?? "").includes("CORRECTION") ||
    (design.currentStage ?? "").includes("CORRECTION")
  ) {
    return "correction";
  }

  if (
    ["APPROVED", "PRODUCTION_ACCEPTED", "PRODUCTION_RELEASED", "LIVE"].includes(design.status)
  ) {
    return "production_release";
  }

  if (design.status === "APPROVAL_PENDING") {
    return "final_approval";
  }

  const code = (design.workflow.currentStageCode ?? design.currentStage ?? "").toUpperCase();

  if (!code || design.status === "DRAFT") {
    return "new_idea";
  }

  for (const lane of WORKFLOW_LANES) {
    if (lane.id === "correction") continue;
    if (lane.codes.some((c) => code === c || code.startsWith(`${c}_`))) {
      return lane.id;
    }
    if (lane.id === "machine_sample" && code.startsWith("SAMPLE_")) {
      return "machine_sample";
    }
    if (lane.id === "production_release" && code.startsWith("PROD_")) {
      return "production_release";
    }
  }

  if (code.includes("SKETCH")) return "sketch";
  if (code.includes("PUNCH")) return "punching";
  if (code.includes("COST") || code.includes("APPROVAL")) return "final_approval";

  return "new_idea";
}

function createdTime(design: { createdAtUtc?: string }): number {
  const time = design.createdAtUtc ? new Date(design.createdAtUtc).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

/** Newest design first. Same moment keeps High above Medium above Low. */
export function compareBoardCards(a: KanbanDesignItem, b: KanbanDesignItem): number {
  const createdDiff = createdTime(b) - createdTime(a);
  if (createdDiff !== 0) return createdDiff;
  return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
}

export function clampKanbanPageSize(value: number): number {
  return (KANBAN_PAGE_SIZES as readonly number[]).includes(value) ? value : 10;
}
