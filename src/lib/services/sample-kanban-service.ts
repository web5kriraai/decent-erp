import { prisma } from "@/lib/db";

export type SampleKanbanLaneId =
  | "concept"
  | "sketch"
  | "punching"
  | "materials"
  | "machine_sample"
  | "correction"
  | "review"
  | "pass"
  | "hold"
  | "reject";

export const SAMPLE_KANBAN_LANES: Array<{
  id: SampleKanbanLaneId;
  label: string;
  codes?: string[];
}> = [
  { id: "concept", label: "Concept", codes: ["CONCEPT_REVIEW", "CONCEPT"] },
  { id: "sketch", label: "Sketch", codes: ["SKETCH", "SKETCH_APPROVAL"] },
  { id: "punching", label: "Punching", codes: ["PUNCH", "PUNCH_CHECK"] },
  {
    id: "materials",
    label: "Materials",
    codes: ["MAT_REQ", "FABRIC_ISSUE", "BOM"],
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
      "RESAMPLE",
    ],
  },
  { id: "correction", label: "Correction", codes: ["CORRECTION"] },
  {
    id: "review",
    label: "Review",
    codes: ["COSTING", "FINAL_APPROVAL", "PROD_HANDOFF", "PROD_INSTRUCTION", "PROD_RELEASE", "LIVE_REVIEW"],
  },
  { id: "pass", label: "Pass" },
  { id: "hold", label: "Hold" },
  { id: "reject", label: "Reject" },
];

export function resolveSampleKanbanLane(input: {
  sampleDecision: string | null;
  currentStage: string | null;
  status: string;
  openCorrectionCount?: number;
}): SampleKanbanLaneId {
  if (input.sampleDecision === "PASS") return "pass";
  if (input.sampleDecision === "HOLD") return "hold";
  if (input.sampleDecision === "REJECT") return "reject";

  if (
    (input.openCorrectionCount ?? 0) > 0 ||
    input.status === "ON_HOLD" ||
    (input.currentStage ?? "").toUpperCase().includes("CORRECTION")
  ) {
    return "correction";
  }

  const code = (input.currentStage ?? "").toUpperCase();
  if (!code || input.status === "DRAFT") return "concept";

  for (const lane of SAMPLE_KANBAN_LANES) {
    if (!lane.codes) continue;
    if (lane.codes.some((c) => code === c || code.startsWith(`${c}_`))) {
      return lane.id;
    }
    if (lane.id === "machine_sample" && code.startsWith("SAMPLE_")) {
      return "machine_sample";
    }
  }

  if (code.includes("SKETCH")) return "sketch";
  if (code.includes("PUNCH")) return "punching";
  if (code.includes("MAT") || code.includes("FABRIC") || code.includes("BOM")) {
    return "materials";
  }
  if (code.includes("COST") || code.includes("APPROVAL") || code.startsWith("PROD_")) {
    return "review";
  }

  return "concept";
}

export async function getSampleKanbanBoard() {
  const { getPresignedDownloadUrl } = await import("@/lib/storage");

  const designs = await prisma.designConcept.findMany({
    where: { status: { notIn: ["CLOSED"] } },
    orderBy: { updatedAtUtc: "desc" },
    take: 500,
    include: {
      productType: { select: { name: true, code: true } },
      season: { select: { id: true, name: true } },
      designHead: { select: { id: true, name: true } },
      images: {
        where: { mediaKind: "IMAGE" },
        orderBy: [{ isPrimary: "desc" }, { uploadedAtUtc: "desc" }],
        take: 1,
        select: { storageKey: true },
      },
      corrections: {
        where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"] } },
        select: { id: true },
      },
    },
  });

  const items = await Promise.all(
    designs.map(async (design) => {
      const openCorrectionCount = design.corrections.length;
      const laneId = resolveSampleKanbanLane({
        sampleDecision: design.sampleDecision,
        currentStage: design.currentStage,
        status: design.status,
        openCorrectionCount,
      });

      let primaryImageUrl: string | null = null;
      const key = design.images[0]?.storageKey;
      if (key) {
        try {
          primaryImageUrl = await getPresignedDownloadUrl(key);
        } catch {
          primaryImageUrl = null;
        }
      }

      return {
        id: design.id.toString(),
        ideaRef: design.ideaRef,
        collectionName: design.collectionName,
        status: design.status,
        currentStage: design.currentStage,
        sampleDecision: design.sampleDecision,
        priority: design.priority,
        productType: design.productType,
        designHead: design.designHead,
        season: design.season,
        primaryImageUrl,
        openCorrectionCount,
        laneId,
      };
    }),
  );

  const counts = Object.fromEntries(
    SAMPLE_KANBAN_LANES.map((lane) => [
      lane.id,
      items.filter((i) => i.laneId === lane.id).length,
    ]),
  ) as Record<SampleKanbanLaneId, number>;

  return {
    lanes: SAMPLE_KANBAN_LANES,
    counts,
    items,
    summary: {
      total: items.length,
      pendingDecision: items.filter((i) => !i.sampleDecision).length,
      pass: counts.pass,
      hold: counts.hold,
      reject: counts.reject,
    },
  };
}
