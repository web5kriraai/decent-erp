import { prisma } from "@/lib/db";
import {
  buildBlockedContext,
  buildWaitingContext,
  categorizeEmployeeTask,
  type DepSibling,
} from "@/lib/services/action-center";
import { enrichActionCenterTaskList } from "@/lib/services/action-center-enrichment";
import { reconcileEmployeeTasksReadiness } from "@/lib/services/task-readiness";
import { sortTasksByEffectivePriority } from "@/lib/task-priority";

const taskInclude = {
  design: { select: { id: true, ideaRef: true, collectionName: true, priority: true } },
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

export type ActionCenterTask = Awaited<ReturnType<typeof prisma.designTask.findMany>>[number] & {
  canStart?: boolean;
  startBlockedReason?: string;
};

export type ActionCenterResponse = {
  actionRequired: ActionCenterTask[];
  waitingForOthers: ActionCenterWaitingItem[];
  blocked: ActionCenterBlockedItem[];
  upcoming: ActionCenterTask[];
  completed: ActionCenterTask[];
};

export type TeamPipelineDependencyItem = ActionCenterWaitingItem & {
  employeeId: number;
  employeeName: string;
  employeeCode: string;
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
        // Personal view: fold into Upcoming or Completed (supervisors use Pipeline Dependencies).
        if (task.status === "COMPLETED") {
          completed.push(task);
        } else {
          upcoming.push(task);
        }
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

  const runningTask = actionRequired.find((t) => t.status === "RUNNING") ?? null;

  return {
    actionRequired: enrichActionCenterTaskList(actionRequired, siblingsByDesign, runningTask?.id ?? null),
    waitingForOthers: [],
    blocked,
    upcoming: enrichActionCenterTaskList(upcoming, siblingsByDesign, runningTask?.id ?? null),
    completed: sortTasksByEffectivePriority(
      completedRecent.map((task) => ({
        ...task,
        canStart: false,
        startBlockedReason: undefined,
      })),
    ),
  };
}

async function buildWaitingForOthersItems(employeeId: number): Promise<ActionCenterWaitingItem[]> {
  await reconcileEmployeeTasksReadiness(employeeId, `pipeline-deps-${employeeId}`);

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

  const waitingForOthers: ActionCenterWaitingItem[] = [];

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

    if (categorizeEmployeeTask(row, siblings) !== "waitingForOthers") continue;

    const ctx = buildWaitingContext(row, siblings, employeeId);
    waitingForOthers.push({
      taskId: task.id.toString(),
      design: {
        id: task.design.id.toString(),
        ideaRef: task.design.ideaRef,
        collectionName: task.design.collectionName,
      },
      myStage: task.subProcess.name,
      myStatus: task.status,
      waitingFor: ctx.waitingFor,
      nextAction: ctx.nextAction,
      nextTaskId: ctx.nextTaskId,
    });
  }

  return waitingForOthers;
}

export async function getTeamPipelineDependencies(): Promise<TeamPipelineDependencyItem[]> {
  const employees = await prisma.employee.findMany({
    where: {
      active: true,
      assignedTasks: {
        some: {
          status: { notIn: ["CANCELLED", "COMPLETED"] },
          assignedEmployeeId: { not: null },
        },
      },
    },
    select: { id: true, name: true, employeeCode: true },
    orderBy: { name: "asc" },
  });

  const results: TeamPipelineDependencyItem[] = [];
  for (const employee of employees) {
    const items = await buildWaitingForOthersItems(employee.id);
    for (const item of items) {
      results.push({
        ...item,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
      });
    }
  }

  return results.sort(
    (a, b) =>
      a.design.ideaRef.localeCompare(b.design.ideaRef) ||
      a.employeeName.localeCompare(b.employeeName),
  );
}
