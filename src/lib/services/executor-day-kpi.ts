import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ROLE_CODES } from "@/lib/permissions";

const STAGE_CODES: Record<string, string[]> = {
  [ROLE_CODES.SKETCH_DESIGNER]: ["SKETCH"],
  [ROLE_CODES.PUNCHING_DESIGNER]: ["PUNCH"],
  [ROLE_CODES.MACHINE_OPERATOR]: [
    "MACHINE_SAMPLE",
    "SAMPLE_CUTTING",
    "SAMPLE_STITCHING",
    "SAMPLE_RECEIVE",
    "RESAMPLE",
  ],
  [ROLE_CODES.SAMPLE_CHECKER]: ["SAMPLE_CHECK", "PUNCH_CHECK"],
  [ROLE_CODES.COSTING_TEAM]: ["COSTING"],
  [ROLE_CODES.PRODUCTION_HEAD]: ["PROD_HANDOFF", "PROD_INSTRUCTION", "PROD_RELEASE"],
  [ROLE_CODES.DESIGN_HEAD]: ["CONCEPT_REVIEW", "SKETCH_APPROVAL", "FINAL_APPROVAL"],
  [ROLE_CODES.MANAGEMENT]: ["LIVE_REVIEW", "FINAL_APPROVAL"],
};

const REWORK_RAISED_BY = new Set<string>([
  ROLE_CODES.SAMPLE_CHECKER,
  ROLE_CODES.DESIGN_HEAD,
  ROLE_CODES.PRODUCTION_HEAD,
  ROLE_CODES.MANAGEMENT,
]);

type CardTone = "default" | "accent" | "warning" | "danger" | "success";

export type RoleDayCard = {
  label: string;
  value: number | string;
  trend: string;
  tone: CardTone;
};

export type RoleDayKpi = {
  from: string;
  to: string;
  title: string;
  description: string;
  cards: RoleDayCard[];
};

type PerfCopy = {
  title: string;
  description: string;
  assigned: string;
  completed: string;
  rework: string;
  today: string;
  reworkTrend: string;
  todayTrend: string;
};

export function localDayBounds(date: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

function rangeBounds(from: string, to: string): { start: Date; end: Date; from: string; to: string } | null {
  const startDay = localDayBounds(from);
  const endDay = localDayBounds(to);
  if (!startDay || !endDay) return null;
  if (startDay.start <= endDay.start) {
    return { start: startDay.start, end: endDay.end, from, to };
  }
  return { start: endDay.start, end: startDay.end, from: to, to: from };
}

function stageWhere(codes: string[] | undefined): Prisma.DesignTaskWhereInput {
  if (!codes?.length) return {};
  return { subProcess: { code: { in: codes } } };
}

function todayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const bounds = localDayBounds(`${now.getFullYear()}-${month}-${day}`);
  if (!bounds) throw new Error("today");
  return bounds;
}

/** Designs handed to the person in the period, even when the due date is later. */
function handedOverWhere(
  scope: Prisma.DesignTaskWhereInput,
  start: Date,
  end: Date,
): Prisma.DesignTaskWhereInput {
  return {
    AND: [
      scope,
      { status: { notIn: ["CANCELLED", "PENDING", "SKIPPED"] } },
      {
        OR: [
          { design: { createdAtUtc: { gte: start, lte: end } } },
          { status: "ASSIGNED", startedAt: null, updatedAtUtc: { gte: start, lte: end } },
        ],
      },
    ],
  };
}

async function countTaskDesigns(where: Prisma.DesignTaskWhereInput): Promise<number> {
  const rows = await prisma.designTask.groupBy({
    by: ["designId"],
    where,
  });
  return rows.length;
}

async function countCorrectionDesigns(where: Prisma.DesignCorrectionWhereInput): Promise<number> {
  const rows = await prisma.designCorrection.groupBy({
    by: ["designId"],
    where,
  });
  return rows.length;
}

function copyFor(roleCode: string): PerfCopy {
  const description =
    "Assigned, completed, and rework follow the dates you pick. Assigned today is designs given to you today, even if the due date is later.";
  const todayTrend = "Designs given to you today";
  if (roleCode === ROLE_CODES.SKETCH_DESIGNER) {
    return {
      title: "Sketch performance",
      description,
      assigned: "Sketches assigned",
      completed: "Sketches completed",
      rework: "Sketch rework",
      today: "Assigned today",
      reworkTrend: "Designs sent back on your sketches",
      todayTrend,
    };
  }
  if (roleCode === ROLE_CODES.PUNCHING_DESIGNER) {
    return {
      title: "Punching performance",
      description,
      assigned: "Punch jobs assigned",
      completed: "Punch jobs completed",
      rework: "Punch rework",
      today: "Assigned today",
      reworkTrend: "Designs sent back on your punch work",
      todayTrend,
    };
  }
  if (roleCode === ROLE_CODES.MACHINE_OPERATOR) {
    return {
      title: "Machine performance",
      description,
      assigned: "Samples assigned",
      completed: "Samples completed",
      rework: "Re-sample",
      today: "Assigned today",
      reworkTrend: "Designs sent back on your samples",
      todayTrend,
    };
  }
  if (roleCode === ROLE_CODES.SAMPLE_CHECKER) {
    return {
      title: "Quality performance",
      description,
      assigned: "Checks assigned",
      completed: "Checks completed",
      rework: "Sent back",
      today: "Assigned today",
      reworkTrend: "Designs you sent back",
      todayTrend,
    };
  }
  if (roleCode === ROLE_CODES.COSTING_TEAM) {
    return {
      title: "Costing performance",
      description,
      assigned: "Costing assigned",
      completed: "Costing completed",
      rework: "Cost rework",
      today: "Assigned today",
      reworkTrend: "Designs sent back on your costing",
      todayTrend,
    };
  }
  if (roleCode === ROLE_CODES.PRODUCTION_HEAD) {
    return {
      title: "Production performance",
      description,
      assigned: "Steps assigned",
      completed: "Steps completed",
      rework: "Returned",
      today: "Assigned today",
      reworkTrend: "Designs you returned",
      todayTrend,
    };
  }
  if (roleCode === ROLE_CODES.DESIGN_HEAD) {
    return {
      title: "Design performance",
      description,
      assigned: "Reviews assigned",
      completed: "Reviews completed",
      rework: "Sent back",
      today: "Assigned today",
      reworkTrend: "Designs you sent back",
      todayTrend,
    };
  }
  if (roleCode === ROLE_CODES.MANAGEMENT) {
    return {
      title: "Management performance",
      description,
      assigned: "Reviews assigned",
      completed: "Reviews completed",
      rework: "Sent back",
      today: "Assigned today",
      reworkTrend: "Designs you sent back",
      todayTrend,
    };
  }
  if (roleCode === ROLE_CODES.ADMIN) {
    return {
      title: "Company performance",
      description:
        "Assigned, completed, and rework follow the dates you pick. Assigned today is designs given out today.",
      assigned: "Designs assigned",
      completed: "Designs completed",
      rework: "Rework designs",
      today: "Assigned today",
      reworkTrend: "Designs with a correction in this period",
      todayTrend: "Designs given out today",
    };
  }
  return {
    title: "My performance",
    description,
    assigned: "Assigned",
    completed: "Completed",
    rework: "Rework",
    today: "Assigned today",
    reworkTrend: "Designs sent back on you",
    todayTrend,
  };
}

export async function getRoleDayKpi(
  employeeId: number,
  companyId: number,
  roleCode: string,
  from: string,
  to: string,
): Promise<RoleDayKpi | null> {
  const bounds = rangeBounds(from, to);
  const today = todayBounds();
  if (!bounds) return null;

  const codes = roleCode === ROLE_CODES.ADMIN ? undefined : STAGE_CODES[roleCode];
  const person: Prisma.DesignTaskWhereInput =
    roleCode === ROLE_CODES.ADMIN
      ? { design: { companyId } }
      : { assignedEmployeeId: employeeId };
  const taskScope: Prisma.DesignTaskWhereInput = { ...person, ...stageWhere(codes) };

  const reworkWhere: Prisma.DesignCorrectionWhereInput = {
    createdAtUtc: { gte: bounds.start, lte: bounds.end },
    ...(roleCode === ROLE_CODES.ADMIN
      ? { design: { companyId } }
      : REWORK_RAISED_BY.has(roleCode)
        ? {
            raisedById: employeeId,
            ...(codes?.length ? { task: { subProcess: { code: { in: codes } } } } : {}),
          }
        : { responsibleEmployeeId: employeeId }),
  };

  const [assigned, completed, rework, todayCount] = await Promise.all([
    countTaskDesigns(handedOverWhere(taskScope, bounds.start, bounds.end)),
    countTaskDesigns({
      ...taskScope,
      status: "COMPLETED",
      completedAt: { gte: bounds.start, lte: bounds.end },
    }),
    countCorrectionDesigns(reworkWhere),
    countTaskDesigns(handedOverWhere(taskScope, today.start, today.end)),
  ]);

  const copy = copyFor(roleCode);
  return {
    from: bounds.from,
    to: bounds.to,
    title: copy.title,
    description: copy.description,
    cards: [
      {
        label: copy.assigned,
        value: assigned,
        trend: "Designs given to you in this period",
        tone: "accent",
      },
      {
        label: copy.completed,
        value: completed,
        trend: "Designs finished in this period",
        tone: "success",
      },
      {
        label: copy.rework,
        value: rework,
        trend: copy.reworkTrend,
        tone: rework > 0 ? "warning" : "default",
      },
      {
        label: copy.today,
        value: todayCount,
        trend: copy.todayTrend,
        tone: "default",
      },
    ],
  };
}
