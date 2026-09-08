import type { PrismaClient, SampleDecision } from "@prisma/client";
import { buildStorageKey, uploadObject } from "@/lib/storage";

type SeedCtx = {
  prisma: PrismaClient;
  productTypeId: number;
  seasonId: number;
  designHeadId: number;
  createdById: number;
  workflowPatternId: number;
  sketchEmployeeId: number;
  processId: number;
  sketchSubProcessId: number;
  conceptSubProcessId: number;
  sketchRoleId: number;
  designHeadRoleId: number;
};

const PLACEHOLDER_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#1f4e5f"/><stop offset="100%" stop-color="#c4a35a"/>
  </linearGradient></defs>
  <rect width="640" height="480" fill="url(#g)"/>
  <text x="32" y="64" fill="#fff" font-family="Georgia,serif" font-size="28">Decent ERP demo</text>
</svg>`,
  "utf8",
);

async function ensurePrimaryImage(
  prisma: PrismaClient,
  designId: bigint,
  uploadedById: number,
  label: string,
) {
  const existing = await prisma.designImage.findFirst({
    where: { designId, isPrimary: true },
  });
  if (existing) return existing;

  const storageKey = buildStorageKey(designId.toString(), `${label}.svg`);
  await uploadObject(storageKey, PLACEHOLDER_SVG, "image/svg+xml");
  return prisma.designImage.create({
    data: {
      designId,
      storageKey,
      fileName: `${label}.svg`,
      contentType: "image/svg+xml",
      fileSize: BigInt(PLACEHOLDER_SVG.length),
      isPrimary: true,
      mediaKind: "IMAGE",
      uploadedById,
    },
  });
}

/**
 * HTML A–style portfolio: stable IdeaRefs (ID-2026-*) with primary DesignImage keys.
 * Runtime create still uses IDEA-{ts}-{rand}; these refs are seed/demo only.
 */
export async function seedHtmlADemoDesigns(ctx: SeedCtx) {
  const rows = [
    {
      ideaRef: "ID-2026-001",
      designNumber: "DN-2026-001",
      collectionName: "Festive Zari Preview",
      currentStage: "SKETCH",
      status: "ACTIVE" as const,
      sampleDecision: null as SampleDecision | null,
    },
    {
      ideaRef: "ID-2026-002",
      designNumber: "DN-2026-002",
      collectionName: "Silk Border Studio",
      currentStage: "MACHINE_SAMPLE",
      status: "ACTIVE" as const,
      sampleDecision: null as SampleDecision | null,
    },
    {
      ideaRef: "ID-2026-003",
      designNumber: "DN-2026-003",
      collectionName: "Heritage Pass Demo",
      currentStage: "SAMPLE_CHECK",
      status: "ACTIVE" as const,
      sampleDecision: "PASS" as SampleDecision,
    },
  ];

  for (const row of rows) {
    let design = await ctx.prisma.designConcept.findUnique({
      where: { ideaRef: row.ideaRef },
    });
    if (!design) {
      design = await ctx.prisma.designConcept.create({
        data: {
          ideaRef: row.ideaRef,
          designNumber: row.designNumber,
          productTypeId: ctx.productTypeId,
          collectionName: row.collectionName,
          seasonId: ctx.seasonId,
          designHeadEmployeeId: ctx.designHeadId,
          priority: "MEDIUM",
          conceptNote: `HTML A demo asset mapped to DesignImage (${row.ideaRef})`,
          workflowPatternId: ctx.workflowPatternId,
          createdById: ctx.createdById,
          status: row.status,
          currentStage: row.currentStage,
          workType: "NEW_DESIGN",
          sampleDecision: row.sampleDecision,
          sampleDecisionAtUtc: row.sampleDecision ? new Date() : null,
          sampleDecisionRemark: row.sampleDecision ? "Seed Pass for Owner Target demo" : null,
        },
      });
      await ctx.prisma.designTask.createMany({
        data: [
          {
            designId: design.id,
            processId: ctx.processId,
            subProcessId: ctx.conceptSubProcessId,
            assignedRoleId: ctx.designHeadRoleId,
            assignedEmployeeId: ctx.designHeadId,
            status: "COMPLETED",
            priority: "MEDIUM",
            expectedMinutes: 30,
            sequence: 1,
            completedAt: new Date(),
          },
          {
            designId: design.id,
            processId: ctx.processId,
            subProcessId: ctx.sketchSubProcessId,
            assignedRoleId: ctx.sketchRoleId,
            assignedEmployeeId: ctx.sketchEmployeeId,
            status: row.currentStage === "SKETCH" ? "ASSIGNED" : "COMPLETED",
            priority: "MEDIUM",
            expectedMinutes: 120,
            sequence: 2,
            completedAt: row.currentStage === "SKETCH" ? null : new Date(),
          },
        ],
      });
    }
    await ensurePrimaryImage(ctx.prisma, design.id, ctx.createdById, row.ideaRef);
  }
}

/**
 * HTML B CN-* sample portfolio for UAT demos (Sample Kanban + Owner Target).
 * Cutting/Stitching stages intentionally omitted (product exclusion).
 */
export async function seedHtmlBCnDemoConcepts(ctx: SeedCtx) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const rows: Array<{
    ideaRef: string;
    collectionName: string;
    currentStage: string;
    sampleDecision: SampleDecision | null;
    decided: boolean;
  }> = [
    {
      ideaRef: "CN-1001",
      collectionName: "CN Bridal Lattice",
      currentStage: "CONCEPT_REVIEW",
      sampleDecision: null,
      decided: false,
    },
    {
      ideaRef: "CN-1002",
      collectionName: "CN Sketch Flora",
      currentStage: "SKETCH",
      sampleDecision: null,
      decided: false,
    },
    {
      ideaRef: "CN-1003",
      collectionName: "CN Punch Vine",
      currentStage: "PUNCH",
      sampleDecision: null,
      decided: false,
    },
    {
      ideaRef: "CN-1004",
      collectionName: "CN Machine Sample",
      currentStage: "MACHINE_SAMPLE",
      sampleDecision: null,
      decided: false,
    },
    {
      ideaRef: "CN-1005",
      collectionName: "CN Sample Pass",
      currentStage: "SAMPLE_CHECK",
      sampleDecision: "PASS",
      decided: true,
    },
    {
      ideaRef: "CN-1006",
      collectionName: "CN Sample Hold",
      currentStage: "SAMPLE_CHECK",
      sampleDecision: "HOLD",
      decided: true,
    },
    {
      ideaRef: "CN-1007",
      collectionName: "CN Sample Reject",
      currentStage: "SAMPLE_CHECK",
      sampleDecision: "REJECT",
      decided: true,
    },
    {
      ideaRef: "CN-1008",
      collectionName: "CN Correction Loop",
      currentStage: "SKETCH",
      sampleDecision: null,
      decided: false,
    },
  ];

  for (const row of rows) {
    const existing = await ctx.prisma.designConcept.findUnique({
      where: { ideaRef: row.ideaRef },
    });
    if (existing) continue;

    const design = await ctx.prisma.designConcept.create({
      data: {
        ideaRef: row.ideaRef,
        designNumber: row.ideaRef.replace("CN-", "DN-CN"),
        productTypeId: ctx.productTypeId,
        collectionName: row.collectionName,
        seasonId: ctx.seasonId,
        designHeadEmployeeId: ctx.designHeadId,
        priority: "HIGH",
        conceptNote: "HTML B CN-* UAT demo concept",
        workflowPatternId: ctx.workflowPatternId,
        createdById: ctx.createdById,
        status: row.sampleDecision === "REJECT" ? "REJECTED" : "ACTIVE",
        currentStage: row.currentStage,
        workType: "NEW_DESIGN",
        sampleDecision: row.sampleDecision,
        sampleDecisionAtUtc: row.decided ? monthStart : null,
        sampleDecisionRemark: row.decided
          ? `Seed ${row.sampleDecision} for Owner Target / Sample Kanban`
          : null,
        createdAtUtc: monthStart,
      },
    });

    await ctx.prisma.designTask.create({
      data: {
        designId: design.id,
        processId: ctx.processId,
        subProcessId: ctx.sketchSubProcessId,
        assignedRoleId: ctx.sketchRoleId,
        assignedEmployeeId: ctx.sketchEmployeeId,
        status:
          row.ideaRef === "CN-1008"
            ? "CORRECTION_REQUIRED"
            : row.currentStage === "SKETCH"
              ? "ASSIGNED"
              : "COMPLETED",
        priority: "HIGH",
        expectedMinutes: 90,
        sequence: 1,
      },
    });

    await ensurePrimaryImage(ctx.prisma, design.id, ctx.createdById, row.ideaRef);
  }

  // Monthly org target so Management / KPI cards never show unset for current period
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const { ensureGlobalConceptTargetForPeriod } = await import(
    "@/lib/services/concept-target-service"
  );
  await ensureGlobalConceptTargetForPeriod({
    year,
    month,
    targetCount: 10,
    createdById: ctx.createdById,
    note: "Seed Owner Target for Pass/Made widget",
  });
}

export async function seedRdDemoPortfolio(ctx: SeedCtx) {
  if (process.env.SEED_RD_DEMO === "0") return;
  await seedHtmlADemoDesigns(ctx);
  await seedHtmlBCnDemoConcepts(ctx);
}
