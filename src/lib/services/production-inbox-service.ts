import { prisma } from "@/lib/db";

const PROD_CODES = ["PROD_HANDOFF", "PROD_INSTRUCTION", "PROD_RELEASE"] as const;

type ProdTask = {
  id: bigint;
  status: string;
  subProcess: { code: string; name: string };
  assignedEmployee: { id: number; name: string } | null;
};

export type ProductionInboxDesign = {
  designId: string;
  ideaRef: string;
  collectionName: string;
  status: string;
  productType: string;
  designHead: string;
  handoffTaskId?: string;
  instructionTaskId?: string;
  releaseTaskId?: string;
  instructionStatus?: string;
  needsAcceptance?: boolean;
  correctionId?: string;
  section: ProductionInboxSection;
  stageLabel: string;
  assigneeName?: string;
};

export type ProductionInboxSection =
  | "handoff_pending"
  | "ready_for_acceptance"
  | "instruction_pending"
  | "ready_for_release"
  | "released"
  | "returned_clarification";

export type ProductionInboxResponse = {
  handoffPending: ProductionInboxDesign[];
  readyForAcceptance: ProductionInboxDesign[];
  instructionPending: ProductionInboxDesign[];
  readyForRelease: ProductionInboxDesign[];
  released: ProductionInboxDesign[];
  returnedClarification: ProductionInboxDesign[];
  counts: Record<ProductionInboxSection, number>;
};

function taskByCode(tasks: ProdTask[], code: string): ProdTask | undefined {
  return tasks.find((t) => t.subProcess.code === code);
}

function classifyProductionDesign(
  design: {
    id: bigint;
    ideaRef: string;
    collectionName: string;
    status: string;
    productType: { name: string };
    designHead: { name: string };
    tasks: ProdTask[];
  },
): ProductionInboxDesign | null {
  const handoff = taskByCode(design.tasks, "PROD_HANDOFF");
  const instruction = taskByCode(design.tasks, "PROD_INSTRUCTION");
  const release = taskByCode(design.tasks, "PROD_RELEASE");

  const base = {
    designId: design.id.toString(),
    ideaRef: design.ideaRef,
    collectionName: design.collectionName,
    status: design.status,
    productType: design.productType.name,
    designHead: design.designHead.name,
    handoffTaskId: handoff?.id.toString(),
    instructionTaskId: instruction?.id.toString(),
    releaseTaskId: release?.id.toString(),
    instructionStatus: instruction?.status,
  };

  if (design.status === "PRODUCTION_RELEASED" || design.status === "LIVE") {
    return {
      ...base,
      section: "released",
      stageLabel: design.status === "LIVE" ? "Live" : "Production released",
    };
  }

  if (!handoff && !instruction && !release) {
    return null;
  }

  if (handoff && handoff.status !== "COMPLETED") {
    return {
      ...base,
      section: "handoff_pending",
      stageLabel: handoff.subProcess.name,
      assigneeName: handoff.assignedEmployee?.name,
    };
  }

  if (instruction?.status === "PENDING" && handoff?.status === "COMPLETED") {
    return {
      ...base,
      section: "ready_for_acceptance",
      stageLabel: "Accept production handoff",
      needsAcceptance: true,
    };
  }

  if (instruction && instruction.status === "ASSIGNED" && handoff?.status === "COMPLETED") {
    return {
      ...base,
      section: "ready_for_acceptance",
      stageLabel: "Production accepted — start instruction",
      needsAcceptance: false,
      assigneeName: instruction.assignedEmployee?.name,
    };
  }

  if (instruction && ["RUNNING", "ON_HOLD"].includes(instruction.status)) {
    return {
      ...base,
      section: "instruction_pending",
      stageLabel: instruction.subProcess.name,
      assigneeName: instruction.assignedEmployee?.name,
    };
  }

  if (
    instruction?.status === "COMPLETED" &&
    release &&
    release.status !== "COMPLETED" &&
    (design.status === "APPROVED" || design.status === "PRODUCTION_ACCEPTED")
  ) {
    return {
      ...base,
      section: "ready_for_release",
      stageLabel: release.subProcess.name,
      assigneeName: release.assignedEmployee?.name,
    };
  }

  if (
    (design.status === "APPROVED" || design.status === "PRODUCTION_ACCEPTED") &&
    handoff?.status === "COMPLETED"
  ) {
    return {
      ...base,
      section: "ready_for_acceptance",
      stageLabel:
        instruction?.status === "PENDING"
          ? "Accept production handoff"
          : design.status === "PRODUCTION_ACCEPTED"
            ? "Production accepted"
            : "Production workflow",
      needsAcceptance: instruction?.status === "PENDING",
      assigneeName: instruction?.assignedEmployee?.name,
    };
  }

  return null;
}

async function loadReturnedClarificationDesigns(): Promise<ProductionInboxDesign[]> {
  const corrections = await prisma.designCorrection.findMany({
    where: {
      status: "OPEN",
      rootCause: { startsWith: "Production return:" },
      design: { status: { in: ["APPROVED", "PRODUCTION_ACCEPTED", "ACTIVE"] } },
    },
    orderBy: { createdAtUtc: "desc" },
    take: 20,
    include: {
      design: {
        include: {
          productType: { select: { name: true } },
          designHead: { select: { name: true } },
          tasks: {
            where: { subProcess: { code: { in: [...PROD_CODES] } } },
            include: {
              subProcess: { select: { code: true, name: true } },
              assignedEmployee: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const rows: ProductionInboxDesign[] = [];

  for (const correction of corrections) {
    const designId = correction.designId.toString();
    if (seen.has(designId)) continue;
    seen.add(designId);

    const classified = classifyProductionDesign({
      id: correction.design.id,
      ideaRef: correction.design.ideaRef,
      collectionName: correction.design.collectionName,
      status: correction.design.status,
      productType: correction.design.productType,
      designHead: correction.design.designHead,
      tasks: correction.design.tasks,
    });

    rows.push({
      designId,
      ideaRef: correction.design.ideaRef,
      collectionName: correction.design.collectionName,
      status: correction.design.status,
      productType: correction.design.productType.name,
      designHead: correction.design.designHead.name,
      handoffTaskId: classified?.handoffTaskId,
      instructionTaskId: classified?.instructionTaskId,
      releaseTaskId: classified?.releaseTaskId,
      instructionStatus: classified?.instructionStatus,
      correctionId: correction.id.toString(),
      section: "returned_clarification",
      stageLabel: "Returned for clarification",
    });
  }

  return rows;
}

export async function getProductionHeadInbox(
  _employeeId: number,
): Promise<ProductionInboxResponse> {
  const [designs, returnedClarification] = await Promise.all([
    prisma.designConcept.findMany({
      where: {
        status: { in: ["APPROVED", "PRODUCTION_ACCEPTED", "PRODUCTION_RELEASED", "LIVE"] },
      },
      orderBy: { updatedAtUtc: "desc" },
      include: {
        productType: { select: { name: true } },
        designHead: { select: { name: true } },
        tasks: {
          where: { subProcess: { code: { in: [...PROD_CODES] } } },
          include: {
            subProcess: { select: { code: true, name: true } },
            assignedEmployee: { select: { id: true, name: true } },
          },
        },
      },
      take: 100,
    }),
    loadReturnedClarificationDesigns(),
  ]);

  const handoffPending: ProductionInboxDesign[] = [];
  const readyForAcceptance: ProductionInboxDesign[] = [];
  const instructionPending: ProductionInboxDesign[] = [];
  const readyForRelease: ProductionInboxDesign[] = [];
  const released: ProductionInboxDesign[] = [];
  const returnedIds = new Set(returnedClarification.map((r) => r.designId));

  for (const design of designs) {
    const row = classifyProductionDesign(design);
    if (!row) continue;
    if (returnedIds.has(row.designId) && row.section !== "released") {
      continue;
    }
    switch (row.section) {
      case "handoff_pending":
        handoffPending.push(row);
        break;
      case "ready_for_acceptance":
        readyForAcceptance.push(row);
        break;
      case "instruction_pending":
        instructionPending.push(row);
        break;
      case "ready_for_release":
        readyForRelease.push(row);
        break;
      case "released":
        released.push(row);
        break;
    }
  }

  return {
    handoffPending,
    readyForAcceptance,
    instructionPending,
    readyForRelease,
    released,
    returnedClarification,
    counts: {
      handoff_pending: handoffPending.length,
      ready_for_acceptance: readyForAcceptance.length,
      instruction_pending: instructionPending.length,
      ready_for_release: readyForRelease.length,
      released: released.length,
      returned_clarification: returnedClarification.length,
    },
  };
}
