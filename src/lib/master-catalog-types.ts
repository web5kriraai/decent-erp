/** Unified master_catalog type codes (flat lookups only). */
export const MASTER_TYPES = {
  PRODUCT_CATEGORY: "PRODUCT_CATEGORY",
  PRODUCT_COMPONENT: "PRODUCT_COMPONENT",
  SEASON: "SEASON",
  FESTIVAL: "FESTIVAL",
  STYLE: "STYLE",
  THEME: "THEME",
  CELEBRITY: "CELEBRITY",
  WORK_TYPE: "WORK_TYPE",
  FABRIC_QUALITY: "FABRIC_QUALITY",
  COLOUR_TONE: "COLOUR_TONE",
  THREAD: "THREAD",
  ACCESSORIES: "ACCESSORIES",
  MACHINE: "MACHINE",
  SOFTWARE: "SOFTWARE",
  COMPLEXITY_LEVEL: "COMPLEXITY_LEVEL",
  DESIGN_PATTERN: "DESIGN_PATTERN",
  MISTAKE_CATEGORY: "MISTAKE_CATEGORY",
  CORRECTION_TYPE: "CORRECTION_TYPE",
  STITCHING_TYPE: "STITCHING_TYPE",
  DESIGN_GRADE: "DESIGN_GRADE",
  PHYSICAL_SAMPLE_LOCATION: "PHYSICAL_SAMPLE_LOCATION",
} as const;

export type MasterType = (typeof MASTER_TYPES)[keyof typeof MASTER_TYPES];

export const MASTER_TYPE_LABELS: Record<MasterType, string> = {
  PRODUCT_CATEGORY: "Product Category",
  PRODUCT_COMPONENT: "Product Components",
  SEASON: "Season",
  FESTIVAL: "Festival",
  STYLE: "Style",
  THEME: "Theme",
  CELEBRITY: "Celebrity",
  WORK_TYPE: "Work Type",
  FABRIC_QUALITY: "Fabric Quality",
  COLOUR_TONE: "Colour & Tone",
  THREAD: "Thread",
  ACCESSORIES: "Accessories",
  MACHINE: "Machine",
  SOFTWARE: "Software",
  COMPLEXITY_LEVEL: "Complexity Level",
  DESIGN_PATTERN: "Design Pattern",
  MISTAKE_CATEGORY: "Mistake Category",
  CORRECTION_TYPE: "Correction Type",
  STITCHING_TYPE: "Stitching Type",
  DESIGN_GRADE: "Design Grade",
  PHYSICAL_SAMPLE_LOCATION: "Physical Sample Location",
};

/** Admin tiles: catalog types + links to structured masters. */
export const MASTER_HUB_TILES: Array<
  | { kind: "catalog"; masterType: MasterType; label: string }
  | { kind: "link"; id: string; label: string; href: string }
> = [
  ...Object.entries(MASTER_TYPE_LABELS).map(([masterType, label]) => ({
    kind: "catalog" as const,
    masterType: masterType as MasterType,
    label,
  })),
  { kind: "link", id: "approval-levels", label: "Approval Level", href: "/admin/masters?tab=processes" },
  { kind: "link", id: "skills", label: "Employee Skill", href: "/admin/masters?tab=processes" },
  { kind: "link", id: "targets", label: "Concept Targets", href: "/admin/masters?tab=targets" },
  { kind: "link", id: "kpi", label: "KRA / KPI", href: "/admin/masters?tab=kpi" },
  { kind: "link", id: "checklist", label: "Checklist", href: "/admin/masters?tab=processes" },
];
