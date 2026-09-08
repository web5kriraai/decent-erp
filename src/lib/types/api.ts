export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const WORK_TYPE_CODES = ["NEW_DESIGN", "REPEAT", "REVIVAL", "CUSTOM"] as const;
export type WorkType = (typeof WORK_TYPE_CODES)[number];

export const WORK_TYPE_OPTIONS: { value: WorkType; label: string }[] = [
  { value: "NEW_DESIGN", label: "New Design" },
  { value: "REPEAT", label: "Repeat" },
  { value: "REVIVAL", label: "Revival" },
  { value: "CUSTOM", label: "Custom" },
];

export function isWorkTypeCode(value: string): value is WorkType {
  return (WORK_TYPE_CODES as readonly string[]).includes(value);
}

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
  targetGrade?: string | null;
  designGradeId?: number | null;
  fabricId?: number | null;
  machineId?: number | null;
  stitchingTypeId?: number | null;
  estimatedCost?: number | null;
  currentStage?: string | null;
  version?: number;
  productType?: { id: number; name: string; code: string };
  season?: { id: number; name: string; code: string };
  designHead?: { id: number; name: string };
  fabric?: { id: number; name: string; code: string };
  machine?: { id: number; name: string; code: string };
  stitchingType?: { id: number; name: string; code: string };
  designGrade?: { id: number; name: string; code: string };
  components?: Array<{
    id: string;
    componentTypeId?: number;
    componentType?: { name: string; code: string };
    specification?: string | null;
  }>;
  images?: Array<{ id: string; isPrimary: boolean; fileName?: string; mediaKind?: string }>;
  tasks?: DesignTask[];
  corrections?: DesignCorrectionDetail[];
  approvals?: DesignApprovalDetail[];
  costs?: Array<{
    id: string;
    amount: number;
    costType: string;
    costCategory?: string | null;
    description?: string | null;
  }>;
  creativityRatings?: Array<{
    id: string;
    employeeId: number;
    score: number;
    remark?: string | null;
    employee?: { id: number; name: string };
  }>;
  detailMeta?: DesignDetailMeta;
};

export type DesignDetailMeta = {
  progressPercent: number;
  completedTasks: number;
  totalTasks: number;
  currentOwner: { id: number; name: string } | null;
  dueAt: string | null;
  costSummary: {
    estimatedCost: number | null;
    standardCost: number | null;
    totalDevCost: number;
    correctionCost: number;
    marginPercent: number | null;
  };
};

export type DesignCorrectionDetail = {
  id: string;
  correctionType: string;
  status: string;
  rootCause?: string | null;
  ratingImpact?: number | null;
  createdAtUtc: string;
  raisedBy?: { id: number; name: string };
  responsibleEmployee?: { id: number; name: string } | null;
  routeToSubProcess?: { id: number; code: string; name: string } | null;
};

export type DesignApprovalDetail = {
  id: string;
  decision: string;
  remark?: string | null;
  decisionAtUtc?: string | null;
  level?: { id: number; name: string; sequence: number; code?: string };
  approver?: { id: number; name: string };
};

export type DesignKpiContribution = {
  employeeId: number;
  name: string;
  score: number;
  maxScore: number;
};

export type EmployeePerformanceResponse = {
  employeeId: number;
  periodYear: number;
  periodMonth: number;
  marksBalance: number;
  grade: {
    gradeCode: string;
    weightedKpiScore: number;
    totalMarks: number;
    calculatedAtUtc: string;
  } | null;
  marks: Array<{
    id: string;
    sourceType: string;
    sourceRef?: string | null;
    pointsDelta: number;
    balanceAfter: number;
    note?: string | null;
    createdAtUtc: string;
  }>;
};

export type DesignListResponse = {
  items: DesignSummary[];
  total: number;
};

export type KanbanWorkflowInfo = {
  currentStage: string | null;
  /** Sub-process code for stage-lane kanban (e.g. SKETCH, SAMPLE_CHECK). */
  currentStageCode: string | null;
  currentStatus: string | null;
  currentOwner: string | null;
  summary: string | null;
  completedStages: number;
  totalStages: number;
  activeStages: Array<{
    label: string;
    status: string;
    assigneeName: string | null;
  }>;
};

export type KanbanDesignItem = {
  id: string;
  ideaRef: string;
  collectionName: string;
  status: string;
  /** Persisted designConcept.currentStage (sub-process code), when set. */
  currentStage?: string | null;
  priority: Priority;
  version: number;
  productType: { name: string; code?: string };
  designHead: { name: string };
  season?: { id: number; name: string } | null;
  estimatedCost?: number | null;
  createdAtUtc?: string;
  dueAt?: string | null;
  primaryImageUrl?: string | null;
  openCorrectionCount?: number;
  workflow: KanbanWorkflowInfo;
};

export type DesignWorkflowDashboardSummary = {
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

export type DesignWorkflowDashboardResponse = {
  items: KanbanDesignItem[];
  summary: DesignWorkflowDashboardSummary;
};

export type DesignTask = {
  id: string;
  designId?: string;
  status: string;
  sequence: number;
  dependencySequence?: number | null;
  priority: Priority;
  expectedMinutes: number;
  version: number;
  outputRemark?: string | null;
  skipReason?: string | null;
  skippedAt?: string | null;
  assignedEmployeeId?: number | null;
  assignedEmployee?: { id: number; name: string; employeeCode: string } | null;
  design: { id: string; ideaRef: string; collectionName: string; priority?: Priority };
  process: { id: number; name: string; code: string };
  subProcess: {
    id: number;
    name: string;
    code: string;
    isFileRequired?: boolean;
    isApproval?: boolean;
    capabilities?: unknown;
    defaultRole?: { id?: number; code: string; name?: string } | null;
  };
  timeEvents?: TaskTimeEvent[];
  dueAt?: string | null;
  completedAt?: string | null;
  /** Task artifacts when loaded via design detail. */
  artifacts?: Array<{
    id?: string;
    artifactType?: string;
    stitchCount?: number | null;
    machineFormat?: string | null;
    sampleQty?: number | null;
    wastageQty?: number | null;
    fileName?: string | null;
    storageKey?: string | null;
    contentType?: string | null;
    uploadedAtUtc?: string | null;
  }>;
  /** Resolved workflow status for display (CHECKING work may read COMPLETED after approval). */
  effectiveStatus?: string;
  isWaitingOnOthers?: boolean;
  waitingOnStage?: string | null;
  waitingOnAssignee?: string | null;
  canStart?: boolean;
  startBlockedReason?: string;
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
  /** Resolved status for display (CHECKING → COMPLETED when approval gate is done). */
  effectiveStatus: string;
  sequence: number;
  dependencySequence: number | null;
  priority: Priority;
  expectedMinutes: number;
  version: number;
  outputRemark?: string | null;
  assignedEmployeeId?: number | null;
  design: {
    id: string;
    ideaRef: string;
    collectionName: string;
    productType?: string | null;
  };
  process: { id: number; name: string; code: string };
  subProcess: {
    id: number;
    name: string;
    code: string;
    isFileRequired?: boolean;
    isApproval?: boolean;
    capabilities?: unknown;
    defaultRole?: { id?: number; code: string; name?: string } | null;
  };
  assignedEmployee?: { id: number; name: string; employeeCode: string } | null;
  timeSummary: TimeSummary;
  timeline: TaskTimeEvent[];
  workflowPeers: Array<{
    id: string;
    sequence: number;
    dependencySequence: number | null;
    status: string;
    assignedEmployeeId: number | null;
    outputRemark?: string | null;
    subProcess: { name: string; code: string; isApproval?: boolean };
    assignedEmployee?: { name: string } | null;
  }>;
  assigneeHasRunningTask: boolean;
  canStart: boolean;
  startBlockedReason?: string;
  blockedMessage?: string | null;
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
  defaultSkillId?: number | null;
  dayOffset?: number;
  priority?: Priority;
  dependencySequence?: number | null;
  process?: { id: number; code: string; name: string };
  subProcess?: { id: number; code: string; name: string };
  defaultRole?: { id: number; code: string; name: string };
  defaultSkill?: { id: number; code: string; name: string } | null;
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
    defaultSkillId?: number | null;
    expectedMinutes: number;
    sequence: number;
    dayOffset?: number;
    priority?: Priority;
    dependencySequence?: number | null;
  }>;
};

export type ProductType = { id: number; code: string; name: string; active?: boolean };
export type Season = { id: number; code: string; name: string; active?: boolean };
export type EmployeeOption = { id: number; name: string; employeeCode: string };

export type AdminEmployeeRow = {
  id: number;
  employeeCode: string;
  name: string;
  email: string;
  active: boolean;
  role: { id: number; code: string; name: string };
  /** Current UTC month performance grade (A–E), when computed. */
  gradeCode?: string | null;
  /** Marks balance snapshot from current-month grade row. */
  marksBalance?: number | null;
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
  responsibleEmployee?: { id: number; name: string; employeeCode: string } | null;
  routeToSubProcess?: { id: number; code: string; name: string } | null;
};

export type ApprovalLevel = {
  id: number;
  code: string;
  name: string;
  sequence: number;
  requiredRoleId?: number | null;
};

export type PendingApprovalQueueItem = {
  designId: string;
  design: {
    id: string;
    ideaRef: string;
    collectionName: string;
    status: string;
    priority?: string;
  };
  currentLevel: ApprovalLevel;
  /** Next management level after the current one, if any. */
  nextLevelName?: string | null;
  task: {
    id: string;
    process: { name: string };
    subProcess: { name: string };
  } | null;
  existingApprovalId: string | null;
  /** False when final management level still needs a cost entry. */
  costingReady?: boolean;
  /** Design Head request package (remark + snapshot). */
  approvalRequestPackage?: unknown;
  /** Live stage assignees for correction routing preview. */
  stageAssignees?: Array<{
    code: string;
    name: string;
    assigneeEmployeeId: number | null;
    assigneeName: string | null;
  }>;
};

export type ReadyForSignOffItem = {
  designId: string;
  ideaRef: string;
  collectionName: string;
  completedAt: string | null;
};

export type StageApprovalQueueItem = {
  taskId: string;
  designId: string;
  ideaRef: string;
  collectionName: string;
  stageName: string;
  stageCode: string;
  status: string;
  assigneeName: string | null;
  workStageName: string | null;
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
  /** Present on submit response - chain still has a later level. */
  chainComplete?: boolean;
  designStatus?: string;
  nextLevel?: ApprovalLevel | null;
  correctionId?: string | null;
  routedAssigneeName?: string | null;
  routedStageName?: string | null;
};

export type DesignImageRecord = {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: string;
  isPrimary: boolean;
  mediaKind?: "IMAGE" | "AUDIO" | "VIDEO" | "FILE" | string;
  designComponentId?: string | null;
  reviewStatus?: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote?: string | null;
  uploadedAtUtc: string;
  downloadUrl: string;
};

export type DesignCostRecord = {
  id: string;
  designId: string;
  costType: string;
  costCategory?: string | null;
  description?: string | null;
  amount: number;
  enteredAtUtc: string;
  enteredBy: { id: number; name: string; employeeCode: string };
};

export type DesignCostSummary = {
  totalDevCost: number;
  byType: Record<string, number>;
  byCategory?: Record<string, number>;
  entryCount: number;
  hasCosting: boolean;
  estimatedCost?: number | null;
  standardCost?: number | null;
  expectedMrp?: number | null;
  marginAmount?: number | null;
  marginPercent?: number | null;
  mrpMarginAmount?: number | null;
  mrpMarginPercent?: number | null;
};

export type ManualDesignTask = {
  processId: number;
  subProcessId: number;
  expectedMinutes: number;
  sequence?: number;
  assignedEmployeeId?: number;
  /** ISO date or datetime; stored as task dueAt */
  dueAt?: string;
  priority?: Priority;
};

export type DesignCompletionSummary = {
  designId: string;
  ideaRef: string;
  collectionName: string;
  status: string;
  isComplete: boolean;
  workflowStartedAt: string;
  workflowFinishedAt: string | null;
  phaseCounts: {
    completed: number;
    skipped: number;
    cancelled: number;
    total: number;
  };
  employees: Array<{
    employeeId: number;
    name: string;
    employeeCode: string;
    roleCode: string;
    roleName: string;
    tasksAssigned: number;
    tasksCompleted: number;
    tasksSkippedAsAssignee: number;
    activeSeconds: number;
    holdSeconds: number;
    totalElapsedSeconds: number;
  }>;
  phases: Array<{
    taskId: string;
    sequence: number;
    code: string;
    name: string;
    status: string;
    assignee: { id: number; name: string; employeeCode: string } | null;
    startedAt: string | null;
    completedAt: string | null;
    activeSeconds: number;
    holdSeconds: number;
    totalElapsedSeconds: number;
    expectedMinutes: number;
    skipReason: string | null;
  }>;
  overrideHistory: Array<{
    action: string;
    atUtc: string;
    actor: string;
    fromStage: string | null;
    toStage: string | null;
    reason: string | null;
    direction?: string;
  }>;
  totals: {
    peopleCount: number;
    totalActiveSeconds: number;
    totalHoldSeconds: number;
    totalElapsedSeconds: number;
    skippedPhaseCount: number;
  };
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
  targetGrade?: string;
  designGradeId?: number;
  fabricId?: number;
  machineId?: number;
  stitchingTypeId?: number;
  estimatedCost?: number;
  standardCost?: number;
  componentTypeIds?: number[];
  componentSpecs?: Record<string, string>;
  assignmentMode: "AUTOMATIC" | "MANUAL";
  workflowPatternId?: number;
  taskDateMode?: "SEQUENTIAL" | "SAME_DAY" | "SEQUENTIAL_BY_INDEX";
  manualTasks?: ManualDesignTask[];
};

export type WorkflowPatternPreview = {
  patternId: number;
  patternName: string;
  taskDateMode: "SEQUENTIAL" | "SAME_DAY" | "SEQUENTIAL_BY_INDEX";
  tasks: Array<{
    sequence: number;
    processId: number;
    subProcessId: number;
    stage: string;
    assigneeName: string;
    assignedEmployeeId: number | null;
    roleName: string | null;
    hours: string;
    expectedMinutes: number;
    plannedDate: string;
    plannedStart: string;
    dueAt: string;
    priority: Priority;
  }>;
};

export type DesignTaskScheduleUpdatePayload = {
  tasks: Array<{
    taskId: string;
    dueAt?: string | null;
    priority?: Priority;
    assignedEmployeeId?: number | null;
    expectedMinutes?: number;
  }>;
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
