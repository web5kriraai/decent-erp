export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type DesignSummary = {
  id: string;
  ideaRef: string;
  collectionName: string;
  status: string;
  priority: Priority;
  conceptNote?: string | null;
  currentStage?: string | null;
  version?: number;
  productType?: { id: number; name: string; code: string };
  season?: { id: number; name: string; code: string };
  designHead?: { id: number; name: string };
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
};

export type HoldReason = {
  id: number;
  code: string;
  name: string;
};

export type WorkflowPattern = {
  id: number;
  name: string;
  versionNo: number;
  tasks: Array<{ id: number; sequence: number; expectedMinutes: number }>;
};

export type ProductType = { id: number; code: string; name: string };
export type Season = { id: number; code: string; name: string };
export type EmployeeOption = { id: number; name: string; employeeCode: string };

export type CreateDesignPayload = {
  productTypeId: number;
  collectionName: string;
  seasonId: number;
  priority: Priority;
  conceptNote?: string;
  assignmentMode: "AUTOMATIC" | "MANUAL";
  workflowPatternId?: number;
  manualTasks?: unknown[];
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
