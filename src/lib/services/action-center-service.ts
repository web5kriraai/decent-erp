import { prisma } from "@/lib/db";
import {
  buildBlockedContext,
  buildWaitingContext,
  categorizeEmployeeTask,
  type DepSibling,
} from "@/lib/services/action-center";
import { reconcileEmployeeTasksReadiness } from "@/lib/services/task-readiness";

const taskInclude = {
  design: { select: { id: true, ideaRef: true, collectionName: true } },
  process: true,
  subProcess: true,
  assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
  timeEvents: { orderBy: { eventTimeUtc: "asc" as const } },
};

export type ActionCenterWaitingItem = {
  taskId: string;
  design: { id: string; ideaRef: string; collectionName: string };
  myStage: string;
  myStatus: string;
  waitingFor: string;
  nextAction: string;
  nextTaskId?: string;
};

export type ActionCenterBlockedItem = {
  taskId: string;
  design: { id: string; ideaRef: string; collectionName: string };
  stage: string;
  status: string;
  blockedBy: string;
  blockedOwner?: string;
  blockedMessage: string;
};

export type ActionCenterResponse = {
  actionRequired: Awaited<ReturnType<typeof prisma.designTask.findMany>>;
  waitingForOthers: ActionCenterWaitingItem[];
  blocked: ActionCenterBlockedItem[];
  upcoming: Awaited<ReturnType<typeof prisma.designTask.findMany>>;
  completed: Awaited<ReturnType<typeof prisma.designTask.findMany>>;
};

function toDepSibling(
  t: {
    id: bigint;
    dependencySequence: number | null;
    sequence: number;
    status: string;
    assignedEmployeeId: number | null;
    subProcess: { name: string; code: string; isApproval: boolean } | null;
    assignedEmployee: { name: string } | null;
  },
): DepSibling {
  return {
    id: t.id.toString(),
    dependencySequence: t.dependencySequence,
    sequence: t.sequence,
    status: t.status,
    assignedEmployeeId: t.assignedEmployeeId,
    subProcess: t.subProcess,
    assignedEmployee: t.assignedEmployee,
  };
}

export async function getActionCenter(employeeId: number): Promise<ActionCenterResponse> {
  await reconcileEmployeeTasksReadiness(employeeId, `action-center-${employeeId}`);

  const myTasks = await prisma.designTask.findMany({
    where: {
      assignedEmployeeId: employeeId,
      status: { not: "CANCELLED" },
    },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
    include: taskInclude,
  });

  const designIds = [...new Set(myTasks.map((t) => t.designId))];
  const designTasks =
    designIds.length === 0
      ? []
      : await prisma.designTask.findMany({
          where: { designId: { in: designIds } },
          select: {
            id: true,
            designId: true,
            dependencySequence: true,
            sequence: true,
            status: true,
            assignedEmployeeId: true,
            subProcess: { select: { name: true, code: true, isApproval: true } },
            assignedEmployee: { select: { name: true } },
          },
          orderBy: { sequence: "asc" },
        });

  const siblingsByDesign = new Map<string, DepSibling[]>();
  for (const t of designTasks) {
    const key = t.designId.toString();
    const list = siblingsByDesign.get(key) ?? [];
    list.push(toDepSibling(t));
    siblingsByDesign.set(key, list);
  }

  const actionRequired: typeof myTasks = [];
  const waitingForOthers: ActionCenterWaitingItem[] = [];
  const blocked: ActionCenterBlockedItem[] = [];
  const upcoming: typeof myTasks = [];
  const completed: typeof myTasks = [];

  for (const task of myTasks) {
    const siblings = siblingsByDesign.get(task.designId.toString()) ?? [];
    const row = {
      id: task.id.toString(),
      status: task.status,
      dependencySequence: task.dependencySequence,
      sequence: task.sequence,
      subProcess: task.subProcess,
      assignedEmployeeId: task.assignedEmployeeId,
    };

    const bucket = categorizeEmployeeTask(row, siblings);
    const designRef = {
      id: task.design.id.toString(),
      ideaRef: task.design.ideaRef,
      collectionName: task.design.collectionName,
    };

    switch (bucket) {
      case "actionRequired":
        actionRequired.push(task);
        break;
      case "waitingForOthers": {
        const ctx = buildWaitingContext(row, siblings, employeeId);
        waitingForOthers.push({
          taskId: task.id.toString(),
          design: designRef,
          myStage: task.subProcess.name,
          myStatus: task.status,
          waitingFor: ctx.waitingFor,
          nextAction: ctx.nextAction,
          nextTaskId: ctx.nextTaskId,
        });
        break;
      }
      case "blocked": {
        const ctx = buildBlockedContext(row, siblings);
        blocked.push({
          taskId: task.id.toString(),
          design: designRef,
          stage: task.subProcess.name,
          status: task.status,
          blockedBy: ctx.blockedBy,
          blockedOwner: ctx.blockedOwner,
          blockedMessage: ctx.blockedMessage,
        });
        break;
      }
      case "upcoming":
        upcoming.push(task);
        break;
      case "completed":
        completed.push(task);
        break;
    }
  }

  const completedRecent = completed
    .sort((a, b) => {
      const aTime = a.completedAt?.getTime() ?? 0;
      const bTime = b.completedAt?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 20);

  return {
    actionRequired,
    waitingForOthers,
    blocked,
    upcoming,
    completed: completedRecent,
  };
}
