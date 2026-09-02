import { prisma } from "@/lib/db";
import { ROLE_CODES } from "@/lib/permissions";
import { isTaskReady } from "@/lib/services/task-dependency";
import { canRoleActOnStageApproval } from "@/lib/stage-approval-rbac";
import { completeStageApproval } from "@/lib/services/task-service";

const OPEN_CONCEPT_STATUSES = ["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING", "PENDING"] as const;

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
      subProcess: { select: { code: true } },
    },
  });

  const concept = tasks.find((t) => t.subProcess.code === "CONCEPT_REVIEW");
  if (!concept) return null;
  if (concept.status === "COMPLETED" || concept.status === "CANCELLED") return null;
  if (!OPEN_CONCEPT_STATUSES.includes(concept.status as (typeof OPEN_CONCEPT_STATUSES)[number])) {
    return null;
  }

  const sketch = tasks.find((t) => t.subProcess.code === "SKETCH");
  if (sketch && !["PENDING", "ASSIGNED"].includes(sketch.status)) {
    return null;
  }

  if (concept.status === "PENDING") {
    const ready = isTaskReady(
      {
        id: concept.id.toString(),
        dependencySequence: concept.dependencySequence,
        sequence: concept.sequence,
        status: concept.status,
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

  return { taskId: concept.id, version: concept.version, status: concept.status };
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
    const concept = await prisma.designTask.findFirst({
      where: { designId, subProcess: { code: "CONCEPT_REVIEW" } },
      select: { status: true },
    });
    if (!concept) return { advanced: false, reason: "not_found" };
    if (concept.status === "COMPLETED") return { advanced: false, reason: "already_done" };
    return { advanced: false, reason: "not_found" };
  }

  // System auto-advance must use CONCEPT_REVIEW owner role when the creator
  // is Admin (or another non–Design Head) who still owns the design head seat.
  const requestedRole = options?.roleCode;
  const effectiveRoleCode = canRoleActOnStageApproval(requestedRole, "CONCEPT_REVIEW")
    ? requestedRole
    : ROLE_CODES.DESIGN_HEAD;

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
          subProcess: { code: "CONCEPT_REVIEW" },
          status: { in: [...OPEN_CONCEPT_STATUSES] },
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
