import { PERMISSIONS, ROLE_CODES, type PermissionCode } from "@/lib/permissions";

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export type RoleDefinition = {
  code: RoleCode;
  displayName: string;
  summary: string;
  responsibilities: string[];
  restrictions: string[];
  permissions: PermissionCode[];
  /** Primary sidebar sections this role typically uses */
  navFocus: string[];
};

export const ROLE_CATALOG: Record<RoleCode, RoleDefinition> = {
  [ROLE_CODES.DESIGN_HEAD]: {
    code: ROLE_CODES.DESIGN_HEAD,
    displayName: "Design Head",
    summary: "Owns the design pipeline from concept through stage approvals and team coordination.",
    responsibilities: [
      "Create and manage design concepts and collections",
      "Assign and reassign tasks to designers",
      "Execute stage tasks on My Tasks (Concept Review, Sketch Approval, Final Approval)",
      "Approve design stages and release to next process",
      "Monitor team time, costing, and KPI for the design unit",
      "Raise corrections and coordinate rework",
    ],
    restrictions: [
      "Cannot alter server time events directly",
    ],
    permissions: [
      PERMISSIONS.DESIGN_CREATE,
      PERMISSIONS.DESIGN_ASSIGN,
      PERMISSIONS.DESIGN_APPROVE,
      PERMISSIONS.TASK_EXECUTE,
      PERMISSIONS.CORRECTION_RAISE,
      PERMISSIONS.COST_VIEW,
      PERMISSIONS.TIME_VIEW_TEAM,
      PERMISSIONS.WORKFLOW_OVERRIDE,
    ],
    navFocus: ["My Work", "Design Pipeline", "Quality", "Finance", "Team & Reports", "Production"],
  },
  [ROLE_CODES.SKETCH_DESIGNER]: {
    code: ROLE_CODES.SKETCH_DESIGNER,
    displayName: "Sketch Designer",
    summary: "Executes sketch-stage work with server-tracked task timers.",
    responsibilities: [
      "View and execute assigned sketch tasks",
      "Start, hold, resume, and complete tasks with remarks",
      "Upload sketch versions and respond to corrections",
      "Track personal active and hold time daily",
    ],
    restrictions: [
      "No final design approval or KPI definition editing",
      "Cannot change process masters or workflow patterns",
    ],
    permissions: [PERMISSIONS.TASK_EXECUTE, PERMISSIONS.CORRECTION_RAISE],
    navFocus: ["My Work", "Quality"],
  },
  [ROLE_CODES.PUNCHING_DESIGNER]: {
    code: ROLE_CODES.PUNCHING_DESIGNER,
    displayName: "Punching Designer",
    summary: "Handles punching / Wilcom digitizing tasks and file uploads.",
    responsibilities: [
      "Execute punching and embroidery digitizing tasks",
      "Upload EMB/DST files and stitch metadata",
      "Respond to corrections on punching output",
      "Track task time via server-authoritative timer",
    ],
    restrictions: [
      "Cannot delete approved concepts",
      "No costing master or approval authority",
    ],
    permissions: [PERMISSIONS.TASK_EXECUTE, PERMISSIONS.CORRECTION_RAISE],
    navFocus: ["My Work", "Quality"],
  },
  [ROLE_CODES.MACHINE_OPERATOR]: {
    code: ROLE_CODES.MACHINE_OPERATOR,
    displayName: "Machine Operator",
    summary: "Runs sample production on machines and records output.",
    responsibilities: [
      "Execute sample and machine-related tasks",
      "Record sample output, wastage, and machine details",
      "Use task timer for accurate production time",
    ],
    restrictions: [
      "No design-level approval or concept changes",
      "No access to costing or admin masters",
    ],
    permissions: [PERMISSIONS.TASK_EXECUTE],
    navFocus: ["My Work"],
  },
  [ROLE_CODES.SAMPLE_CHECKER]: {
    code: ROLE_CODES.SAMPLE_CHECKER,
    displayName: "Sample Checker",
    summary: "Quality gate for punching files and machine samples — checklist, approve, reject, or re-sample.",
    responsibilities: [
      "Execute punching check and sample checking tasks on My Tasks",
      "Approve, reject, or request re-sample on machine output",
      "Approve or return punching work for correction",
      "Raise corrections with responsible employee",
      "Complete checking tasks with audited timestamps",
    ],
    restrictions: [
      "Cannot change cost masters or workflow configuration",
    ],
    permissions: [
      PERMISSIONS.TASK_EXECUTE,
      PERMISSIONS.CORRECTION_RAISE,
      PERMISSIONS.DESIGN_APPROVE,
    ],
    navFocus: ["My Work", "Quality"],
  },
  [ROLE_CODES.COSTING_TEAM]: {
    code: ROLE_CODES.COSTING_TEAM,
    displayName: "Costing Team",
    summary: "Development and standard cost entry with margin review.",
    responsibilities: [
      "Enter development and standard costs per design",
      "Complete Costing stage tasks on My Tasks when assigned by workflow",
      "Review margin against thresholds",
      "Support approval gate with mandatory costing completeness",
    ],
    restrictions: [
      "Cannot mark employee mistakes unless explicitly permitted",
      "No design creation or final approval authority",
    ],
    permissions: [PERMISSIONS.COST_VIEW, PERMISSIONS.TASK_EXECUTE],
    navFocus: ["My Work", "Finance"],
  },
  [ROLE_CODES.PRODUCTION_HEAD]: {
    code: ROLE_CODES.PRODUCTION_HEAD,
    displayName: "Production Head",
    summary: "Accepts production release and coordinates shop-floor handoff.",
    responsibilities: [
      "View approved designs ready for production",
      "Review production instructions and costing summary",
      "Accept or hold production release decisions",
    ],
    restrictions: [
      "Cannot alter prior design history or time events",
      "No admin master configuration",
    ],
    permissions: [PERMISSIONS.PRODUCTION_RELEASE, PERMISSIONS.COST_VIEW],
    navFocus: ["Finance", "Production"],
  },
  [ROLE_CODES.ADMIN]: {
    code: ROLE_CODES.ADMIN,
    displayName: "System Admin",
    summary: "Full system configuration, masters, and role permission management.",
    responsibilities: [
      "Maintain process masters and workflow patterns",
      "Configure hold reasons and KPI definitions",
      "Manage role permissions and audit all admin actions",
      "Monitor live team time and full analytics",
    ],
    restrictions: ["All admin actions are audited"],
    permissions: Object.values(PERMISSIONS),
    navFocus: ["All modules"],
  },
  [ROLE_CODES.MANAGEMENT]: {
    code: ROLE_CODES.MANAGEMENT,
    displayName: "Management",
    summary: "Executive oversight - approvals, analytics, and release decisions.",
    responsibilities: [
      "Final approval on critical design stages",
      "View KPI, team time reports, and costing summaries",
      "Authorize production release at management level",
    ],
    restrictions: [
      "Operational edits restricted - read and approve focus",
      "No process master configuration",
    ],
    permissions: [
      PERMISSIONS.DESIGN_APPROVE,
      PERMISSIONS.COST_VIEW,
      PERMISSIONS.KPI_ADMIN,
      PERMISSIONS.TIME_VIEW_TEAM,
      PERMISSIONS.PRODUCTION_RELEASE,
    ],
    navFocus: ["Quality", "Finance", "Team & Reports", "Production"],
  },
};

export const ALL_ROLE_CODES = Object.values(ROLE_CODES);

export function getRoleDefinition(roleCode: string): RoleDefinition | undefined {
  return ROLE_CATALOG[roleCode as RoleCode];
}

export function formatRoleLabel(roleCode: string): string {
  return getRoleDefinition(roleCode)?.displayName ?? roleCode.replace(/_/g, " ");
}

export function getRolesForPermissions(permissions: string[]): RoleDefinition[] {
  return ALL_ROLE_CODES.map((code) => ROLE_CATALOG[code]).filter((role) =>
    role.permissions.every((p) => permissions.includes(p)),
  );
}

/** Demo login accounts seeded for UAT (password: Demo@123) */
export const DEMO_ACCOUNTS = [
  { email: "admin@decent-erp.local", role: ROLE_CODES.ADMIN, password: "Admin@123" },
  { email: "designhead@decent-erp.local", role: ROLE_CODES.DESIGN_HEAD, password: "Demo@123" },
  { email: "sketch@decent-erp.local", role: ROLE_CODES.SKETCH_DESIGNER, password: "Demo@123" },
  { email: "punch@decent-erp.local", role: ROLE_CODES.PUNCHING_DESIGNER, password: "Demo@123" },
  { email: "machine@decent-erp.local", role: ROLE_CODES.MACHINE_OPERATOR, password: "Demo@123" },
  { email: "checker@decent-erp.local", role: ROLE_CODES.SAMPLE_CHECKER, password: "Demo@123" },
  { email: "costing@decent-erp.local", role: ROLE_CODES.COSTING_TEAM, password: "Demo@123" },
  { email: "production@decent-erp.local", role: ROLE_CODES.PRODUCTION_HEAD, password: "Demo@123" },
  { email: "management@decent-erp.local", role: ROLE_CODES.MANAGEMENT, password: "Demo@123" },
] as const;
