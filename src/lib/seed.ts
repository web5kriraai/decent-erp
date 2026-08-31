import { prisma } from "./db";
import bcrypt from "bcryptjs";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_CODES,
} from "./permissions";

export async function seedDatabase() {
  for (const [roleCode, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: {},
      create: {
        code: roleCode,
        name: roleCode.replace(/_/g, " "),
      },
    });

    for (const permCode of Object.values(PERMISSIONS)) {
      await prisma.permission.upsert({
        where: { code: permCode },
        update: {},
        create: {
          code: permCode,
          name: permCode.replace(/_/g, " "),
        },
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
      update: {},
      create: reason,
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

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { code: ROLE_CODES.ADMIN },
  });
  const sketchRole = await prisma.role.findUniqueOrThrow({
    where: { code: ROLE_CODES.SKETCH_DESIGNER },
  });

  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const admin = await prisma.employee.upsert({
    where: { email: "admin@decent-erp.local" },
    update: {},
    create: {
      employeeCode: "EMP001",
      name: "System Admin",
      email: "admin@decent-erp.local",
      passwordHash,
      roleId: adminRole.id,
    },
  });

  // Process masters
  const devProcess = await prisma.designProcessMaster.upsert({
    where: { code: "DESIGN_DEV" },
    update: {},
    create: {
      code: "DESIGN_DEV",
      name: "Design Development",
      sequence: 1,
    },
  });

  const sketchSub = await prisma.designSubProcessMaster.upsert({
    where: { processId_code: { processId: devProcess.id, code: "SKETCH" } },
    update: {},
    create: {
      processId: devProcess.id,
      code: "SKETCH",
      name: "Sketch Creation",
      sequence: 1,
      defaultRoleId: sketchRole.id,
      isFileRequired: true,
    },
  });

  const punchSub = await prisma.designSubProcessMaster.upsert({
    where: { processId_code: { processId: devProcess.id, code: "PUNCH" } },
    update: {},
    create: {
      processId: devProcess.id,
      code: "PUNCH",
      name: "Punching / Wilcom",
      sequence: 2,
      defaultRoleId: sketchRole.id,
    },
  });

  const sareeType = await prisma.productType.findUniqueOrThrow({ where: { code: "SAREE" } });
  const festiveSeason = await prisma.season.findUniqueOrThrow({ where: { code: "FEST26" } });

  const pattern = await prisma.workflowPattern.upsert({
    where: { id: 1 },
    update: { name: "Standard Saree Development", active: true },
    create: {
      name: "Standard Saree Development",
      productTypeId: sareeType.id,
      versionNo: 1,
      active: true,
    },
  });

  await prisma.workflowPatternTask.deleteMany({ where: { workflowPatternId: pattern.id } });
  await prisma.workflowPatternTask.createMany({
    data: [
      {
        workflowPatternId: pattern.id,
        processId: devProcess.id,
        subProcessId: sketchSub.id,
        defaultRoleId: sketchRole.id,
        expectedMinutes: 240,
        sequence: 1,
      },
      {
        workflowPatternId: pattern.id,
        processId: devProcess.id,
        subProcessId: punchSub.id,
        defaultRoleId: sketchRole.id,
        expectedMinutes: 180,
        sequence: 2,
      },
    ],
  });

  // Sample design with assigned task for admin (has TASK_EXECUTE via ADMIN role)
  const existingSample = await prisma.designConcept.findUnique({
    where: { ideaRef: "IDEA-SAMPLE-001" },
  });

  if (!existingSample) {
    const design = await prisma.designConcept.create({
      data: {
        ideaRef: "IDEA-SAMPLE-001",
        productTypeId: sareeType.id,
        collectionName: "Royal Festive 2026",
        seasonId: festiveSeason.id,
        designHeadEmployeeId: admin.id,
        priority: "HIGH",
        conceptNote: "Premium zari + thread concept for festive collection",
        workflowPatternId: pattern.id,
        createdById: admin.id,
        status: "ACTIVE",
        currentStage: "SKETCH",
      },
    });

    await prisma.designTask.createMany({
      data: [
        {
          designId: design.id,
          processId: devProcess.id,
          subProcessId: sketchSub.id,
          assignedEmployeeId: admin.id,
          assignedRoleId: sketchRole.id,
          status: "ASSIGNED",
          priority: "HIGH",
          expectedMinutes: 240,
        },
        {
          designId: design.id,
          processId: devProcess.id,
          subProcessId: punchSub.id,
          assignedRoleId: sketchRole.id,
          status: "PENDING",
          priority: "HIGH",
          expectedMinutes: 180,
        },
      ],
    });
  }
}

export { writeAuditLog } from "./audit";
