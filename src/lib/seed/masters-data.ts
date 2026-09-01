import type { PrismaClient } from "@prisma/client";
import { ROLE_CODES } from "@/lib/permissions";

type RoleLookup = Record<string, { id: number }>;

export const COMPONENT_TYPE_SEED = [
  { code: "BODY", name: "Body", sequence: 1 },
  { code: "PALLU", name: "Pallu", sequence: 2 },
  { code: "BORDER", name: "Border", sequence: 3 },
  { code: "BLOUSE", name: "Blouse", sequence: 4 },
  { code: "SLEEVE", name: "Sleeve", sequence: 5 },
  { code: "TOP_FRONT", name: "Top Front", sequence: 6 },
  { code: "TOP_BACK", name: "Top Back", sequence: 7 },
  { code: "BOTTOM", name: "Bottom", sequence: 8 },
  { code: "DUPATTA", name: "Dupatta", sequence: 9 },
] as const;

export const PROCESS_SEED = [
  {
    code: "DESIGN_DEV",
    name: "Design Development",
    sequence: 1,
    subProcesses: [
      { code: "CONCEPT_REVIEW", name: "Concept Review", sequence: 1, role: ROLE_CODES.DESIGN_HEAD, isApproval: true },
      { code: "SKETCH", name: "Sketch Creation", sequence: 2, role: ROLE_CODES.SKETCH_DESIGNER, isFileRequired: true },
      { code: "SKETCH_APPROVAL", name: "Sketch Approval", sequence: 3, role: ROLE_CODES.DESIGN_HEAD, isApproval: true },
      { code: "PUNCH", name: "Punching / Wilcom", sequence: 4, role: ROLE_CODES.PUNCHING_DESIGNER, isFileRequired: true },
      { code: "PUNCH_CHECK", name: "Punching Checking", sequence: 5, role: ROLE_CODES.SAMPLE_CHECKER, isApproval: true },
      { code: "CORRECTION", name: "Correction", sequence: 6, role: ROLE_CODES.SKETCH_DESIGNER, isCorrectionAllowed: true },
    ],
  },
  {
    code: "SAMPLE_DEV",
    name: "Sample Development",
    sequence: 2,
    subProcesses: [
      { code: "MAT_REQ", name: "Material Requirement", sequence: 1, role: ROLE_CODES.DESIGN_HEAD },
      { code: "FABRIC_ISSUE", name: "Fabric Issue", sequence: 2, role: ROLE_CODES.PRODUCTION_HEAD },
      { code: "MACHINE_SAMPLE", name: "Machine Sample", sequence: 3, role: ROLE_CODES.MACHINE_OPERATOR, isFileRequired: true },
      { code: "SAMPLE_RECEIVE", name: "Sample Receive", sequence: 4, role: ROLE_CODES.MACHINE_OPERATOR },
      { code: "SAMPLE_CHECK", name: "Sample Checking", sequence: 5, role: ROLE_CODES.SAMPLE_CHECKER, isApproval: true },
      { code: "RESAMPLE", name: "Re-Sample", sequence: 6, role: ROLE_CODES.MACHINE_OPERATOR },
    ],
  },
  {
    code: "PROD_RELEASE",
    name: "Production Release",
    sequence: 3,
    subProcesses: [
      { code: "COSTING", name: "Costing", sequence: 1, role: ROLE_CODES.COSTING_TEAM },
      { code: "FINAL_APPROVAL", name: "Final Approval", sequence: 2, role: ROLE_CODES.DESIGN_HEAD, isApproval: true },
      { code: "PROD_HANDOFF", name: "Production Handoff", sequence: 3, role: ROLE_CODES.DESIGN_HEAD },
      { code: "PROD_INSTRUCTION", name: "Production Instruction", sequence: 4, role: ROLE_CODES.PRODUCTION_HEAD },
      { code: "PROD_RELEASE", name: "Production Release", sequence: 5, role: ROLE_CODES.PRODUCTION_HEAD },
      { code: "LIVE_REVIEW", name: "Live Design Review", sequence: 6, role: ROLE_CODES.MANAGEMENT, isApproval: true },
    ],
  },
] as const;

/** Spec §6.2 — full master workflow chain */
export function buildStandardWorkflowTasks(
  roles: RoleLookup,
  subs: Record<string, { id: number; processId: number }>,
) {
  const rows = [
    { code: "CONCEPT_REVIEW", role: ROLE_CODES.DESIGN_HEAD, expectedMinutes: 120, dayOffset: 0, priority: "HIGH" as const },
    { code: "SKETCH", role: ROLE_CODES.SKETCH_DESIGNER, expectedMinutes: 480, dayOffset: 1, priority: "HIGH" as const },
    { code: "SKETCH_APPROVAL", role: ROLE_CODES.DESIGN_HEAD, expectedMinutes: 120, dayOffset: 2, priority: "HIGH" as const },
    { code: "PUNCH", role: ROLE_CODES.PUNCHING_DESIGNER, expectedMinutes: 720, dayOffset: 3, priority: "HIGH" as const },
    { code: "PUNCH_CHECK", role: ROLE_CODES.SAMPLE_CHECKER, expectedMinutes: 180, dayOffset: 4, priority: "HIGH" as const },
    { code: "MAT_REQ", role: ROLE_CODES.DESIGN_HEAD, expectedMinutes: 120, dayOffset: 4, priority: "MEDIUM" as const },
    { code: "FABRIC_ISSUE", role: ROLE_CODES.PRODUCTION_HEAD, expectedMinutes: 120, dayOffset: 5, priority: "MEDIUM" as const },
    { code: "MACHINE_SAMPLE", role: ROLE_CODES.MACHINE_OPERATOR, expectedMinutes: 360, dayOffset: 5, priority: "MEDIUM" as const },
    { code: "SAMPLE_RECEIVE", role: ROLE_CODES.MACHINE_OPERATOR, expectedMinutes: 60, dayOffset: 6, priority: "MEDIUM" as const },
    { code: "SAMPLE_CHECK", role: ROLE_CODES.SAMPLE_CHECKER, expectedMinutes: 180, dayOffset: 6, priority: "HIGH" as const },
    { code: "COSTING", role: ROLE_CODES.COSTING_TEAM, expectedMinutes: 120, dayOffset: 7, priority: "MEDIUM" as const },
    { code: "FINAL_APPROVAL", role: ROLE_CODES.DESIGN_HEAD, expectedMinutes: 120, dayOffset: 8, priority: "HIGH" as const },
    { code: "PROD_HANDOFF", role: ROLE_CODES.DESIGN_HEAD, expectedMinutes: 60, dayOffset: 9, priority: "HIGH" as const },
    { code: "PROD_INSTRUCTION", role: ROLE_CODES.PRODUCTION_HEAD, expectedMinutes: 120, dayOffset: 10, priority: "HIGH" as const },
    { code: "PROD_RELEASE", role: ROLE_CODES.PRODUCTION_HEAD, expectedMinutes: 60, dayOffset: 11, priority: "HIGH" as const },
    { code: "LIVE_REVIEW", role: ROLE_CODES.MANAGEMENT, expectedMinutes: 60, dayOffset: 12, priority: "HIGH" as const },
  ];

  return rows.map((row, index) => ({
    processId: subs[row.code].processId,
    subProcessId: subs[row.code].id,
    defaultRoleId: roles[row.role].id,
    expectedMinutes: row.expectedMinutes,
    dayOffset: row.dayOffset,
    priority: row.priority,
    sequence: index + 1,
  }));
}

export const CHECKLIST_SEED = [
  { code: "SKETCH_COMPLETE", name: "Sketch lines complete", subProcessCode: "SKETCH" },
  { code: "SKETCH_COLOR", name: "Color palette approved", subProcessCode: "SKETCH" },
  { code: "PUNCH_STITCH", name: "Stitch count verified", subProcessCode: "PUNCH" },
  { code: "PUNCH_FORMAT", name: "Machine format validated", subProcessCode: "PUNCH" },
  { code: "SAMPLE_FIT", name: "Sample fit acceptable", subProcessCode: "SAMPLE_CHECK" },
  { code: "SAMPLE_FINISH", name: "Finishing quality OK", subProcessCode: "SAMPLE_CHECK" },
] as const;

export const HOLD_REASON_DELAY_CATEGORIES: Record<string, string> = {
  OTHER_WORK: "EMPLOYEE",
  LUNCH: "BREAK",
  TEA: "BREAK",
  WAIT_APPROVAL: "APPROVAL",
  WAIT_MATERIAL: "MATERIAL",
  MACHINE_NA: "MACHINE",
  MEETING: "BREAK",
  PERSONAL: "BREAK",
  OFFICE_CLOSE: "OFFICE",
};

export async function seedProcessMasters(prisma: PrismaClient, roles: RoleLookup) {
  const subIndex: Record<string, { id: number; processId: number }> = {};

  for (const proc of PROCESS_SEED) {
    const process = await prisma.designProcessMaster.upsert({
      where: { code: proc.code },
      update: { name: proc.name, sequence: proc.sequence, active: true },
      create: { code: proc.code, name: proc.name, sequence: proc.sequence },
    });

    for (const sp of proc.subProcesses) {
      const role = roles[sp.role];
      const sub = await prisma.designSubProcessMaster.upsert({
        where: { processId_code: { processId: process.id, code: sp.code } },
        update: {
          name: sp.name,
          sequence: sp.sequence,
          defaultRoleId: role?.id,
          isApproval: "isApproval" in sp ? sp.isApproval : false,
          isFileRequired: "isFileRequired" in sp ? sp.isFileRequired : false,
          active: true,
        },
        create: {
          processId: process.id,
          code: sp.code,
          name: sp.name,
          sequence: sp.sequence,
          defaultRoleId: role?.id,
          isApproval: "isApproval" in sp ? sp.isApproval : false,
          isFileRequired: "isFileRequired" in sp ? sp.isFileRequired : false,
        },
      });
      subIndex[sp.code] = { id: sub.id, processId: process.id };
    }
  }

  return subIndex;
}

export async function seedComponentTypes(prisma: PrismaClient) {
  for (const ct of COMPONENT_TYPE_SEED) {
    await prisma.componentType.upsert({
      where: { code: ct.code },
      update: { name: ct.name, sequence: ct.sequence },
      create: ct,
    });
  }
}

export async function seedProductProcessMappings(prisma: PrismaClient) {
  const saree = await prisma.productType.findUnique({ where: { code: "SAREE" } });
  if (!saree) return;
  // Saree requires Design Development + Sample Development paths (not every production module)
  const processes = await prisma.designProcessMaster.findMany({
    where: { code: { in: ["DESIGN_DEV", "SAMPLE_DEV", "DESIGN_DEVELOPMENT", "SAMPLE_DEVELOPMENT"] } },
  });
  const fallback = processes.length
    ? processes
    : await prisma.designProcessMaster.findMany({ take: 2, orderBy: { sequence: "asc" } });
  for (const proc of fallback) {
    await prisma.productProcessMapping.upsert({
      where: { productTypeId_processId: { productTypeId: saree.id, processId: proc.id } },
      update: { required: true },
      create: { productTypeId: saree.id, processId: proc.id, required: true },
    });
  }
}

export async function seedChecklistItems(
  prisma: PrismaClient,
  subIndex: Record<string, { id: number; processId: number }>,
) {
  let seq = 1;
  for (const item of CHECKLIST_SEED) {
    const sub = subIndex[item.subProcessCode];
    if (!sub) continue;
    await prisma.qualityChecklistItem.upsert({
      where: { code: item.code },
      update: { name: item.name, subProcessId: sub.id, sequence: seq },
      create: {
        code: item.code,
        name: item.name,
        subProcessId: sub.id,
        sequence: seq++,
      },
    });
  }
}

export async function seedKpiDefinitions(prisma: PrismaClient, roles: RoleLookup) {
  const { SPEC_KPI_METRICS } = await import("@/lib/kpi-metrics");
  const effectiveFrom = new Date("2026-01-01T00:00:00Z");
  const designerRoles = [
    ROLE_CODES.SKETCH_DESIGNER,
    ROLE_CODES.PUNCHING_DESIGNER,
    ROLE_CODES.MACHINE_OPERATOR,
    ROLE_CODES.SAMPLE_CHECKER,
  ];

  for (const roleCode of designerRoles) {
    const role = roles[roleCode];
    if (!role) continue;
    for (const metric of SPEC_KPI_METRICS) {
      const existing = await prisma.employeeKpiDefinition.findFirst({
        where: { roleId: role.id, metricCode: metric.code },
      });
      if (existing) {
        await prisma.employeeKpiDefinition.update({
          where: { id: existing.id },
          data: { weightPercent: metric.weight },
        });
      } else {
        await prisma.employeeKpiDefinition.create({
          data: {
            roleId: role.id,
            metricCode: metric.code,
            weightPercent: metric.weight,
            effectiveFrom,
          },
        });
      }
    }
  }
}
