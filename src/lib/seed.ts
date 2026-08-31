import { prisma } from "./db";
import bcrypt from "bcryptjs";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_CODES,
} from "./permissions";
import {
  buildStandardWorkflowTasks,
  HOLD_REASON_DELAY_CATEGORIES,
  seedChecklistItems,
  seedComponentTypes,
  seedKpiDefinitions,
  seedProcessMasters,
  seedProductProcessMappings,
} from "./seed/masters-data";

export async function seedDatabase() {
  for (const [roleCode, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: { name: roleCode.replace(/_/g, " ") },
      create: { code: roleCode, name: roleCode.replace(/_/g, " ") },
    });

    for (const permCode of Object.values(PERMISSIONS)) {
      await prisma.permission.upsert({
        where: { code: permCode },
        update: {},
        create: { code: permCode, name: permCode.replace(/_/g, " ") },
      });
    }

    for (const perm of perms) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code: perm },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const holdReasons = [
    { code: "OTHER_WORK", name: "Other work", excludeFromActiveTime: false },
    { code: "LUNCH", name: "Lunch break", excludeFromActiveTime: true },
    { code: "TEA", name: "Tea break", excludeFromActiveTime: true },
    { code: "WAIT_APPROVAL", name: "Waiting for approval", excludeFromActiveTime: false },
    { code: "WAIT_MATERIAL", name: "Waiting for material", excludeFromActiveTime: false },
    { code: "MACHINE_NA", name: "Machine not available", excludeFromActiveTime: false },
    { code: "MEETING", name: "Meeting", excludeFromActiveTime: true },
    { code: "PERSONAL", name: "Personal break", excludeFromActiveTime: true },
    { code: "OFFICE_CLOSE", name: "Office time close", excludeFromActiveTime: true },
  ];

  for (const reason of holdReasons) {
    await prisma.taskHoldReason.upsert({
      where: { code: reason.code },
      update: {
        delayOwnerCategory: HOLD_REASON_DELAY_CATEGORIES[reason.code],
        excludeFromActiveTime: reason.excludeFromActiveTime,
      },
      create: {
        ...reason,
        delayOwnerCategory: HOLD_REASON_DELAY_CATEGORIES[reason.code],
      },
    });
  }

  const approvalLevels = [
    { code: "CHECKER_APPROVAL", name: "Sample Checker Approval", sequence: 1 },
    { code: "DESIGN_HEAD_APPROVAL", name: "Design Head Approval", sequence: 2 },
    { code: "MANAGEMENT_APPROVAL", name: "Management Approval", sequence: 3 },
  ];
  for (const level of approvalLevels) {
    await prisma.approvalLevel.upsert({
      where: { code: level.code },
      update: { name: level.name, sequence: level.sequence },
      create: level,
    });
  }

  const productTypes = [
    { code: "SAREE", name: "Saree" },
    { code: "SUIT", name: "Suit" },
    { code: "KURTI", name: "Kurti" },
    { code: "LEHENGA", name: "Lehenga" },
  ];
  for (const pt of productTypes) {
    await prisma.productType.upsert({
      where: { code: pt.code },
      update: {},
      create: pt,
    });
  }

  const seasons = [
    { code: "SS26", name: "Spring Summer 2026" },
    { code: "AW26", name: "Autumn Winter 2026" },
    { code: "FEST26", name: "Festive 2026" },
  ];
  for (const s of seasons) {
    await prisma.season.upsert({
      where: { code: s.code },
      update: {},
      create: s,
    });
  }

  await seedComponentTypes(prisma);

  const roles = Object.fromEntries(
    (
      await prisma.role.findMany({
        where: { code: { in: Object.values(ROLE_CODES) } },
      })
    ).map((r) => [r.code, { id: r.id }]),
  ) as Record<string, { id: number }>;

  const subIndex = await seedProcessMasters(prisma, roles);
  await seedProductProcessMappings(prisma);
  await seedChecklistItems(prisma, subIndex);
  await seedKpiDefinitions(prisma, roles);

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: ROLE_CODES.ADMIN } });

  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const demoPasswordHash = await bcrypt.hash("Demo@123", 12);

  const admin = await prisma.employee.upsert({
    where: { email: "admin@decent-erp.local" },
    update: { name: "System Admin", roleId: adminRole.id },
    create: {
      employeeCode: "EMP001",
      name: "System Admin",
      email: "admin@decent-erp.local",
      passwordHash,
      roleId: adminRole.id,
    },
  });

  const demoUsers = [
    { code: "EMP002", name: "Priya Design Head", email: "designhead@decent-erp.local", role: ROLE_CODES.DESIGN_HEAD },
    { code: "EMP003", name: "Ravi Sketch", email: "sketch@decent-erp.local", role: ROLE_CODES.SKETCH_DESIGNER },
    { code: "EMP004", name: "Meera Punch", email: "punch@decent-erp.local", role: ROLE_CODES.PUNCHING_DESIGNER },
    { code: "EMP005", name: "Kumar Machine", email: "machine@decent-erp.local", role: ROLE_CODES.MACHINE_OPERATOR },
    { code: "EMP006", name: "Anita Checker", email: "checker@decent-erp.local", role: ROLE_CODES.SAMPLE_CHECKER },
    { code: "EMP007", name: "Sanjay Costing", email: "costing@decent-erp.local", role: ROLE_CODES.COSTING_TEAM },
    { code: "EMP008", name: "Vikram Production", email: "production@decent-erp.local", role: ROLE_CODES.PRODUCTION_HEAD },
    { code: "EMP009", name: "Owner Management", email: "management@decent-erp.local", role: ROLE_CODES.MANAGEMENT },
  ] as const;

  for (const user of demoUsers) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: user.role } });
    await prisma.employee.upsert({
      where: { email: user.email },
      update: { name: user.name, roleId: role.id },
      create: {
        employeeCode: user.code,
        name: user.name,
        email: user.email,
        passwordHash: demoPasswordHash,
        roleId: role.id,
      },
    });
  }

  const sareeType = await prisma.productType.findUniqueOrThrow({ where: { code: "SAREE" } });
  const festiveSeason = await prisma.season.findUniqueOrThrow({ where: { code: "FEST26" } });

  const pattern = await prisma.workflowPattern.upsert({
    where: { id: 1 },
    update: { name: "Standard Saree Development (Full)", active: true },
    create: {
      name: "Standard Saree Development (Full)",
      productTypeId: sareeType.id,
      versionNo: 1,
      active: true,
    },
  });

  await prisma.workflowPatternTask.deleteMany({ where: { workflowPatternId: pattern.id } });
  const workflowTasks = buildStandardWorkflowTasks(roles, subIndex);
  await prisma.workflowPatternTask.createMany({
    data: workflowTasks.map((t) => ({ workflowPatternId: pattern.id, ...t })),
  });

  const existingSample = await prisma.designConcept.findUnique({
    where: { ideaRef: "IDEA-SAMPLE-001" },
  });

  const designHead = await prisma.employee.findUniqueOrThrow({
    where: { email: "designhead@decent-erp.local" },
  });
  const sketchEmployee = await prisma.employee.findUniqueOrThrow({
    where: { email: "sketch@decent-erp.local" },
  });

  if (process.env.SEED_SKIP_SAMPLE === "1") {
    return;
  }

  if (!existingSample) {
    const bodyComponent = await prisma.componentType.findUniqueOrThrow({ where: { code: "BODY" } });
    const design = await prisma.designConcept.create({
      data: {
        ideaRef: "IDEA-SAMPLE-001",
        designNumber: "DN-SAMPLE001",
        productTypeId: sareeType.id,
        collectionName: "Royal Festive 2026",
        seasonId: festiveSeason.id,
        designHeadEmployeeId: designHead.id,
        priority: "HIGH",
        conceptNote: "Premium zari + thread concept for festive collection",
        workflowPatternId: pattern.id,
        createdById: admin.id,
        status: "ACTIVE",
        currentStage: "SKETCH",
        workType: "NEW_DESIGN",
      },
    });

    await prisma.designComponent.create({
      data: {
        designId: design.id,
        componentTypeId: bodyComponent.id,
        sequence: 1,
        specification: "Main body panel with zari border",
      },
    });

    await prisma.designTask.createMany({
      data: workflowTasks.slice(0, 2).map((t, i) => ({
        designId: design.id,
        processId: t.processId,
        subProcessId: t.subProcessId,
        assignedRoleId: t.defaultRoleId,
        assignedEmployeeId:
          i === 0 ? designHead.id : i === 1 ? sketchEmployee.id : undefined,
        status: i <= 1 ? "ASSIGNED" : "PENDING",
        priority: t.priority,
        expectedMinutes: t.expectedMinutes,
        sequence: t.sequence,
      })),
    });
  } else {
    const sketchSub = subIndex.SKETCH;
    await prisma.designTask.updateMany({
      where: {
        designId: existingSample.id,
        subProcessId: sketchSub.id,
        status: { in: ["PENDING", "ASSIGNED"] },
      },
      data: {
        assignedEmployeeId: sketchEmployee.id,
        assignedRoleId: roles[ROLE_CODES.SKETCH_DESIGNER].id,
        status: "ASSIGNED",
      },
    });
  }
}

export { writeAuditLog } from "./audit";
