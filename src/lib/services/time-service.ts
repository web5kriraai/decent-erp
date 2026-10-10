import { prisma } from "@/lib/db";
import { publishRealtime } from "@/lib/realtime";
import { writeAuditLogDirect } from "@/lib/audit";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { createAppError, notFound, conflict } from "@/lib/errors/create-app-error";
import { PERMISSIONS } from "@/lib/permissions";
import {
  computeTimeSummary,
  endOfUtcDay,
  startOfUtcDay,
  type TimeEventRecord,
} from "@/lib/services/time-calculation";
import { MY_TASKS_VISIBLE_STATUSES } from "@/lib/services/task-dependency";
import { buildBlockedContext } from "@/lib/services/action-center";
import { getTaskStartAvailability } from "@/lib/action-availability";
import { reconcileTaskReadiness } from "@/lib/services/task-readiness";
import { decideWorkTaskAccess } from "@/lib/task-access";
import {
  resolveEffectiveTaskStatus,
  type StageGateSibling,
} from "@/lib/services/workflow-stage-gate";

const taskTimeInclude = {
  design: {
    select: {
      id: true,
      companyId: true,
      ideaRef: true,
      designNumber: true,
      collectionName: true,
      styleName: true,
      conceptNote: true,
      workType: true,
      trendReference: true,
      celebrityReference: true,
      priority: true,
      status: true,
      currentStage: true,
      targetEndDate: true,
      productType: { select: { name: true, code: true } },
      season: { select: { name: true } },
      designHead: { select: { name: true } },
      location: { select: { name: true } },
      fabric: { select: { name: true } },
      machine: { select: { name: true } },
      stitchingType: { select: { name: true } },
      designGrade: { select: { name: true } },
      images: {
        where: { mediaKind: "IMAGE", designComponentId: null },
        orderBy: [{ isPrimary: "desc" as const }, { uploadedAtUtc: "desc" as const }],
        take: 8,
        select: { id: true, fileName: true, storageKey: true, isPrimary: true },
      },
      components: {
        where: { active: true },
        orderBy: { sequence: "asc" as const },
        select: {
          id: true,
          specification: true,
          componentType: { select: { name: true } },
          images: {
            where: { mediaKind: "IMAGE" },
            orderBy: { uploadedAtUtc: "asc" as const },
            select: { id: true, fileName: true, storageKey: true },
          },
        },
      },
    },
  },
  process: { select: { id: true, name: true, code: true } },
  subProcess: { select: { id: true, name: true, code: true, isFileRequired: true, isApproval: true, capabilities: true, defaultRole: { select: { id: true, code: true, name: true } } } },
  assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
  timeEvents: {
    orderBy: { eventTimeUtc: "asc" as const },
    include: { holdReason: { select: { id: true, code: true, name: true, excludeFromActiveTime: true } } },
  },
};

function mapEvents(
  events: Array<{
    eventType: string;
    eventTimeUtc: Date;
    holdReasonId: number | null;
    holdReason: { code: string; name: string; excludeFromActiveTime: boolean } | null;
  }>,
): TimeEventRecord[] {
  return events.map((e) => ({
    eventType: e.eventType,
    eventTimeUtc: e.eventTimeUtc,
    holdReasonId: e.holdReasonId,
    holdReason: e.holdReason,
  }));
}

export async function getEmployeeTimeSummary(employeeId: number, date = new Date()) {
  const dayStart = startOfUtcDay(date);
  const dayEnd = endOfUtcDay(date);
  const now = new Date();

  const [tasks, workdayClosed, runningTask] = await Promise.all([
    prisma.designTask.findMany({
      where: {
        assignedEmployeeId: employeeId,
        timeEvents: { some: { eventTimeUtc: { gte: dayStart, lte: dayEnd } } },
      },
      include: {
        design: { select: { id: true, ideaRef: true } },
        subProcess: { select: { name: true } },
        timeEvents: {
          where: { eventTimeUtc: { gte: dayStart, lte: now } },
          orderBy: { eventTimeUtc: "asc" },
          include: { holdReason: { select: { code: true, name: true, excludeFromActiveTime: true } } },
        },
      },
    }),
    prisma.workdaySession.findUnique({
      where: { employeeId_workDate: { employeeId, workDate: dayStart } },
    }),
    prisma.designTask.findFirst({
      where: { assignedEmployeeId: employeeId, status: { in: ["RUNNING", "ON_HOLD"] } },
      include: {
        design: { select: { ideaRef: true } },
        subProcess: { select: { name: true } },
        timeEvents: {
          orderBy: { eventTimeUtc: "asc" },
          include: { holdReason: { select: { code: true, name: true, excludeFromActiveTime: true } } },
        },
      },
    }),
  ]);

  let totalActiveSeconds = 0;
  let totalHoldSeconds = 0;
  const holdReasonTotals = new Map<string, { name: string; seconds: number }>();

  const taskSummaries = tasks.map((task) => {
    const summary = computeTimeSummary(mapEvents(task.timeEvents), now);
    totalActiveSeconds += summary.activeSeconds;
    totalHoldSeconds += summary.holdSeconds;
    for (const h of summary.holdByReason) {
      const existing = holdReasonTotals.get(h.code) ?? { name: h.name, seconds: 0 };
      existing.seconds += h.seconds;
      holdReasonTotals.set(h.code, existing);
    }
    return {
      taskId: task.id.toString(),
      ideaRef: task.design.ideaRef,
      subProcessName: task.subProcess.name,
      status: task.status,
      expectedMinutes: task.expectedMinutes,
      ...summary,
    };
  });

  const overdueCount = await prisma.designTask.count({
    where: {
      assignedEmployeeId: employeeId,
      status: { in: [...MY_TASKS_VISIBLE_STATUSES] },
      dueAt: { lt: now },
    },
  });

  const openCount = await prisma.designTask.count({
    where: {
      assignedEmployeeId: employeeId,
      status: { in: [...MY_TASKS_VISIBLE_STATUSES] },
    },
  });

  return {
    date: dayStart.toISOString().slice(0, 10),
    workdayClosed: !!workdayClosed,
    workdayClosedAt: workdayClosed?.closedAtUtc.toISOString() ?? null,
    totals: {
      activeSeconds: totalActiveSeconds,
      holdSeconds: totalHoldSeconds,
      openTasks: openCount,
      overdueTasks: overdueCount,
      holdByReason: [...holdReasonTotals.entries()]
        .map(([code, { name, seconds }]) => ({ code, name, seconds }))
        .sort((a, b) => b.seconds - a.seconds),
    },
    currentTask: runningTask
      ? {
          taskId: runningTask.id.toString(),
          ideaRef: runningTask.design.ideaRef,
          subProcessName: runningTask.subProcess.name,
          status: runningTask.status,
          ...computeTimeSummary(mapEvents(runningTask.timeEvents), now),
        }
      : null,
    tasksToday: taskSummaries,
  };
}

export async function getLiveTeamTimeStatus() {
  const now = new Date();
  const activeTasks = await prisma.designTask.findMany({
    where: { status: { in: ["RUNNING", "ON_HOLD"] }, assignedEmployeeId: { not: null } },
    include: {
      design: { select: { ideaRef: true, collectionName: true } },
      process: { select: { name: true } },
      subProcess: { select: { name: true } },
      assignedEmployee: {
        select: { id: true, name: true, employeeCode: true, role: { select: { code: true, name: true } } },
      },
      timeEvents: {
        orderBy: { eventTimeUtc: "asc" },
        include: { holdReason: { select: { code: true, name: true, excludeFromActiveTime: true } } },
      },
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });

  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      role: { select: { code: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const activeByEmployee = new Map(
    activeTasks.map((t) => [t.assignedEmployeeId!, t]),
  );

  return {
    asOfUtc: now.toISOString(),
    runningCount: activeTasks.filter((t) => t.status === "RUNNING").length,
    onHoldCount: activeTasks.filter((t) => t.status === "ON_HOLD").length,
    employees: employees.map((emp) => {
      const task = activeByEmployee.get(emp.id);
      if (!task) {
        return {
          employeeId: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode,
          role: emp.role,
          status: "IDLE" as const,
          task: null,
        };
      }
      const summary = computeTimeSummary(mapEvents(task.timeEvents), now);
      return {
        employeeId: emp.id,
        name: emp.name,
        employeeCode: emp.employeeCode,
        role: emp.role,
        status: task.status as "RUNNING" | "ON_HOLD",
        task: {
          taskId: task.id.toString(),
          ideaRef: task.design.ideaRef,
          collectionName: task.design.collectionName,
          processName: task.process.name,
          subProcessName: task.subProcess.name,
          dueAt: task.dueAt?.toISOString() ?? null,
          expectedMinutes: task.expectedMinutes,
          ...summary,
        },
      };
    }),
  };
}

export async function getEmployeeTimeReport(from: Date, to: Date, employeeId?: number) {
  const rangeStart = startOfUtcDay(from);
  const rangeEnd = endOfUtcDay(to);
  const now = new Date();

  const employees = await prisma.employee.findMany({
    where: { active: true, ...(employeeId ? { id: employeeId } : {}) },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      role: { select: { code: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    employees.map(async (emp) => {
      const events = await prisma.taskTimeEvent.findMany({
        where: {
          employeeId: emp.id,
          eventTimeUtc: { gte: rangeStart, lte: rangeEnd },
        },
        include: { holdReason: { select: { code: true, name: true, excludeFromActiveTime: true } } },
        orderBy: { eventTimeUtc: "asc" },
      });

      const summary = computeTimeSummary(mapEvents(events), now);
      const tasksWorked = new Set(events.map((e) => e.taskId.toString())).size;
      const completedInRange = await prisma.designTask.count({
        where: {
          assignedEmployeeId: emp.id,
          status: "COMPLETED",
          completedAt: { gte: rangeStart, lte: rangeEnd },
        },
      });

      const workdaysClosed = await prisma.workdaySession.count({
        where: {
          employeeId: emp.id,
          workDate: { gte: rangeStart, lte: rangeEnd },
        },
      });

      return {
        employeeId: emp.id,
        name: emp.name,
        employeeCode: emp.employeeCode,
        role: emp.role,
        tasksWorked,
        tasksCompleted: completedInRange,
        workdaysClosed,
        ...summary,
      };
    }),
  );

  return { from: rangeStart.toISOString().slice(0, 10), to: rangeEnd.toISOString().slice(0, 10), rows };
}

async function signedDownloadUrl(storageKey: string | null | undefined): Promise<string | null> {
  if (!storageKey) return null;
  try {
    const { getPresignedDownloadUrl } = await import("@/lib/storage");
    return await getPresignedDownloadUrl(storageKey);
  } catch {
    return null;
  }
}

function inferArtifactContentType(fileName: string | null, contentType: string | null): string | null {
  if (contentType && contentType !== "application/octet-stream") return contentType;
  const ext = fileName?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "pdf":
      return "application/pdf";
    default:
      return contentType;
  }
}

function priorWorkFileFallback(artifactType: string): string {
  if (artifactType === "PUNCHING_FILE") return "Punching file";
  if (artifactType === "SAMPLE_OUTPUT") return "Sample file";
  return "Sketch file";
}

/**
 * Files submitted on earlier stages of the same design.
 * Each later role sees sketch, punching, and sample files already turned in.
 * Signed URLs only - no storage keys.
 */
async function loadPriorWorkFiles(designId: bigint, taskId: bigint, sequence: number) {
  const artifacts = await prisma.taskArtifact.findMany({
    where: {
      storageKey: { not: null },
      artifactType: { in: ["SKETCH_VERSION", "PUNCHING_FILE", "SAMPLE_OUTPUT"] },
      task: {
        designId,
        id: { not: taskId },
        sequence: { lt: sequence },
      },
    },
    orderBy: [{ task: { sequence: "asc" } }, { uploadedAtUtc: "asc" }],
    select: {
      id: true,
      artifactType: true,
      fileName: true,
      contentType: true,
      storageKey: true,
      uploadedAtUtc: true,
      uploadedBy: { select: { name: true } },
      task: {
        select: {
          subProcess: { select: { code: true, name: true } },
        },
      },
    },
  });

  return Promise.all(
    artifacts.map(async (artifact) => ({
      id: artifact.id.toString(),
      fileName: artifact.fileName?.trim() || priorWorkFileFallback(artifact.artifactType),
      contentType: inferArtifactContentType(artifact.fileName, artifact.contentType),
      downloadUrl: await signedDownloadUrl(artifact.storageKey),
      uploadedAtUtc: artifact.uploadedAtUtc.toISOString(),
      uploadedByName: artifact.uploadedBy.name,
      stageName: artifact.task.subProcess.name,
      stageCode: artifact.task.subProcess.code,
      artifactType: artifact.artifactType,
    })),
  );
}

async function loadPriorPunchingDetails(designId: bigint, taskId: bigint, sequence: number) {
  const artifact = await prisma.taskArtifact.findFirst({
    where: {
      artifactType: "PUNCHING_FILE",
      task: {
        designId,
        id: { not: taskId },
        sequence: { lt: sequence },
        subProcess: { code: "PUNCH" },
      },
      OR: [
        { stitchCount: { not: null } },
        { machineFormat: { not: null } },
        { needleCount: { not: null } },
        { colorCount: { not: null } },
        { hoopSize: { not: null } },
        { softwareName: { not: null } },
        { stitchDensity: { not: null } },
      ],
    },
    orderBy: { uploadedAtUtc: "desc" },
    select: {
      stitchCount: true,
      machineFormat: true,
      needleCount: true,
      colorCount: true,
      hoopSize: true,
      softwareName: true,
      stitchDensity: true,
      uploadedBy: { select: { name: true } },
    },
  });
  if (!artifact) return null;
  const density = artifact.stitchDensity?.toString() ?? null;
  return {
    stitchCount: artifact.stitchCount,
    machineFormat: artifact.machineFormat,
    needleCount: artifact.needleCount,
    colorCount: artifact.colorCount,
    hoopSize: artifact.hoopSize,
    softwareName: artifact.softwareName,
    stitchDensity: density?.includes(".")
      ? density.replace(/0+$/, "").replace(/\.$/, "")
      : density,
    recordedByName: artifact.uploadedBy.name,
  };
}

async function materialFabricLabel(designId: bigint) {
  const lines = await prisma.designMaterialLine.findMany({
    where: {
      designId,
      catalogItem: { masterType: "FABRIC_QUALITY" },
    },
    include: { catalogItem: { select: { name: true } } },
    orderBy: { createdAtUtc: "asc" },
  });
  const labels = lines
    .map((line) => {
      const name = line.catalogItem.name?.trim();
      if (!name) return null;
      const qty = String(line.quantity);
      return line.unit?.trim() ? `${name} · ${qty} ${line.unit.trim()}` : name;
    })
    .filter((label): label is string => !!label);
  return labels.length > 0 ? labels.join(", ") : null;
}

async function presentTaskDesign(design: {
  id: bigint;
  ideaRef: string;
  designNumber: string | null;
  collectionName: string;
  styleName: string | null;
  conceptNote: string | null;
  workType: string | null;
  trendReference: string | null;
  celebrityReference: string | null;
  priority: string;
  status: string;
  currentStage: string | null;
  targetEndDate: Date | null;
  productType: { name: string } | null;
  season: { name: string } | null;
  designHead: { name: string } | null;
  location: { name: string } | null;
  fabric: { name: string } | null;
  machine: { name: string } | null;
  stitchingType: { name: string } | null;
  designGrade: { name: string } | null;
  images: Array<{ fileName: string; storageKey: string }>;
  components: Array<{
    id: bigint;
    specification: string | null;
    componentType: { name: string };
    images: Array<{ id: bigint; fileName: string; storageKey: string }>;
  }>;
}) {
  const primary = design.images[0];
  const components = await Promise.all(
    design.components.map(async (component) => ({
      id: component.id.toString(),
      name: component.componentType.name,
      specification: component.specification,
      images: (
        await Promise.all(
          component.images.map(async (image) => ({
            id: image.id.toString(),
            fileName: image.fileName,
            downloadUrl: await signedDownloadUrl(image.storageKey),
          })),
        )
      ).filter((image) => image.downloadUrl),
    })),
  );

  return {
    id: design.id.toString(),
    ideaRef: design.ideaRef,
    designNumber: design.designNumber,
    collectionName: design.collectionName,
    styleName: design.styleName,
    conceptNote: design.conceptNote,
    workType: design.workType,
    trendReference: design.trendReference,
    celebrityReference: design.celebrityReference,
    priority: design.priority,
    status: design.status,
    currentStage: design.currentStage,
    targetEndDate: design.targetEndDate?.toISOString() ?? null,
    productType: design.productType?.name ?? null,
    season: design.season?.name ?? null,
    designHead: design.designHead?.name ?? null,
    location: design.location?.name ?? null,
    fabric: design.fabric?.name ?? null,
    machine: design.machine?.name ?? null,
    stitchingType: design.stitchingType?.name ?? null,
    materialFabric: await materialFabricLabel(design.id),
    designGrade: design.designGrade?.name ?? null,
    primaryImageUrl: await signedDownloadUrl(primary?.storageKey),
    primaryImageName: primary?.fileName ?? null,
    components,
  };
}

export async function getTaskTimeDetail(
  taskId: bigint,
  viewerEmployeeId: number,
  viewerPermissions: string[],
  viewerCompanyId: number,
  correlationId = "task-detail",
) {
  let task = await prisma.designTask.findUnique({
    where: { id: taskId },
    include: taskTimeInclude,
  });

  if (!task) throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);

  const access = decideWorkTaskAccess({
    permissions: viewerPermissions,
    employeeId: viewerEmployeeId,
    companyId: viewerCompanyId,
    taskCompanyId: task.design.companyId,
    assignedEmployeeId: task.assignedEmployeeId,
  });
  if (access === "hidden") throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);
  if (access === "forbidden") {
    throw createAppError(APP_ERROR_CODES.PERMISSION_DENIED, 403);
  }
  if (access === "not-assigned") {
    throw createAppError(APP_ERROR_CODES.TASK_NOT_ASSIGNED, 403);
  }

  if (viewerPermissions.includes(PERMISSIONS.TASK_EXECUTE)) {
    await reconcileTaskReadiness(taskId, viewerEmployeeId, correlationId);
  }

  if (
    task.subProcess.code === "PROD_RELEASE" ||
    task.subProcess.code === "LIVE_REVIEW"
  ) {
    const { healStuckProdReleaseChecking } = await import(
      "@/lib/services/production-service"
    );
    await healStuckProdReleaseChecking(
      task.designId,
      viewerEmployeeId,
      `${correlationId}-heal-prod-release`,
    );
  }

  task = await prisma.designTask.findUnique({
    where: { id: taskId },
    include: taskTimeInclude,
  });
  if (!task) throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);

  const isAssignee = true;

  const peerTasks = await prisma.designTask.findMany({
    where: { designId: task.designId },
    orderBy: [{ sequence: "asc" }],
    select: {
      id: true,
      sequence: true,
      dependencySequence: true,
      status: true,
      assignedEmployeeId: true,
      outputRemark: true,
      dueAt: true,
      startedAt: true,
      updatedAtUtc: true,
      instructionNote: true,
      expectedMinutes: true,
      timeEvents: {
        orderBy: { eventTimeUtc: "asc" },
        select: {
          eventType: true,
          eventTimeUtc: true,
          holdReason: {
            select: { code: true, name: true, excludeFromActiveTime: true },
          },
        },
      },
      subProcess: {
        select: {
          name: true,
          code: true,
          isApproval: true,
          defaultRole: { select: { name: true } },
        },
      },
      assignedEmployee: { select: { name: true } },
    },
  });

  const [runningTask, workdaySession] = isAssignee
    ? await Promise.all([
        prisma.designTask.findFirst({
          where: { assignedEmployeeId: viewerEmployeeId, status: "RUNNING" },
          select: { id: true },
        }),
        prisma.workdaySession.findUnique({
          where: {
            employeeId_workDate: {
              employeeId: viewerEmployeeId,
              workDate: startOfUtcDay(new Date()),
            },
          },
          select: { closedAtUtc: true },
        }),
      ])
    : [null, null];

  const now = new Date();
  const summary = computeTimeSummary(mapEvents(task.timeEvents), now);

  const stageSiblings: StageGateSibling[] = peerTasks.map((peer) => ({
    id: peer.id.toString(),
    dependencySequence: peer.dependencySequence,
    sequence: peer.sequence,
    status: peer.status,
    assignedEmployeeId: peer.assignedEmployeeId,
    subProcess: {
      name: peer.subProcess.name,
      code: peer.subProcess.code,
      isApproval: peer.subProcess.isApproval,
    },
    assignedEmployee: peer.assignedEmployee,
  }));

  const effectiveStatus = resolveEffectiveTaskStatus(
    {
      id: task.id.toString(),
      dependencySequence: task.dependencySequence,
      sequence: task.sequence,
      status: task.status,
      subProcess: task.subProcess,
    },
    stageSiblings,
  );

  const workflowPeers = peerTasks.map((peer) => {
    const peerTime = computeTimeSummary(peer.timeEvents, now);
    return {
      id: peer.id.toString(),
      sequence: peer.sequence,
      dependencySequence: peer.dependencySequence,
      status: peer.status,
      assignedEmployeeId: peer.assignedEmployeeId,
      outputRemark: peer.outputRemark,
      dueAt: peer.dueAt?.toISOString() ?? null,
      startedAt: peer.startedAt?.toISOString() ?? null,
      updatedAtUtc: peer.updatedAtUtc.toISOString(),
      instructionNote: peer.instructionNote,
      expectedMinutes: peer.expectedMinutes,
      activeSeconds: peerTime.activeSeconds,
      holdSeconds: peerTime.holdSeconds,
      subProcess: {
        name: peer.subProcess.name,
        code: peer.subProcess.code,
        isApproval: peer.subProcess.isApproval,
        defaultRole: peer.subProcess.defaultRole,
      },
      assignedEmployee: peer.assignedEmployee,
    };
  });

  const taskRow = {
    id: task.id.toString(),
    status: task.status,
    dependencySequence: task.dependencySequence,
    sequence: task.sequence,
    assignedEmployeeId: task.assignedEmployeeId,
  };

  const startAvailability = isAssignee
    ? getTaskStartAvailability(taskRow, workflowPeers, {
        hasRunningTask: runningTask != null && runningTask.id !== task.id,
      })
    : { available: false as const };

  const blockedContext =
    isAssignee && !startAvailability.available && ["PENDING", "ASSIGNED"].includes(task.status)
      ? buildBlockedContext(taskRow, workflowPeers)
      : null;

  return {
    id: task.id.toString(),
    designId: task.designId.toString(),
    status: task.status,
    effectiveStatus,
    sequence: task.sequence,
    dependencySequence: task.dependencySequence,
    priority: task.priority,
    expectedMinutes: task.expectedMinutes,
    version: task.version,
    outputRemark: task.outputRemark,
    instructionNote: task.instructionNote,
    dueAt: task.dueAt?.toISOString() ?? null,
    startedAt: task.startedAt?.toISOString() ?? null,
    updatedAtUtc: task.updatedAtUtc.toISOString(),
    assignedEmployeeId: task.assignedEmployeeId,
    design: await presentTaskDesign(task.design),
    process: task.process,
    subProcess: task.subProcess,
    assignedEmployee: task.assignedEmployee,
    timeSummary: summary,
    timeline: task.timeEvents.map((e) => ({
      id: e.id.toString(),
      eventType: e.eventType,
      eventTimeUtc: e.eventTimeUtc.toISOString(),
      holdReason: e.holdReason,
      remark: e.remark,
      employeeId: e.employeeId,
    })),
    workflowPeers,
    assigneeHasRunningTask:
      runningTask != null && runningTask.id !== task.id,
    canStart: startAvailability.available,
    startBlockedReason: startAvailability.reason,
    blockedMessage: blockedContext?.blockedMessage ?? null,
    priorWorkFiles: await loadPriorWorkFiles(task.designId, task.id, task.sequence),
    priorPunching: await loadPriorPunchingDetails(task.designId, task.id, task.sequence),
  };
}

export async function persistWorkdayClose(employeeId: number, correlationId: string) {
  const running = await prisma.designTask.findFirst({
    where: { assignedEmployeeId: employeeId, status: "RUNNING" },
  });
  if (running) {
    throw conflict(APP_ERROR_CODES.TASK_ALREADY_RUNNING, {
      taskId: running.id.toString(),
    }, "End your running task before closing the workday.");
  }

  const now = new Date();
  const workDate = startOfUtcDay(now);

  const existing = await prisma.workdaySession.findUnique({
    where: { employeeId_workDate: { employeeId, workDate } },
  });

  const session = await prisma.workdaySession.upsert({
    where: { employeeId_workDate: { employeeId, workDate } },
    update: { closedAtUtc: now, createdById: employeeId },
    create: { employeeId, workDate, closedAtUtc: now, createdById: employeeId },
  });

  await writeAuditLogDirect({
    entityType: "WorkdaySession",
    entityId: session.id.toString(),
    action: "CLOSE",
    userId: employeeId,
    correlationId,
    before: existing
      ? {
          employeeId: existing.employeeId,
          workDate: existing.workDate.toISOString().slice(0, 10),
          closedAtUtc: existing.closedAtUtc.toISOString(),
        }
      : null,
    after: {
      employeeId: session.employeeId,
      workDate: session.workDate.toISOString().slice(0, 10),
      closedAtUtc: session.closedAtUtc.toISOString(),
    },
  });

  // Stamp OFFICE_CLOSE on any ON_HOLD task timeline for audit (append-only)
  const onHoldTasks = await prisma.designTask.findMany({
    where: { assignedEmployeeId: employeeId, status: "ON_HOLD" },
    select: { id: true },
  });
  if (onHoldTasks.length > 0) {
    await prisma.taskTimeEvent.createMany({
      data: onHoldTasks.map((t) => ({
        taskId: t.id,
        employeeId,
        eventType: "OFFICE_CLOSE" as const,
        eventTimeUtc: now,
        createdById: employeeId,
        remark: "Workday closed",
      })),
    });
  }

  await publishEmployeeTime(employeeId);
  return {
    closed: true,
    employeeId,
    workDate: workDate.toISOString().slice(0, 10),
    closedAtUtc: session.closedAtUtc.toISOString(),
    correlationId,
  };
}

/** Undo today's workday close so the employee can start timers again. */
export async function persistWorkdayReopen(employeeId: number, correlationId: string) {
  const workDate = startOfUtcDay(new Date());
  const existing = await prisma.workdaySession.findUnique({
    where: { employeeId_workDate: { employeeId, workDate } },
  });

  if (!existing) {
    return {
      closed: false,
      reopened: false,
      employeeId,
      workDate: workDate.toISOString().slice(0, 10),
      correlationId,
    };
  }

  await prisma.workdaySession.delete({
    where: { employeeId_workDate: { employeeId, workDate } },
  });

  await writeAuditLogDirect({
    entityType: "WorkdaySession",
    entityId: existing.id.toString(),
    action: "REOPEN",
    userId: employeeId,
    correlationId,
    before: {
      employeeId: existing.employeeId,
      workDate: existing.workDate.toISOString().slice(0, 10),
      closedAtUtc: existing.closedAtUtc.toISOString(),
    },
    after: null,
  });

  await publishEmployeeTime(employeeId);
  return {
    closed: false,
    reopened: true,
    employeeId,
    workDate: workDate.toISOString().slice(0, 10),
    correlationId,
  };
}

async function publishEmployeeTime(employeeId: number) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true },
    });
    if (!employee) return;
    await publishRealtime({ companyId: employee.companyId, topics: ["time"] });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "Workday realtime publish skipped",
        employeeId,
        error: String(error),
      }),
    );
  }
}
