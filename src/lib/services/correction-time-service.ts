import { prisma } from "@/lib/db";
import {
  computeCorrectionTimeBreakdown,
  type CorrectionTimeBreakdown,
} from "@/lib/services/correction-time-utils";

type CorrectionWithIds = {
  id: bigint;
  taskId: bigint;
  routedTaskId?: bigint | null;
  createdAtUtc: Date;
  reworkAssigneeEmployeeId?: number | null;
  responsibleEmployeeId?: number | null;
};

/** Attach Prior | Rework | Total active seconds for the rework (or responsible) user. */
export async function attachCorrectionTimeBreakdowns<T extends CorrectionWithIds>(
  rows: T[],
): Promise<Array<T & { timeBreakdown: CorrectionTimeBreakdown }>> {
  if (rows.length === 0) return [];

  const taskIds = new Set<bigint>();
  for (const row of rows) {
    taskIds.add(row.taskId);
    if (row.routedTaskId != null) taskIds.add(row.routedTaskId);
  }

  const events = await prisma.taskTimeEvent.findMany({
    where: { taskId: { in: [...taskIds] } },
    select: {
      taskId: true,
      employeeId: true,
      eventType: true,
      eventTimeUtc: true,
      holdReasonId: true,
    },
    orderBy: { eventTimeUtc: "asc" },
  });

  const byTask = new Map<string, typeof events>();
  for (const ev of events) {
    const key = ev.taskId.toString();
    const list = byTask.get(key) ?? [];
    list.push(ev);
    byTask.set(key, list);
  }

  return rows.map((row) => {
    const employeeId =
      row.reworkAssigneeEmployeeId ?? row.responsibleEmployeeId ?? null;
    const sourceAll = byTask.get(row.taskId.toString()) ?? [];
    const routedKey = (row.routedTaskId ?? row.taskId).toString();
    const routedAll = byTask.get(routedKey) ?? sourceAll;

    const filterEmp = <E extends { employeeId: number }>(list: E[]) =>
      employeeId == null ? list : list.filter((e) => e.employeeId === employeeId);

    const timeBreakdown = computeCorrectionTimeBreakdown({
      createdAtUtc: row.createdAtUtc,
      employeeId,
      sourceTaskEvents: filterEmp(sourceAll),
      routedTaskEvents: filterEmp(routedAll),
    });

    return { ...row, timeBreakdown };
  });
}

export async function getCorrectionTimeBreakdownForId(
  correctionId: bigint,
): Promise<CorrectionTimeBreakdown | null> {
  const row = await prisma.designCorrection.findUnique({
    where: { id: correctionId },
    select: {
      id: true,
      taskId: true,
      routedTaskId: true,
      createdAtUtc: true,
      reworkAssigneeEmployeeId: true,
      responsibleEmployeeId: true,
    },
  });
  if (!row) return null;
  const [enriched] = await attachCorrectionTimeBreakdowns([row]);
  return enriched?.timeBreakdown ?? null;
}
