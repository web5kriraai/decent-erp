import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { autoAdvanceConceptReview } from "@/lib/services/concept-review-auto-advance";
import { ApiError } from "@/lib/api-utils";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { businessRule } from "@/lib/errors/create-app-error";
import type { AssignmentMode, Priority, Prisma, WorkType } from "@prisma/client";
import {
  applyCreateReadiness,
  buildTasksFromPatternTasks,
  createDesignComponents,
  createDesignProcessInstances,
  generateDesignNumber,
  toPrismaTaskCreateRows,
  type TaskCreateRow,
} from "@/lib/services/task-generation-service";
import {
  isDependencySatisfiedStatus,
} from "@/lib/services/task-dependency";
import { unlockNextDependentTasks } from "@/lib/services/task-dependency-unlock";
import { buildCorrectionScopeForEmployee } from "@/lib/services/correction-queue-utils";
import {
  resolveManualDueAt,
  type TaskDateMode,
} from "@/lib/services/task-date-mode";
import { resolveAssigneesForPatternTasks } from "@/lib/services/assignment-service";
import { requireMasterOfType } from "@/lib/services/master-catalog-service";
import { assertComponentsAllowedForProductCategory } from "@/lib/services/product-category-component-service";
import { MASTER_TYPES } from "@/lib/master-catalog-types";
import {
  assertAllowedDesignStatusTransition,
  DesignStatusTransitionError,
} from "@/lib/services/design-status-transitions";
import { buildKanbanWorkflowInfo } from "@/lib/design-workflow";
import type { DesignTask, KanbanDesignItem } from "@/lib/types/api";
import {
  WORKFLOW_LANES,
  clampKanbanPageSize,
  compareBoardCards,
  resolveLaneId,
  type WorkflowLaneId,
} from "@/lib/workflow-lanes";

export type CreateDesignInput = {
  productTypeId: number;
  collectionName: string;
  seasonId: number;
  designHeadEmployeeId: number;
  priority: Priority;
  conceptNote?: string;
  styleName?: string;
  workType?: WorkType;
  trendReference?: string;
  celebrityReference?: string;
  targetGrade?: string;
  designGradeId?: number;
  fabricId?: number;
  machineId?: number;
  stitchingTypeId?: number;
  estimatedCost?: number;
  standardCost?: number;
  processId?: number;
  subProcessId?: number;
  assignmentMode: AssignmentMode;
  workflowPatternId?: number;
  taskDateMode?: TaskDateMode;
  targetEndDate?: string | Date | null;
  patternSteps?: Array<{
    sequence: number;
    expectedMinutes: number;
    dueAt: string | Date;
    priority: Priority;
    assignedEmployeeId?: number;
    instructionNote?: string | null;
  }>;
  manualTasks?: Array<{
    processId: number;
    subProcessId: number;
    assignedEmployeeId?: number;
    instructionNote?: string | null;
    expectedMinutes: number;
    sequence?: number;
    dueAt?: string | Date;
    priority?: Priority;
  }>;
  componentTypeIds?: number[];
  componentSpecs?: Record<string, string>;
};

function generateIdeaRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `IDEA-${ts}-${rand}`;
}

export async function createDesignWithTasks(
  input: CreateDesignInput,
  createdById: number,
  correlationId: string,
  actorRoleCode?: string,
  tenant?: { companyId: number; locationId?: number | null },
) {
  await requireMasterOfType(input.productTypeId, MASTER_TYPES.PRODUCT_CATEGORY);
  await requireMasterOfType(input.seasonId, MASTER_TYPES.SEASON);
  if (input.fabricId != null) {
    await requireMasterOfType(input.fabricId, MASTER_TYPES.FABRIC_QUALITY);
  }
  if (input.machineId != null) {
    await requireMasterOfType(input.machineId, MASTER_TYPES.MACHINE);
  }
  if (input.stitchingTypeId != null) {
    await requireMasterOfType(input.stitchingTypeId, MASTER_TYPES.STITCHING_TYPE);
  }
  if (input.designGradeId != null) {
    await requireMasterOfType(input.designGradeId, MASTER_TYPES.DESIGN_GRADE);
  }
  if (input.componentTypeIds?.length) {
    await Promise.all(
      input.componentTypeIds.map((id) =>
        requireMasterOfType(id, MASTER_TYPES.PRODUCT_COMPONENT),
      ),
    );
    await assertComponentsAllowedForProductCategory(
      input.productTypeId,
      input.componentTypeIds,
    );
  }

  const creator =
    tenant ??
    (await prisma.employee.findUniqueOrThrow({
      where: { id: createdById },
      select: { companyId: true, locationId: true },
    }));

  return prisma.$transaction(async (tx) => {
    if (input.assignmentMode === "AUTOMATIC" && input.workflowPatternId) {
      const pattern = await tx.workflowPattern.findUnique({
        where: { id: input.workflowPatternId },
      });
      if (!pattern || !pattern.active) {
        throw new ApiError("Workflow pattern not found", 422);
      }
      if (pattern.productTypeId && pattern.productTypeId !== input.productTypeId) {
        throw new ApiError(
          "Selected workflow pattern does not apply to this product type",
          422,
        );
      }
    }

    const ideaRef = generateIdeaRef();
    const design = await tx.designConcept.create({
      data: {
        ideaRef,
        designNumber: generateDesignNumber(ideaRef),
        companyId: creator.companyId,
        locationId: creator.locationId ?? null,
        productTypeId: input.productTypeId,
        collectionName: input.collectionName,
        seasonId: input.seasonId,
        designHeadEmployeeId: input.designHeadEmployeeId,
        priority: input.priority,
        conceptNote: input.conceptNote,
        styleName: input.styleName,
        workType: input.workType,
        trendReference: input.trendReference,
        celebrityReference: input.celebrityReference,
        targetGrade: input.targetGrade,
        designGradeId: input.designGradeId,
        fabricId: input.fabricId,
        machineId: input.machineId,
        stitchingTypeId: input.stitchingTypeId,
        estimatedCost: input.estimatedCost,
        standardCost: input.standardCost,
        assignmentMode: input.assignmentMode,
        workflowPatternId: input.workflowPatternId,
        targetEndDate: input.targetEndDate
          ? input.targetEndDate instanceof Date
            ? input.targetEndDate
            : new Date(input.targetEndDate)
          : null,
        createdById,
        status: "DRAFT",
        currentStage: "CONCEPT",
      },
    });

    let tasksToCreate: TaskCreateRow[] = [];

    if (input.assignmentMode === "AUTOMATIC" && input.workflowPatternId) {
      const patternTasks = await tx.workflowPatternTask.findMany({
        where: { workflowPatternId: input.workflowPatternId },
        orderBy: { sequence: "asc" },
        include: { subProcess: { select: { isApproval: true, code: true } } },
      });
      tasksToCreate = await buildTasksFromPatternTasks(design.id, patternTasks, {
        firstAssigneeId: input.designHeadEmployeeId,
        designPriority: input.priority,
        taskDateMode: input.taskDateMode ?? "SEQUENTIAL",
        companyId: creator.companyId,
        productTypeId: input.productTypeId,
        stepOverrides: input.patternSteps?.map((step) => ({
          sequence: step.sequence,
          expectedMinutes: step.expectedMinutes,
          dueAt: step.dueAt instanceof Date ? step.dueAt : new Date(step.dueAt),
          priority: step.priority,
          assignedEmployeeId: step.assignedEmployeeId,
          instructionNote: step.instructionNote,
        })),
      });
    }

    if (input.manualTasks?.length) {
      const base = new Date();
      const subProcesses = await Promise.all(
        input.manualTasks.map((mt) =>
          tx.designSubProcessMaster.findUniqueOrThrow({
            where: { id: mt.subProcessId },
          }),
        ),
      );

      const autoAssigneeInputs = input.manualTasks
        .map((mt, index) => ({ mt, subProcess: subProcesses[index] }))
        .filter(({ mt }) => mt.assignedEmployeeId == null)
        .map(({ subProcess }) => ({
          defaultRoleId: subProcess.defaultRoleId ?? 1,
          defaultSkillId: null as number | null,
        }));

      const autoAssignees =
        autoAssigneeInputs.length > 0
          ? await resolveAssigneesForPatternTasks(autoAssigneeInputs, { tx })
          : [];

      let autoIndex = 0;
      for (let i = 0; i < input.manualTasks.length; i++) {
        const mt = input.manualTasks[i];
        const subProcess = subProcesses[i];
        const seq = mt.sequence ?? i + 1;
        const dueAt = resolveManualDueAt(mt.dueAt, base, mt.expectedMinutes);
        const assignedEmployeeId = mt.assignedEmployeeId
          ? mt.assignedEmployeeId
          : (autoAssignees[autoIndex++] ?? undefined);
        tasksToCreate.push({
          designId: design.id,
          processId: mt.processId,
          subProcessId: mt.subProcessId,
          assignedEmployeeId,
          assignedRoleId: subProcess.defaultRoleId ?? 1,
          expectedMinutes: mt.expectedMinutes,
          priority: mt.priority ?? input.priority,
          sequence: seq,
          dependencySequence: seq,
          plannedStart: base,
          dueAt,
          instructionNote: mt.instructionNote?.trim() || null,
          status: "PENDING",
          isApproval: subProcess.isApproval,
        });
      }
    }

    if (tasksToCreate.length === 0) {
      throw new ApiError("No tasks generated from workflow pattern or manual tasks", 422);
    }

    // Re-apply readiness across combined automatic + manual rows
    tasksToCreate = applyCreateReadiness(tasksToCreate);

    if (input.componentTypeIds?.length) {
      const specs: Record<number, string | undefined> = {};
      if (input.componentSpecs) {
        for (const [key, value] of Object.entries(input.componentSpecs)) {
          specs[Number(key)] = value;
        }
      }
      await createDesignComponents(tx, design.id, input.componentTypeIds, specs);
    }

    await createDesignProcessInstances(tx, design.id, tasksToCreate);
    await tx.designTask.createMany({ data: toPrismaTaskCreateRows(tasksToCreate) });

    const firstReady =
      tasksToCreate.find((t) => t.status === "ASSIGNED") ?? tasksToCreate[0];
    const firstSubProcess = await tx.designSubProcessMaster.findUnique({
      where: { id: firstReady.subProcessId },
      select: { code: true, name: true },
    });

    const activatedDesign = await tx.designConcept.update({
      where: { id: design.id },
      data: {
        status: "ACTIVE",
        currentStage: firstSubProcess?.code ?? "CONCEPT",
      },
    });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: design.id.toString(),
      action: "CREATE",
      userId: createdById,
      correlationId,
      after: activatedDesign,
    });

    return activatedDesign;
  }).then(async (design) => {
    // Single post-commit outbox + queue job (avoid duplicate in-tx outbox rows).
    await enqueueOutboxAndNotify(
      "DESIGN_CREATED",
      { designId: design.id.toString(), ideaRef: design.ideaRef },
      correlationId,
    );
    try {
      await autoAdvanceConceptReview(design.id, createdById, correlationId, {
        roleCode: actorRoleCode,
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          msg: "Concept review auto-advance skipped after design create",
          designId: design.id.toString(),
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return prisma.designConcept.findUniqueOrThrow({
      where: { id: design.id },
      include: {
        components: {
          include: { componentType: { select: { id: true, name: true, code: true } } },
          orderBy: { sequence: "asc" },
        },
      },
    });
  });
}

export async function listDesigns(filters: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  companyId: number;
}) {
  const where = {
    companyId: filters.companyId,
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.search
      ? {
          OR: [
            { ideaRef: { contains: filters.search, mode: "insensitive" as const } },
            { collectionName: { contains: filters.search, mode: "insensitive" as const } },
            { designNumber: { contains: filters.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.designConcept.findMany({
      where,
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      orderBy: { createdAtUtc: "desc" },
      include: {
        productType: true,
        season: true,
        designHead: { select: { id: true, name: true } },
        tasks: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            status: true,
            sequence: true,
            dependencySequence: true,
            assignedEmployeeId: true,
            assignedEmployee: { select: { id: true, name: true } },
            subProcess: {
              select: {
                code: true,
                name: true,
                isApproval: true,
                defaultRole: { select: { code: true } },
              },
            },
          },
        },
        corrections: {
          select: { status: true, cycleNo: true },
        },
      },
    }),
    prisma.designConcept.count({ where }),
  ]);

  const { attachListMeta } = await import("@/lib/design-list-meta");
  return {
    items: items.map((row) => attachListMeta(row)),
    total,
  };
}

export async function getDesignById(
  id: bigint,
  options?: { viewerEmployeeId?: number; companyId?: number },
) {
  await reconcileStuckWorkflowTasks(id, options?.viewerEmployeeId);

  const correctionScope =
    options?.viewerEmployeeId != null
      ? buildCorrectionScopeForEmployee(options.viewerEmployeeId)
      : undefined;

  const design = await prisma.designConcept.findUnique({
    where: { id },
    include: {
      productType: true,
      season: true,
      fabric: true,
      machine: true,
      stitchingType: true,
      designGrade: true,
      designHead: { select: { id: true, name: true } },
      components: { include: { componentType: true } },
      images: true,
      costs: {
        select: {
          id: true,
          amount: true,
          costType: true,
          costCategory: true,
          description: true,
          enteredById: true,
          enteredAtUtc: true,
        },
        take: 200,
      },
      tasks: {
        orderBy: { sequence: "asc" },
        include: {
          assignedEmployee: { select: { id: true, name: true } },
          process: true,
          subProcess: {
            include: { defaultRole: { select: { id: true, code: true, name: true } } },
          },
          artifacts: {
            orderBy: { uploadedAtUtc: "desc" },
            select: {
              id: true,
              artifactType: true,
              stitchCount: true,
              machineFormat: true,
              sampleQty: true,
              wastageQty: true,
              needleCount: true,
              colorCount: true,
              hoopSize: true,
              softwareName: true,
              stitchDensity: true,
              fileName: true,
              storageKey: true,
              contentType: true,
              uploadedAtUtc: true,
            },
          },
          timeEvents: {
            orderBy: { eventTimeUtc: "desc" },
            take: 30,
            select: {
              id: true,
              eventType: true,
              eventTimeUtc: true,
              holdReasonId: true,
              remark: true,
              holdReason: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
      corrections: {
        where: correctionScope,
        orderBy: { createdAtUtc: "desc" },
        include: {
          raisedBy: { select: { id: true, name: true } },
          responsibleEmployee: { select: { id: true, name: true } },
          reviewerEmployee: { select: { id: true, name: true } },
          routeToSubProcess: { select: { id: true, code: true, name: true } },
        },
      },
      approvals: {
        orderBy: { id: "asc" },
        include: {
          level: { select: { id: true, name: true, sequence: true, code: true } },
          approver: { select: { id: true, name: true } },
        },
      },
      productionHandoffs: { orderBy: { releasedAtUtc: "desc" }, take: 5 },
      creativityRatings: {
        include: {
          employee: { select: { id: true, name: true } },
          ratedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!design) throw new ApiError("Design not found", 404);
  if (options?.companyId != null && design.companyId !== options.companyId) {
    throw new ApiError("Design is outside your company scope", 403);
  }

  const totalTasks = design.tasks.length;
  const completedTasks = design.tasks.filter((t) => t.status === "COMPLETED").length;
  const activeTask =
    design.tasks.find((t) =>
      ["RUNNING", "ASSIGNED", "CHECKING", "ON_HOLD", "CORRECTION_REQUIRED"].includes(t.status),
    ) ?? design.tasks.find((t) => t.status !== "COMPLETED" && t.status !== "SKIPPED");
  const costTotal = design.costs.reduce((s, c) => s + Number(c.amount), 0);
  const correctionCost = design.costs
    .filter((c) => c.costType === "CORRECTION")
    .reduce((s, c) => s + Number(c.amount), 0);
  const baseline =
    design.estimatedCost != null
      ? Number(design.estimatedCost)
      : design.standardCost != null
        ? Number(design.standardCost)
        : null;
  const marginPercent =
    baseline != null && baseline > 0
      ? Math.round(((baseline - costTotal) / baseline) * 1000) / 10
      : null;

  const { getPresignedDownloadUrl } = await import("@/lib/storage");
  async function signedUrl(storageKey: string | null | undefined) {
    if (!storageKey) return null;
    try {
      return await getPresignedDownloadUrl(storageKey);
    } catch {
      return null;
    }
  }

  const [tasks, images] = await Promise.all([
    Promise.all(
      design.tasks.map(async (task) => ({
        ...task,
        artifacts: await Promise.all(
          task.artifacts.map(async (artifact) => ({
            ...artifact,
            downloadUrl: await signedUrl(artifact.storageKey),
          })),
        ),
      })),
    ),
    Promise.all(
      design.images.map(async (image) => ({
        ...image,
        downloadUrl: await signedUrl(image.storageKey),
      })),
    ),
  ]);

  return {
    ...design,
    tasks,
    images,
    detailMeta: {
      progressPercent: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
      completedTasks,
      totalTasks,
      currentOwner: activeTask?.assignedEmployee ?? null,
      dueAt: activeTask?.dueAt ?? null,
      costSummary: {
        estimatedCost: design.estimatedCost != null ? Number(design.estimatedCost) : null,
        standardCost: design.standardCost != null ? Number(design.standardCost) : null,
        totalDevCost: costTotal,
        correctionCost,
        marginPercent,
      },
    },
  };
}

/**
 * Repair designs where a prior stage is satisfied but the next task stayed PENDING.
 * Also heals PROD_RELEASE stuck in CHECKING (LIVE_REVIEW was wrongly treated as a gate).
 */
async function reconcileStuckWorkflowTasks(
  designId: bigint,
  viewerEmployeeId?: number,
): Promise<void> {
  const correlationId = `workflow-reconcile-${designId.toString()}`;

  let actorId = viewerEmployeeId;
  if (actorId == null) {
    const design = await prisma.designConcept.findUnique({
      where: { id: designId },
      select: { designHeadEmployeeId: true },
    });
    actorId = design?.designHeadEmployeeId ?? undefined;
  }
  if (actorId != null) {
    const { healStuckProdReleaseChecking } = await import(
      "@/lib/services/production-service"
    );
    await healStuckProdReleaseChecking(designId, actorId, `${correlationId}-heal`);
  }

  const tasks = await prisma.designTask.findMany({
    where: { designId },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      designId: true,
      dependencySequence: true,
      sequence: true,
      status: true,
      subProcess: { select: { code: true } },
    },
  });

  const openResample = tasks.some(
    (task) =>
      task.subProcess?.code === "RESAMPLE" &&
      !isDependencySatisfiedStatus(task.status),
  );

  const hasStuckSuccessor = tasks.some((task, index) => {
    if (!isDependencySatisfiedStatus(task.status)) return false;
    if (openResample && task.subProcess?.code === "SAMPLE_CHECK") return false;
    const next = tasks[index + 1];
    return next?.status === "PENDING";
  });

  if (!hasStuckSuccessor) return;

  await prisma.$transaction(async (tx) => {
    for (const task of tasks) {
      if (!isDependencySatisfiedStatus(task.status)) continue;
      // Re-sample must be approved again before Costing. SAMPLE_CHECK is
      // completed for the attempt, but it must not release the next stage.
      if (openResample && task.subProcess?.code === "SAMPLE_CHECK") continue;
      await unlockNextDependentTasks(
        tx,
        {
          id: task.id,
          designId: task.designId,
          dependencySequence: task.dependencySequence,
          sequence: task.sequence,
          subProcessCode: task.subProcess?.code,
        },
        correlationId,
      );
    }
  });
}

export async function updateDesign(
  id: bigint,
  data: {
    collectionName?: string;
    conceptNote?: string;
    priority?: Priority;
    styleName?: string;
    workType?: WorkType;
    trendReference?: string;
    celebrityReference?: string;
    designGradeId?: number | null;
    fabricId?: number | null;
    machineId?: number | null;
    stitchingTypeId?: number | null;
    targetGrade?: string | null;
    version: number;
  },
  userId: number,
  correlationId: string,
) {
  if (data.fabricId != null) {
    await requireMasterOfType(data.fabricId, MASTER_TYPES.FABRIC_QUALITY);
  }
  if (data.machineId != null) {
    await requireMasterOfType(data.machineId, MASTER_TYPES.MACHINE);
  }
  if (data.stitchingTypeId != null) {
    await requireMasterOfType(data.stitchingTypeId, MASTER_TYPES.STITCHING_TYPE);
  }
  if (data.designGradeId != null) {
    await requireMasterOfType(data.designGradeId, MASTER_TYPES.DESIGN_GRADE);
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.designConcept.findUnique({ where: { id } });
    if (!existing) throw new ApiError("Design not found", 404);
    if (existing.version !== data.version) {
      throw new ApiError("Concurrency conflict - refresh and retry", 409);
    }

    const updated = await tx.designConcept.update({
      where: { id },
      data: {
        collectionName: data.collectionName,
        conceptNote: data.conceptNote,
        priority: data.priority,
        styleName: data.styleName,
        workType: data.workType,
        trendReference: data.trendReference,
        celebrityReference: data.celebrityReference,
        ...(data.designGradeId !== undefined ? { designGradeId: data.designGradeId } : {}),
        ...(data.fabricId !== undefined ? { fabricId: data.fabricId } : {}),
        ...(data.machineId !== undefined ? { machineId: data.machineId } : {}),
        ...(data.stitchingTypeId !== undefined ? { stitchingTypeId: data.stitchingTypeId } : {}),
        ...(data.targetGrade !== undefined ? { targetGrade: data.targetGrade } : {}),
        version: { increment: 1 },
      },
    });

    if (data.priority && data.priority !== existing.priority) {
      await tx.designTask.updateMany({
        where: {
          designId: id,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        data: { priority: data.priority },
      });
    }

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: id.toString(),
      action: "UPDATE",
      userId,
      correlationId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

const EDITABLE_TASK_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CORRECTION_REQUIRED",
] as const;

export type DesignTaskScheduleUpdate = {
  taskId: string | bigint;
  dueAt?: string | Date | null;
  priority?: Priority;
  assignedEmployeeId?: number | null;
  expectedMinutes?: number;
};

/** Update due dates / assignees / priority on open workflow tasks for a design. */
export async function updateDesignTaskSchedule(
  designId: bigint,
  updates: DesignTaskScheduleUpdate[],
  userId: number,
  correlationId: string,
) {
  if (updates.length === 0) {
    throw new ApiError("At least one task update is required", 422);
  }

  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: designId } });
    if (!design) throw new ApiError("Design not found", 404);

    const changed: Array<{ taskId: string; fields: string[] }> = [];

    for (const update of updates) {
      const taskId = typeof update.taskId === "bigint" ? update.taskId : BigInt(update.taskId);
      const existing = await tx.designTask.findFirst({
        where: { id: taskId, designId },
      });
      if (!existing) {
        throw new ApiError(`Task ${String(taskId)} not found on this design`, 404);
      }
      if (!(EDITABLE_TASK_STATUSES as readonly string[]).includes(existing.status)) {
        throw new ApiError(
          `Cannot edit schedule for task in status ${existing.status}`,
          422,
        );
      }

      const data: {
        dueAt?: Date | null;
        priority?: Priority;
        assignedEmployeeId?: number | null;
        expectedMinutes?: number;
        version?: { increment: number };
      } = {};
      const fields: string[] = [];

      if (update.dueAt !== undefined) {
        data.dueAt =
          update.dueAt == null || update.dueAt === ""
            ? null
            : resolveManualDueAt(
                update.dueAt,
                existing.plannedStart ?? new Date(),
                update.expectedMinutes ?? existing.expectedMinutes,
              );
        fields.push("dueAt");
      }
      if (update.priority !== undefined) {
        data.priority = update.priority;
        fields.push("priority");
      }
      if (update.assignedEmployeeId !== undefined) {
        data.assignedEmployeeId = update.assignedEmployeeId;
        fields.push("assignedEmployeeId");
      }
      if (update.expectedMinutes !== undefined) {
        if (update.expectedMinutes <= 0) {
          throw new ApiError("Expected minutes must be greater than zero", 422);
        }
        data.expectedMinutes = update.expectedMinutes;
        fields.push("expectedMinutes");
      }

      if (fields.length === 0) continue;
      data.version = { increment: 1 };

      await tx.designTask.update({
        where: { id: taskId },
        data,
      });
      changed.push({ taskId: taskId.toString(), fields });
    }

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "UPDATE_TASK_SCHEDULE",
      userId,
      correlationId,
      after: { updates: changed },
    });

    return { updated: changed.length };
  });
}

/** Require at least one DesignImage marked primary before ACTIVE workflow work. */
export async function assertDesignHasPrimaryImage(
  designId: bigint,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const primary = await client.designImage.findFirst({
    where: { designId, isPrimary: true },
    select: { id: true },
  });
  if (!primary) {
    throw businessRule(
      APP_ERROR_CODES.PRIMARY_IMAGE_REQUIRED,
      { designId: designId.toString() },
      "Upload at least one design image and mark it as primary before starting workflow tasks.",
    );
  }
}

export async function updateDesignStatus(
  id: bigint,
  status: import("@prisma/client").DesignStatus,
  version: number,
  userId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.designConcept.findUnique({ where: { id } });
    if (!existing) throw new ApiError("Design not found", 404);
    if (existing.version !== version) {
      throw new ApiError("Concurrency conflict - refresh and retry", 409);
    }

    try {
      assertAllowedDesignStatusTransition(existing.status, status);
    } catch (error) {
      if (error instanceof DesignStatusTransitionError) {
        throw new ApiError(error.message, error.status);
      }
      throw error;
    }

    if (status === "ACTIVE" && existing.status !== "ACTIVE") {
      await assertDesignHasPrimaryImage(id, tx);
    }

    const updated = await tx.designConcept.update({
      where: { id },
      data: { status, version: { increment: 1 } },
    });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: id.toString(),
      action: "STATUS_CHANGE",
      userId,
      correlationId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

export {
  assertAllowedDesignStatusTransition,
  DESIGN_STATUS_TRANSITIONS,
} from "@/lib/services/design-status-transitions";

const KANBAN_OPEN_CORRECTION = ["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"] as const;

/** Slim rows for lane placement. Card images are signed only for the current page. */
export async function listDesignsForKanban(companyId: number) {
  return prisma.designConcept.findMany({
    where: { companyId, status: { notIn: ["CLOSED", "REJECTED"] } },
    orderBy: { createdAtUtc: "desc" },
    select: {
      id: true,
      ideaRef: true,
      collectionName: true,
      status: true,
      currentStage: true,
      priority: true,
      version: true,
      estimatedCost: true,
      createdAtUtc: true,
      updatedAtUtc: true,
      productType: { select: { name: true, code: true } },
      season: { select: { id: true, name: true } },
      designHead: { select: { name: true } },
      images: {
        where: { mediaKind: "IMAGE" },
        orderBy: [{ isPrimary: "desc" }, { uploadedAtUtc: "desc" }],
        take: 1,
        select: { storageKey: true },
      },
      corrections: {
        where: { status: { in: [...KANBAN_OPEN_CORRECTION] } },
        select: { id: true },
      },
      tasks: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          status: true,
          sequence: true,
          dependencySequence: true,
          dueAt: true,
          assignedEmployeeId: true,
          assignedEmployee: { select: { id: true, name: true } },
          process: { select: { id: true, name: true, code: true } },
          subProcess: {
            select: { id: true, name: true, code: true, isApproval: true },
          },
        },
      },
    },
  });
}

function toNumberCost(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function nearestOpenDueAt(
  tasks: Array<{ status: string; dueAt: Date | null }>,
): Date | null {
  const dates = tasks
    .filter(
      (t) =>
        t.dueAt != null &&
        !["COMPLETED", "CANCELLED", "SKIPPED"].includes(t.status),
    )
    .map((t) => t.dueAt as Date);
  if (dates.length === 0) return null;
  return dates.reduce((soonest, d) => (d < soonest ? d : soonest));
}

/** When every stage is finished, the card still shows the last stage deadline. */
function latestTaskDueAt(
  tasks: Array<{ dueAt: Date | null }>,
): Date | null {
  const dates = tasks.map((t) => t.dueAt).filter((d): d is Date => d != null);
  if (dates.length === 0) return null;
  return dates.reduce((latest, d) => (d > latest ? d : latest));
}

export type KanbanDashboardQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  product?: string;
  seasonId?: string;
  owner?: string;
  priority?: string;
};

/**
 * Workflow board payload. Summary uses every open design.
 * Only the current page of each column is returned, with image URLs signed for those cards.
 */
export async function getDesignWorkflowDashboard(
  companyId: number,
  query: KanbanDashboardQuery = {},
): Promise<{
  items: KanbanDesignItem[];
  summary: {
    totalIdeas: number;
    createdThisMonth: number;
    underDevelopment: number;
    highPriorityInDev: number;
    correctionPending: number;
    delayedCount: number;
    approvedCount: number;
    approvalRate: number;
    releasedCount: number;
    estimatedCostSum: number;
    avgDevelopmentDays: number | null;
  };
  laneCounts: Record<WorkflowLaneId, number>;
  owners: string[];
  pagination: { page: number; pageSize: number; total: number };
}> {
  const { getPresignedDownloadUrl } = await import("@/lib/storage");
  const designs = await listDesignsForKanban(companyId);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const pageSize = clampKanbanPageSize(query.pageSize ?? 10);

  const items = designs.map((design) => {
    const dueAt = nearestOpenDueAt(design.tasks) ?? latestTaskDueAt(design.tasks);
    const estimatedCost = toNumberCost(design.estimatedCost);
    const openCorrectionCount =
      design.corrections.length +
      design.tasks.filter((t) => t.status === "CORRECTION_REQUIRED").length;
    const tasks = design.tasks.map((task) => ({
      id: task.id.toString(),
      status: task.status,
      sequence: task.sequence,
      dependencySequence: task.dependencySequence,
      dueAt: task.dueAt ? task.dueAt.toISOString() : null,
      assignedEmployeeId: task.assignedEmployeeId,
      assignedEmployee: task.assignedEmployee
        ? {
            id: task.assignedEmployee.id,
            name: task.assignedEmployee.name,
            employeeCode: "",
          }
        : null,
      process: task.process,
      subProcess: task.subProcess,
      priority: design.priority,
      expectedMinutes: 0,
      version: 0,
      design: {
        id: design.id.toString(),
        ideaRef: design.ideaRef,
        collectionName: design.collectionName,
        priority: design.priority,
      },
    })) as DesignTask[];

    const card: KanbanDesignItem & { storageKey: string | null } = {
      id: design.id.toString(),
      ideaRef: design.ideaRef,
      collectionName: design.collectionName,
      status: design.status,
      currentStage: design.currentStage,
      priority: design.priority,
      version: design.version,
      productType: {
        name: design.productType.name,
        code: design.productType.code,
      },
      designHead: { name: design.designHead.name },
      season: design.season ? { id: design.season.id, name: design.season.name } : null,
      estimatedCost,
      createdAtUtc: design.createdAtUtc.toISOString(),
      dueAt: dueAt ? dueAt.toISOString() : null,
      primaryImageUrl: null,
      openCorrectionCount,
      storageKey: design.images[0]?.storageKey ?? null,
      workflow: buildKanbanWorkflowInfo({ status: design.status, tasks }),
    };
    return card;
  });

  const totalIdeas = items.length;
  const createdThisMonth = items.filter(
    (d) => d.createdAtUtc && new Date(d.createdAtUtc) >= monthStart,
  ).length;
  const underDevelopment = items.filter((d) =>
    ["DRAFT", "ACTIVE", "APPROVAL_PENDING", "ON_HOLD"].includes(d.status),
  ).length;
  const highPriorityInDev = items.filter(
    (d) =>
      ["DRAFT", "ACTIVE", "APPROVAL_PENDING"].includes(d.status) &&
      (d.priority === "HIGH" || d.priority === "URGENT"),
  ).length;
  const correctionPending = items.filter(
    (d) =>
      (d.openCorrectionCount ?? 0) > 0 ||
      d.status === "ON_HOLD" ||
      String(d.currentStage ?? "").includes("CORRECTION"),
  ).length;
  const delayedCount = items.filter((d) => {
    if (!d.dueAt) return false;
    if (["APPROVED", "PRODUCTION_ACCEPTED", "PRODUCTION_RELEASED", "LIVE"].includes(d.status)) {
      return false;
    }
    if (d.workflow.totalStages > 0 && d.workflow.completedStages >= d.workflow.totalStages) {
      return false;
    }
    return new Date(d.dueAt) < now;
  }).length;
  const approvedStatuses = [
    "APPROVED",
    "PRODUCTION_ACCEPTED",
    "PRODUCTION_RELEASED",
    "LIVE",
  ];
  const approvedCount = items.filter((d) => approvedStatuses.includes(d.status)).length;
  const releasedCount = items.filter((d) =>
    ["PRODUCTION_RELEASED", "LIVE"].includes(d.status),
  ).length;
  const approvalRate =
    totalIdeas > 0 ? Math.round((approvedCount / totalIdeas) * 100) : 0;
  const estimatedCostSum = items
    .filter((d) => ["PRODUCTION_RELEASED", "LIVE"].includes(d.status))
    .reduce((sum, d) => sum + (d.estimatedCost ?? 0), 0);

  const finished = designs.filter((d) =>
    ["APPROVED", "PRODUCTION_ACCEPTED", "PRODUCTION_RELEASED", "LIVE"].includes(d.status),
  );
  let avgDevelopmentDays: number | null = null;
  if (finished.length > 0) {
    const days = finished.map((d) => {
      const end = d.updatedAtUtc.getTime();
      const start = d.createdAtUtc.getTime();
      return Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
    });
    avgDevelopmentDays =
      Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
  }

  const q = (query.q ?? "").trim().toLowerCase();
  const product = query.product && query.product !== "ALL" ? query.product : "";
  const seasonId = query.seasonId && query.seasonId !== "ALL" ? query.seasonId : "";
  const owner = query.owner && query.owner !== "ALL" ? query.owner : "";
  const priority = query.priority && query.priority !== "ALL" ? query.priority : "";

  const filtered = items.filter((design) => {
    if (product && design.productType?.name !== product) return false;
    if (seasonId && String(design.season?.id ?? "") !== seasonId) return false;
    if (owner && design.designHead?.name !== owner) return false;
    if (priority && design.priority !== priority) return false;
    if (!q) return true;
    const priorityLabel = design.priority.toLowerCase();
    const haystack = [
      design.ideaRef,
      design.collectionName,
      design.productType?.name,
      design.productType?.code,
      design.season?.name,
      design.designHead?.name,
      design.workflow.currentOwner,
      design.workflow.currentStage,
      design.currentStage,
      priorityLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  const lanes = Object.fromEntries(
    WORKFLOW_LANES.map((lane) => [lane.id, [] as typeof filtered]),
  ) as Record<WorkflowLaneId, typeof filtered>;
  for (const design of filtered) {
    lanes[resolveLaneId(design)].push(design);
  }
  for (const lane of WORKFLOW_LANES) {
    lanes[lane.id].sort(compareBoardCards);
  }

  const laneCounts = Object.fromEntries(
    WORKFLOW_LANES.map((lane) => [lane.id, lanes[lane.id].length]),
  ) as Record<WorkflowLaneId, number>;
  const fullest = Math.max(0, ...Object.values(laneCounts));
  const pageCount = Math.max(1, Math.ceil(fullest / pageSize) || 1);
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);
  const start = (page - 1) * pageSize;

  const pageItems = WORKFLOW_LANES.flatMap((lane) => {
    const rows = lanes[lane.id];
    if (rows.length <= pageSize) return rows;
    return rows.slice(start, start + pageSize);
  });
  await Promise.all(
    pageItems.map(async (design) => {
      if (!design.storageKey) return;
      try {
        design.primaryImageUrl = await getPresignedDownloadUrl(design.storageKey);
      } catch {
        design.primaryImageUrl = null;
      }
    }),
  );

  const owners = [
    ...new Set(
      items
        .map((design) => design.designHead?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    items: pageItems.map(({ storageKey: _storageKey, ...design }) => design),
    summary: {
      totalIdeas,
      createdThisMonth,
      underDevelopment,
      highPriorityInDev,
      correctionPending,
      delayedCount,
      approvedCount,
      approvalRate,
      releasedCount,
      estimatedCostSum,
      avgDevelopmentDays,
    },
    laneCounts,
    owners,
    pagination: { page, pageSize, total: fullest },
  };
}

export async function generateTasksFromPattern(
  designId: bigint,
  workflowPatternId: number,
  userId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const design = await tx.designConcept.findUnique({ where: { id: designId } });
    if (!design) throw new ApiError("Design not found", 404);

    const existingTaskCount = await tx.designTask.count({ where: { designId } });
    if (existingTaskCount > 0) {
      throw new ApiError("Design already has workflow tasks. Cannot regenerate from pattern.", 422);
    }

    const pattern = await tx.workflowPattern.findUnique({
      where: { id: workflowPatternId },
    });
    if (!pattern) throw new ApiError("Workflow pattern not found", 404);
    if (!pattern.active) {
      throw new ApiError("Workflow pattern is inactive and cannot be used", 422);
    }
    if (
      pattern.productTypeId != null &&
      pattern.productTypeId !== design.productTypeId
    ) {
      throw new ApiError(
        "Workflow pattern does not apply to this design's product type",
        422,
      );
    }

    const patternTasks = await tx.workflowPatternTask.findMany({
      where: { workflowPatternId },
      orderBy: { sequence: "asc" },
      include: { subProcess: { select: { isApproval: true } } },
    });

    if (patternTasks.length === 0) {
      throw new ApiError("Workflow pattern has no tasks", 422);
    }

    const tasksToCreate = await buildTasksFromPatternTasks(designId, patternTasks, {
      firstAssigneeId: design.designHeadEmployeeId,
      designPriority: design.priority,
      taskDateMode: "SEQUENTIAL",
      companyId: design.companyId,
      productTypeId: design.productTypeId,
    });

    await createDesignProcessInstances(tx, designId, tasksToCreate);
    await tx.designTask.createMany({ data: toPrismaTaskCreateRows(tasksToCreate) });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "GENERATE_TASKS",
      userId,
      correlationId,
      after: { workflowPatternId, taskCount: patternTasks.length },
    });
  });
}
