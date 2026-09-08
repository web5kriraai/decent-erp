import { prisma } from "./db";
import bcrypt from "bcryptjs";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_CODES,
} from "./permissions";
import {
  buildCanonicalEightStepWorkflowTasks,
  buildStandardWorkflowTasks,
  HOLD_REASON_DELAY_CATEGORIES,
  seedChecklistItems,
  seedComponentTypes,
  seedKpiDefinitions,
  seedProcessMasters,
  seedRdCatalogMasters,
} from "./seed/masters-data";
import {
  STANDARD_WORKFLOW_PRODUCT_CODES,
  canonicalEightStepPatternName,
  standardWorkflowPatternName,
} from "./workflow-patterns";

export async function seedDatabase() {
  for (const [roleCode, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: { name: roleCode.replace(/_/g, " ") },
      create: { code: roleCode, name: roleCode.replace(/_/g, " ") },
    });

    const { getPermissionDefinition, formatPermissionTitle } = await import(
      "./permission-catalog"
    );
    for (const permCode of Object.values(PERMISSIONS)) {
      const def = getPermissionDefinition(permCode);
      const name = def?.title ?? formatPermissionTitle(permCode);
      const description = def?.description ?? null;
      await prisma.permission.upsert({
        where: { code: permCode },
        update: { name, description },
        create: { code: permCode, name, description },
      });
    }

    // Replace role permissions with defaults so leftover grants cannot widen SoD.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const perm of perms) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code: perm },
      });
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
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
    { code: "CHECKER_APPROVAL", name: "Sample Checker Approval", sequence: 1, roleCode: "SAMPLE_CHECKER" },
    { code: "DESIGN_HEAD_APPROVAL", name: "Design Head Approval", sequence: 2, roleCode: "DESIGN_HEAD" },
    { code: "MANAGEMENT_APPROVAL", name: "Management Approval", sequence: 3, roleCode: "MANAGEMENT" },
  ];
  for (const level of approvalLevels) {
    const role = await prisma.role.findUnique({ where: { code: level.roleCode } });
    await prisma.approvalLevel.upsert({
      where: { code: level.code },
      update: {
        name: level.name,
        sequence: level.sequence,
        requiredRoleId: role?.id ?? null,
      },
      create: {
        code: level.code,
        name: level.name,
        sequence: level.sequence,
        requiredRoleId: role?.id ?? null,
      },
    });
  }

  const productTypes = [
    { code: "SAREE", name: "Saree" },
    { code: "SUIT", name: "Suit" },
    { code: "KURTI", name: "Kurti" },
    { code: "LEHENGA", name: "Lehenga" },
  ];
  for (const pt of productTypes) {
    await prisma.masterCatalog.upsert({
      where: { masterType_code: { masterType: "PRODUCT_CATEGORY", code: pt.code } },
      update: { name: pt.name, isActive: true },
      create: {
        masterType: "PRODUCT_CATEGORY",
        code: pt.code,
        name: pt.name,
        isActive: true,
      },
    });
  }

  const seasons = [
    { code: "SS26", name: "Spring Summer 2026" },
    { code: "AW26", name: "Autumn Winter 2026" },
    { code: "FEST26", name: "Festive 2026" },
  ];
  for (const s of seasons) {
    await prisma.masterCatalog.upsert({
      where: { masterType_code: { masterType: "SEASON", code: s.code } },
      update: { name: s.name, isActive: true },
      create: {
        masterType: "SEASON",
        code: s.code,
        name: s.name,
        isActive: true,
      },
    });
  }

  await seedComponentTypes(prisma);
  await seedRdCatalogMasters(prisma);

  const roles = Object.fromEntries(
    (
      await prisma.role.findMany({
        where: { code: { in: Object.values(ROLE_CODES) } },
      })
    ).map((r) => [r.code, { id: r.id }]),
  ) as Record<string, { id: number }>;

  const subIndex = await seedProcessMasters(prisma, roles);
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

  // Spec §6.2 - skill master + employee skill links for RoleId/SkillId resolution.
  const skillDefs = [
    { code: "SKETCH", name: "Sketch Design", role: ROLE_CODES.SKETCH_DESIGNER },
    { code: "PUNCH", name: "Embroidery Punching", role: ROLE_CODES.PUNCHING_DESIGNER },
    { code: "MACHINE_SAMPLE", name: "Machine Sample Operation", role: ROLE_CODES.MACHINE_OPERATOR },
    { code: "SAMPLE_CHECK", name: "Sample Quality Check", role: ROLE_CODES.SAMPLE_CHECKER },
    { code: "COSTING", name: "Development Costing", role: ROLE_CODES.COSTING_TEAM },
    { code: "DESIGN_LEAD", name: "Design Leadership", role: ROLE_CODES.DESIGN_HEAD },
    { code: "PRODUCTION_LEAD", name: "Production Leadership", role: ROLE_CODES.PRODUCTION_HEAD },
    { code: "MANAGEMENT", name: "Management Oversight", role: ROLE_CODES.MANAGEMENT },
  ] as const;

  const skillByCode: Record<string, number> = {};
  for (const skill of skillDefs) {
    const roleId = roles[skill.role]?.id;
    const row = await prisma.skill.upsert({
      where: { code: skill.code },
      update: { name: skill.name, defaultRoleId: roleId ?? null, active: true },
      create: {
        code: skill.code,
        name: skill.name,
        defaultRoleId: roleId ?? null,
      },
    });
    skillByCode[skill.code] = row.id;
  }

  const skillEmailMap: Record<string, string> = {
    "sketch@decent-erp.local": "SKETCH",
    "punch@decent-erp.local": "PUNCH",
    "machine@decent-erp.local": "MACHINE_SAMPLE",
    "checker@decent-erp.local": "SAMPLE_CHECK",
    "costing@decent-erp.local": "COSTING",
    "designhead@decent-erp.local": "DESIGN_LEAD",
    "production@decent-erp.local": "PRODUCTION_LEAD",
    "management@decent-erp.local": "MANAGEMENT",
  };
  for (const [email, skillCode] of Object.entries(skillEmailMap)) {
    const emp = await prisma.employee.findUnique({ where: { email } });
    const skillId = skillByCode[skillCode];
    if (!emp || !skillId) continue;
    await prisma.employeeSkill.upsert({
      where: { employeeId_skillId: { employeeId: emp.id, skillId } },
      update: { active: true, proficiency: 3 },
      create: { employeeId: emp.id, skillId, proficiency: 3 },
    });
  }

  const sareeType = await prisma.masterCatalog.findUniqueOrThrow({
    where: { masterType_code: { masterType: "PRODUCT_CATEGORY", code: "SAREE" } },
  });
  const festiveSeason = await prisma.masterCatalog.findUniqueOrThrow({
    where: { masterType_code: { masterType: "SEASON", code: "FEST26" } },
  });
  const fullWorkflowTasks = buildStandardWorkflowTasks(roles, subIndex, skillByCode);
  const eightStepTasks = buildCanonicalEightStepWorkflowTasks(roles, subIndex, skillByCode);

  async function upsertPatternWithTasks(
    productTypeId: number,
    patternName: string,
    tasks: typeof fullWorkflowTasks,
  ) {
    let pattern = await prisma.workflowPattern.findFirst({
      where: { productTypeId, name: patternName },
      orderBy: { id: "asc" },
    });

    if (!pattern) {
      pattern = await prisma.workflowPattern.create({
        data: {
          name: patternName,
          productTypeId,
          versionNo: 1,
          active: true,
        },
      });
    } else if (!pattern.active) {
      pattern = await prisma.workflowPattern.update({
        where: { id: pattern.id },
        data: { active: true, versionNo: 1 },
      });
    }

    await prisma.workflowPattern.updateMany({
      where: {
        productTypeId,
        name: patternName,
        id: { not: pattern.id },
      },
      data: { active: false },
    });

    await prisma.workflowPatternTask.deleteMany({ where: { workflowPatternId: pattern.id } });
    await prisma.workflowPatternTask.createMany({
      data: tasks.map((t) => ({ workflowPatternId: pattern.id, ...t })),
    });

    return pattern;
  }

  // Spec 8-step (UAT/demo) + Full chain per product type.
  const patternsByProductCode: Record<string, { id: number; eightStepId: number }> = {};
  for (const code of STANDARD_WORKFLOW_PRODUCT_CODES) {
    const productType = await prisma.masterCatalog.findUniqueOrThrow({
      where: { masterType_code: { masterType: "PRODUCT_CATEGORY", code } },
    });
    const eightStep = await upsertPatternWithTasks(
      productType.id,
      canonicalEightStepPatternName(productType.name),
      eightStepTasks,
    );
    const full = await upsertPatternWithTasks(
      productType.id,
      standardWorkflowPatternName(productType.name),
      fullWorkflowTasks,
    );
    patternsByProductCode[code] = { id: full.id, eightStepId: eightStep.id };
  }

  const sareePatternId = patternsByProductCode.SAREE.eightStepId;

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
    const bodyComponent = await prisma.masterCatalog.findUniqueOrThrow({
      where: { masterType_code: { masterType: "PRODUCT_COMPONENT", code: "BODY" } },
    });
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
        workflowPatternId: sareePatternId,
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

    const silk = await prisma.masterCatalog.findUnique({
      where: { masterType_code: { masterType: "FABRIC_QUALITY", code: "SILK" } },
    });
    const zari = await prisma.masterCatalog.findUnique({
      where: { masterType_code: { masterType: "THREAD", code: "ZARI" } },
    });
    if (silk) {
      await prisma.designMaterialLine.create({
        data: {
          designId: design.id,
          catalogItemId: silk.id,
          unit: "mtr",
          quantity: 5.5,
          source: "STOCK",
          status: "AVAILABLE",
          requestedById: designHead.id,
        },
      });
    }
    if (zari) {
      await prisma.designMaterialLine.create({
        data: {
          designId: design.id,
          catalogItemId: zari.id,
          unit: "kg",
          quantity: 0.25,
          source: "PURCHASE_INDENT",
          status: "INDENT",
          requestedById: designHead.id,
        },
      });
    }

    await prisma.designTask.createMany({
      data: eightStepTasks.slice(0, 2).map((t, i) => ({
        designId: design.id,
        processId: t.processId,
        subProcessId: t.subProcessId,
        assignedRoleId: t.defaultRoleId,
        assignedEmployeeId:
          i === 0 ? designHead.id : i === 1 ? sketchEmployee.id : undefined,
        // Only Concept Review is ready; Sketch stays PENDING until Concept Review ends
        status: i === 0 ? "ASSIGNED" : "PENDING",
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
        // Do not force ASSIGNED - readiness gate owns status
      },
    });
  }
}

export { writeAuditLog } from "./audit";
