import { prisma } from "@/lib/db";
import {
  buildBlockedContext,
  buildWaitingContext,
  categorizeEmployeeTask,
  foldWaitingTaskToPersonalBucket,
  type DepSibling,
} from "@/lib/services/action-center";
import { enrichActionCenterTaskList, enrichActionCenterHistoricalList } from "@/lib/services/action-center-enrichment";
import { reconcileEmployeeTasksReadiness } from "@/lib/services/task-readiness";
import { resolveEffectiveTaskStatus } from "@/lib/services/workflow-stage-gate";
import {
  compareTasksByAssignmentThenPriority,
  resolveEffectiveTaskPriority,
} from "@/lib/task-priority";
import { clampKanbanPageSize } from "@/lib/workflow-lanes";
import { startOfUtcDay } from "@/lib/services/time-calculation";

const BOARD_LANES = ["READY", "CORRECTION_REQUIRED", "RUNNING", "ON_HOLD"] as const;
type BoardLane = (typeof BOARD_LANES)[number];

const taskInclude = {
  design: {
    select: {
      id: true,
      ideaRef: true,
      collectionName: true,
      priority: true,
      createdAtUtc: true,
      productType: { select: { name: true, code: true } },
      images: {
        where: { mediaKind: "IMAGE" as const },
        orderBy: [{ isPrimary: "desc" as const }, { uploadedAtUtc: "desc" as const }],
        take: 1,
        select: { storageKey: true },
      },
    },
  },
  process: true,
  subProcess: {
    include: { defaultRole: { select: { id: true, code: true, name: true } } },
  },
  assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
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
  priority?: string;
  designPriority?: string | null;
  blockedBy: string;
  blockedOwner?: string;
  blockedMessage: string;
};

export type ActionCenterTask = Awaited<ReturnType<typeof prisma.designTask.findMany>>[number] & {
  canStart?: boolean;
  startBlockedReason?: string;
  effectiveStatus?: string;
  isWaitingOnOthers?: boolean;
  waitingOnStage?: string | null;
  waitingOnAssignee?: string | null;
};

export type ActionCenterQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  priority?: string;
  stage?: string;
};

export type ActionCenterResponse = {
  actionRequired: ActionCenterTask[];
  /** Running or held task, even when it is not on the current page. */
  activeTimerTask: ActionCenterTask | null;
  waitingForOthers: ActionCenterWaitingItem[];
  blocked: ActionCenterBlockedItem[];
  upcoming: ActionCenterTask[];
  completed: ActionCenterTask[];
  stages: string[];
  laneCounts: Record<BoardLane, number>;
  totals: { actionRequired: number; blocked: number; upcoming: number; completed: number };
  tabTotals: { actionRequired: number; blocked: number; upcoming: number; completed: number };
  pagination: { page: number; pageSize: number; total: number };
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

function boardLane(status: string): BoardLane | null {
  if (status === "ASSIGNED" || status === "PENDING") return "READY";
  if (status === "CORRECTION_REQUIRED") return "CORRECTION_REQUIRED";
  if (status === "RUNNING") return "RUNNING";
  if (status === "ON_HOLD") return "ON_HOLD";
  return null;
}

function matchesQuery(
  task: {
    priority: string;
    subProcess: { name: string };
    design: { ideaRef: string; collectionName: string; priority?: string | null };
  },
  query: ActionCenterQuery,
): boolean {
  if (query.priority && query.priority !== "ALL") {
    const effective = resolveEffectiveTaskPriority(task.priority, task.design.priority);
    if (effective !== query.priority) return false;
  }
  if (query.stage && query.stage !== "ALL" && task.subProcess.name !== query.stage) return false;
  const q = query.q?.trim().toLowerCase();
  if (q) {
    const hay = `${task.design.ideaRef} ${task.design.collectionName} ${task.subProcess.name}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function pageSlice<T>(rows: T[], page: number, pageSize: number): T[] {
  if (rows.length <= pageSize) return rows;
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

async function attachPageImages(
  tasks: Array<{ design: { images?: { storageKey: string }[]; primaryImageUrl?: string | null } }>,
) {
  const { getPresignedDownloadUrl } = await import("@/lib/storage");
  await Promise.all(
    tasks.map(async (task) => {
      const key = task.design.images?.[0]?.storageKey;
      if (!key) {
        task.design.primaryImageUrl = null;
      } else {
        try {
          task.design.primaryImageUrl = await getPresignedDownloadUrl(key);
        } catch {
          task.design.primaryImageUrl = null;
        }
      }
      delete task.design.images;
    }),
  );
}

export async function getActionCenter(
  employeeId: number,
  query: ActionCenterQuery = {},
): Promise<ActionCenterResponse> {
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
        // Personal view: fold into Upcoming or Completed using effectiveStatus (not raw status).
        if (foldWaitingTaskToPersonalBucket(row, siblings) === "completed") {
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
          priority: task.priority,
          designPriority: task.design.priority ?? null,
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

  const completedSorted = completed.sort((a, b) => {
    const aTime = a.completedAt?.getTime() ?? 0;
    const bTime = b.completedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  const runningTask = actionRequired.find((t) => t.status === "RUNNING") ?? null;
  const activeTimerTask =
    runningTask ?? actionRequired.find((t) => t.status === "ON_HOLD") ?? null;

  const enrichedRequired = enrichActionCenterTaskList(
    actionRequired,
    siblingsByDesign,
    runningTask?.id ?? null,
  );
  const enrichedUpcoming = enrichActionCenterHistoricalList(upcoming, siblingsByDesign);
  const enrichedCompleted = enrichActionCenterHistoricalList(completedSorted, siblingsByDesign).map(
    (task) => ({
      ...task,
      canStart: false,
      startBlockedReason: undefined,
    }),
  );

  const stages = [
    ...new Set(
      [...enrichedRequired, ...enrichedUpcoming, ...enrichedCompleted, ...blocked.map((item) => ({
        subProcess: { name: item.stage },
      }))].map((task) => task.subProcess.name),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const filteredRequired = enrichedRequired.filter((task) => matchesQuery(task, query));
  const filteredUpcoming = enrichedUpcoming.filter((task) => matchesQuery(task, query));
  const filteredCompleted = enrichedCompleted.filter((task) => matchesQuery(task, query));
  const filteredBlocked = blocked.filter((item) =>
    matchesQuery(
      {
        priority: item.priority ?? "MEDIUM",
        subProcess: { name: item.stage },
        design: {
          ideaRef: item.design.ideaRef,
          collectionName: item.design.collectionName,
          priority: item.designPriority,
        },
      },
      query,
    ),
  );

  const lanes = Object.fromEntries(BOARD_LANES.map((lane) => [lane, [] as typeof filteredRequired])) as Record<
    BoardLane,
    typeof filteredRequired
  >;
  for (const task of filteredRequired) {
    const lane = boardLane(task.status);
    if (lane) lanes[lane].push(task);
  }
  for (const lane of BOARD_LANES) {
    lanes[lane].sort(compareTasksByAssignmentThenPriority);
  }

  const laneCounts = Object.fromEntries(
    BOARD_LANES.map((lane) => [lane, lanes[lane].length]),
  ) as Record<BoardLane, number>;
  const fullest = Math.max(0, ...BOARD_LANES.map((lane) => lanes[lane].length));
  const pageSize = clampKanbanPageSize(query.pageSize ?? 10);
  const pageCount = Math.max(1, Math.ceil(fullest / pageSize) || 1);
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);

  const pageRequired = BOARD_LANES.flatMap((lane) => pageSlice(lanes[lane], page, pageSize));
  const pageBlocked = pageSlice(filteredBlocked, page, pageSize);
  const pageUpcoming = pageSlice(filteredUpcoming, page, pageSize);
  const pageCompleted = pageSlice(filteredCompleted, page, pageSize);

  const imageTasks: Array<{
    id: bigint;
    design: { images?: { storageKey: string }[]; primaryImageUrl?: string | null };
  }> = [...pageRequired, ...pageUpcoming, ...pageCompleted];
  if (activeTimerTask && !imageTasks.some((task) => task.id === activeTimerTask.id)) {
    imageTasks.push(activeTimerTask);
  }
  await attachPageImages(imageTasks);

  return {
    actionRequired: pageRequired,
    activeTimerTask,
    waitingForOthers: [],
    blocked: pageBlocked,
    upcoming: pageUpcoming,
    completed: pageCompleted,
    stages,
    laneCounts,
    totals: {
      actionRequired: actionRequired.length,
      blocked: blocked.length,
      upcoming: upcoming.length,
      completed: completed.length,
    },
    tabTotals: {
      actionRequired: filteredRequired.length,
      blocked: filteredBlocked.length,
      upcoming: filteredUpcoming.length,
      completed: filteredCompleted.length,
    },
    pagination: { page, pageSize, total: fullest },
  };
}

async function buildWaitingForOthersItems(employeeId: number): Promise<ActionCenterWaitingItem[]> {
  await reconcileEmployeeTasksReadiness(employeeId, `pipeline-deps-${employeeId}`);

  const myTasks = await prisma.designTask.findMany({
    where: {
      assignedEmployeeId: employeeId,
      status: { not: "CANCELLED" },
    },
    workdayClosed: !!workdaySession,
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
      myStatus: resolveEffectiveTaskStatus(row, siblings),
      waitingFor: ctx.waitingFor,
      nextAction: ctx.nextAction,
      nextTaskId: ctx.nextTaskId,
    });
  }

  return waitingForOthers;
}

