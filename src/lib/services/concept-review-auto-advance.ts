import { prisma } from "@/lib/db";
import { ROLE_CODES } from "@/lib/permissions";
import { isTaskReady } from "@/lib/services/task-dependency";
import { getStageApprovalOwnerRole } from "@/lib/stage-approval-rbac";
import { completeStageApproval } from "@/lib/services/task-service";
import { resolveStageBehavior } from "@/lib/workflow/stage-behavior";

const OPEN_AUTO_ADVANCE_STATUSES = [
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CHECKING",
  "PENDING",
] as const;

export type StuckConceptReview = {
  taskId: bigint;
  version: number;
  status: string;
};

export async function findStuckConceptReviewTask(
  designId: bigint,
): Promise<StuckConceptReview | null> {
  const tasks = await prisma.designTask.findMany({
    where: { designId },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      version: true,
      status: true,
      dependencySequence: true,
      sequence: true,
      subProcess: {
        select: {
          code: true,
          capabilities: true,
          defaultRole: { select: { code: true } },
        },
      },
    },
  });

  const autoAdvance = tasks.find((t) =>
    resolveStageBehavior({
      code: t.subProcess.code,
      capabilities: t.subProcess.capabilities,
      defaultRoleCode: t.subProcess.defaultRole?.code,
    }).autoAdvanceOnCreate,
  );
  if (!autoAdvance) return null;
  if (autoAdvance.status === "COMPLETED" || autoAdvance.status === "CANCELLED") return null;
  if (
    !OPEN_AUTO_ADVANCE_STATUSES.includes(
      autoAdvance.status as (typeof OPEN_AUTO_ADVANCE_STATUSES)[number],
    )
  ) {
    return null;
  }

  // If a dependency-next execute stage has already progressed past PENDING/ASSIGNED, skip.
  const nextOpen = tasks.find(
    (t) =>
      t.sequence > autoAdvance.sequence &&
      !["COMPLETED", "CANCELLED", "SKIPPED"].includes(t.status),
  );
  if (nextOpen && !["PENDING", "ASSIGNED"].includes(nextOpen.status)) {
    return null;
  }

  if (autoAdvance.status === "PENDING") {
    const ready = isTaskReady(
      {
        id: autoAdvance.id.toString(),
        dependencySequence: autoAdvance.dependencySequence,
        sequence: autoAdvance.sequence,
        status: autoAdvance.status,
      },
      tasks.map((t) => ({
        id: t.id.toString(),
        dependencySequence: t.dependencySequence,
        sequence: t.sequence,
        status: t.status,
      })),
    );
    if (!ready) return null;
  }

  return {
    taskId: autoAdvance.id,
    version: autoAdvance.version,
    status: autoAdvance.status,
  };
}

async function syncDesignCurrentStageToNextOpen(designId: bigint) {
  const next = await prisma.designTask.findFirst({
    where: {
      designId,
      status: { notIn: ["COMPLETED", "CANCELLED", "SKIPPED"] },
    },
    orderBy: { sequence: "asc" },
    select: { subProcess: { select: { code: true } } },
  });

  if (!next?.subProcess.code) return;

  await prisma.designConcept.update({
    where: { id: designId },
    data: { currentStage: next.subProcess.code },
  });
}

export type AutoAdvanceConceptReviewResult =
  | { advanced: false; reason: "not_found" | "already_done" }
  | { advanced: true; taskId: string };

export async function autoAdvanceConceptReview(
  designId: bigint,
  actorEmployeeId: number,
  correlationId: string,
  options?: { remark?: string; roleCode?: string },
): Promise<AutoAdvanceConceptReviewResult> {
  const stuck = await findStuckConceptReviewTask(designId);
  if (!stuck) {
    const anyAuto = await prisma.designTask.findFirst({
      where: {
        designId,
        OR: [
          { subProcess: { code: "CONCEPT_REVIEW" } },
          { subProcess: { capabilities: { path: ["autoAdvanceOnCreate"], equals: true } } },
        ],
      },
      select: {
        status: true,
        subProcess: { select: { code: true, capabilities: true, defaultRole: { select: { code: true } } } },
      },
    });
    if (!anyAuto) return { advanced: false, reason: "not_found" };
    if (anyAuto.status === "COMPLETED") return { advanced: false, reason: "already_done" };
    return { advanced: false, reason: "not_found" };
  }

  const taskMeta = await prisma.designTask.findUnique({
    where: { id: stuck.taskId },
    select: {
      subProcess: {
        select: { code: true, defaultRole: { select: { code: true } } },
      },
    },
  });
  const stageCode = taskMeta?.subProcess.code ?? "CONCEPT_REVIEW";
  const effectiveRoleCode =
    taskMeta?.subProcess.defaultRole?.code ??
    getStageApprovalOwnerRole(stageCode) ??
    ROLE_CODES.DESIGN_HEAD;

  await completeStageApproval(
    stuck.taskId,
    actorEmployeeId,
    {
      outputRemark: options?.remark ?? "Auto-approved on design create",
      version: stuck.version,
      decision: "APPROVED",
    },
    correlationId,
    effectiveRoleCode,
  );

  await syncDesignCurrentStageToNextOpen(designId);

  return { advanced: true, taskId: stuck.taskId.toString() };
}

/** Used by scripts/repair-stuck-concept-review.mjs after deploy. */
export async function listDesignsWithStuckConceptReview(): Promise<
  Array<{ id: bigint; ideaRef: string; designHeadEmployeeId: number; createdById: number }>
> {
  const designs = await prisma.designConcept.findMany({
    where: {
      status: { notIn: ["CLOSED", "REJECTED"] },
      tasks: {
        some: {
          status: { in: [...OPEN_AUTO_ADVANCE_STATUSES] },
          OR: [
            { subProcess: { code: "CONCEPT_REVIEW" } },
            { subProcess: { capabilities: { path: ["autoAdvanceOnCreate"], equals: true } } },
          ],
        },
      },
    },
    select: {
      id: true,
      ideaRef: true,
      designHeadEmployeeId: true,
      createdById: true,
    },
    orderBy: { createdAtUtc: "asc" },
  });

  const stuck: typeof designs = [];
  for (const design of designs) {
    const found = await findStuckConceptReviewTask(design.id);
    if (found) stuck.push(design);
  }
  return stuck;
}
