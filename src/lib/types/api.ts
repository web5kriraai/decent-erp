export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type WorkType = "NEW_DESIGN" | "REPEAT" | "REVIVAL" | "CUSTOM";

export type DesignSummary = {
  id: string;
  ideaRef: string;
  designNumber?: string | null;
  collectionName: string;
  status: string;
  priority: Priority;
  conceptNote?: string | null;
  styleName?: string | null;
  workType?: WorkType | null;
  trendReference?: string | null;
  celebrityReference?: string | null;
  currentStage?: string | null;
  version?: number;
  productType?: { id: number; name: string; code: string };
  season?: { id: number; name: string; code: string };
  designHead?: { id: number; name: string };
  components?: Array<{ id: string; componentType?: { name: string; code: string }; specification?: string | null }>;
  tasks?: DesignTask[];
  corrections?: unknown[];
  approvals?: unknown[];
};

export type DesignListResponse = {
  items: DesignSummary[];
  total: number;
};

export type DesignTask = {
  id: string;
  status: string;
  priority: Priority;
  expectedMinutes: number;
  version: number;
  outputRemark?: string | null;
  assignedEmployeeId?: number | null;
  assignedEmployee?: { id: number; name: string; employeeCode: string } | null;
  design: { id: string; ideaRef: string; collectionName: string };
  process: { id: number; name: string; code: string };
  subProcess: { id: number; name: string; code: string };
  timeEvents?: TaskTimeEvent[];
};

export type TaskTimeEvent = {
  id: string;
  eventType: string;
  eventTimeUtc: string;
  holdReasonId?: number | null;
  remark?: string | null;
  holdReason?: { id: number; code: string; name: string } | null;
};

export type TimeSummary = {
  activeSeconds: number;
  holdSeconds: number;
  totalElapsedSeconds: number;
  holdByReason: Array<{ code: string; name: string; seconds: number }>;
};

export type EmployeeTimeSummary = {
  date: string;
  workdayClosed: boolean;
  workdayClosedAt: string | null;
  totals: {
    activeSeconds: number;
    holdSeconds: number;
    openTasks: number;
    overdueTasks: number;
    holdByReason: Array<{ code: string; name: string; seconds: number }>;
  };
  currentTask: {
    taskId: string;
    ideaRef: string;
    subProcessName: string;
    status: string;
  } & TimeSummary | null;
  tasksToday: Array<{
    taskId: string;
    ideaRef: string;
    subProcessName: string;
    status: string;
    expectedMinutes: number;
  } & TimeSummary>;
};

export type LiveTeamTimeRow = {
  employeeId: number;
  name: string;
  employeeCode: string;
  role: { code: string; name: string };
  status: "IDLE" | "RUNNING" | "ON_HOLD";
  task: {
    taskId: string;
    ideaRef: string;
    collectionName: string;
    processName: string;
    subProcessName: string;
    dueAt: string | null;
    expectedMinutes: number;
  } & TimeSummary | null;
};

export type TaskTimeDetail = {
  id: string;
  designId: string;
  status: string;
  priority: Priority;
  expectedMinutes: number;
  version: number;
  outputRemark?: string | null;
  assignedEmployeeId?: number | null;
  design: { id: string; ideaRef: string; collectionName: string };
  process: { id: number; name: string; code: string };
  subProcess: { id: number; name: string; code: string };
  assignedEmployee?: { id: number; name: string; employeeCode: string } | null;
  timeSummary: TimeSummary;
  timeline: TaskTimeEvent[];
};

export type HoldReason = {
  id: number;
  code: string;
  name: string;
};

export type WorkflowPatternTask = {
  id: number;
  sequence: number;
  expectedMinutes: number;
  processId: number;
  subProcessId: number;
  defaultRoleId: number;
  process?: { id: number; code: string; name: string };
  subProcess?: { id: number; code: string; name: string };
  defaultRole?: { id: number; code: string; name: string };
};

export type WorkflowPattern = {
  id: number;
  name: string;
  versionNo: number;
  active?: boolean;
  productTypeId?: number | null;
  productType?: { id: number; code: string; name: string } | null;
  tasks: WorkflowPatternTask[];
};

export type CreateWorkflowPatternPayload = {
  name: string;
  productTypeId?: number | null;
  versionNo?: number;
  tasks: Array<{
    processId: number;
    subProcessId: number;
    defaultRoleId: number;
    expectedMinutes: number;
    sequence: number;
  }>;
};

export type ProductType = { id: number; code: string; name: string };
export type Season = { id: number; code: string; name: string };
export type EmployeeOption = { id: number; name: string; employeeCode: string };

export type AdminEmployeeRow = {
  id: number;
  employeeCode: string;
  name: string;
  email: string;
  active: boolean;
  role: { id: number; code: string; name: string };
};

export type AdminRoleOption = {
  id: number;
  code: string;
  name: string;
  displayName: string;
  permissionCount: number;
  employeeCount: number;
};

export type CorrectionRecord = {
  id: string;
  designId: string;
  taskId: string;
  correctionType: string;
  status: string;
  rootCause?: string | null;
  extraMinutes?: number | null;
  extraCost?: number | null;
  createdAtUtc: string;
  design: { id: string; ideaRef: string; collectionName: string };
  task: {
    id: string;
    process: { name: string; code: string };
    subProcess: { name: string; code: string };
  };
  raisedBy: { id: number; name: string; employeeCode: string };
  responsibleEmployee: { id: number; name: string; employeeCode: string };
};

export type ApprovalLevel = {
  id: number;
  code: string;
  name: string;
  sequence: number;
};

export type PendingApproval = {
  id: string;
  designId: string;
  taskId?: string | null;
  approvalLevelId: number;
  decision: string;
  remark?: string | null;
  decisionAtUtc?: string | null;
  design: { id: string; ideaRef: string; collectionName: string; status: string };
  level: ApprovalLevel;
  approver: { id: number; name: string; employeeCode: string };
  task?: {
    id: string;
    process: { name: string };
    subProcess: { name: string };
  } | null;
};

export type DesignImageRecord = {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: string;
  isPrimary: boolean;
  uploadedAtUtc: string;
  downloadUrl: string;
};

export type DesignCostRecord = {
  id: string;
  designId: string;
  costType: string;
  description?: string | null;
  amount: number;
  enteredAtUtc: string;
  enteredBy: { id: number; name: string; employeeCode: string };
};

export type DesignCostSummary = {
  totalDevCost: number;
  byType: Record<string, number>;
  entryCount: number;
  hasCosting: boolean;
};

export type ManualDesignTask = {
  processId: number;
  subProcessId: number;
  expectedMinutes: number;
  sequence?: number;
  assignedEmployeeId?: number;
};

export type CreateDesignPayload = {
  productTypeId: number;
  collectionName: string;
  seasonId: number;
  priority: Priority;
  conceptNote?: string;
  styleName?: string;
  workType?: WorkType;
  trendReference?: string;
  celebrityReference?: string;
  componentTypeIds?: number[];
  assignmentMode: "AUTOMATIC" | "MANUAL";
  workflowPatternId?: number;
  manualTasks?: ManualDesignTask[];
};

export function computeElapsedSeconds(events: TaskTimeEvent[]): number {
  if (events.length === 0) return 0;

  const sorted = [...events].sort(
    (a, b) => new Date(a.eventTimeUtc).getTime() - new Date(b.eventTimeUtc).getTime(),
  );

  let total = 0;
  let segmentStart: Date | null = null;

  for (const event of sorted) {
    const time = new Date(event.eventTimeUtc);
    if (event.eventType === "START" || event.eventType === "RESUME") {
      segmentStart = time;
    } else if (
      (event.eventType === "HOLD" || event.eventType === "END") &&
      segmentStart
    ) {
      total += Math.floor((time.getTime() - segmentStart.getTime()) / 1000);
      segmentStart = null;
    }
  }

  if (segmentStart) {
    total += Math.floor((Date.now() - segmentStart.getTime()) / 1000);
  }

  return Math.max(0, total);
}
