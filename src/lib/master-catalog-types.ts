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

const MASTER_TYPE_SET = new Set<string>(Object.values(MASTER_TYPES));

export function isMasterType(value: string | null | undefined): value is MasterType {
  return !!value && MASTER_TYPE_SET.has(value);
}

export type MasterHubCatalogTile = {
  kind: "catalog";
  masterType: MasterType;
  label: string;
};

export type MasterHubLinkTile = {
  kind: "link";
  id: string;
  label: string;
  href: string;
  description: string;
};

export type MasterHubTile = MasterHubCatalogTile | MasterHubLinkTile;

export type MasterHubGroup = {
  id: string;
  title: string;
  description: string;
  tiles: MasterHubTile[];
};

function catalogTile(masterType: MasterType): MasterHubCatalogTile {
  return {
    kind: "catalog",
    masterType,
    label: MASTER_TYPE_LABELS[masterType],
  };
}

/** Catalog types that already have domain consumers (designs, materials, quality, samples). */
export const MASTER_TYPES_WIRED: ReadonlySet<MasterType> = new Set([
  MASTER_TYPES.PRODUCT_CATEGORY,
  MASTER_TYPES.PRODUCT_COMPONENT,
  MASTER_TYPES.SEASON,
  MASTER_TYPES.STYLE,
  MASTER_TYPES.THEME,
  MASTER_TYPES.CELEBRITY,
  MASTER_TYPES.WORK_TYPE,
  MASTER_TYPES.FABRIC_QUALITY,
  MASTER_TYPES.THREAD,
  MASTER_TYPES.ACCESSORIES,
  MASTER_TYPES.MACHINE,
  MASTER_TYPES.STITCHING_TYPE,
  MASTER_TYPES.DESIGN_GRADE,
  MASTER_TYPES.CORRECTION_TYPE,
]);

export function isMasterTypeWired(masterType: MasterType): boolean {
  return MASTER_TYPES_WIRED.has(masterType);
}

/** Admin hub: domain groups for catalog types + links to structured masters. */
export const MASTER_HUB_GROUPS: MasterHubGroup[] = [
  {
    id: "product",
    title: "Product & concept",
    description: "Attributes used when creating and classifying design concepts.",
    tiles: [
      catalogTile(MASTER_TYPES.PRODUCT_CATEGORY),
      catalogTile(MASTER_TYPES.PRODUCT_COMPONENT),
      catalogTile(MASTER_TYPES.SEASON),
      catalogTile(MASTER_TYPES.FESTIVAL),
      catalogTile(MASTER_TYPES.STYLE),
      catalogTile(MASTER_TYPES.THEME),
      catalogTile(MASTER_TYPES.CELEBRITY),
      catalogTile(MASTER_TYPES.WORK_TYPE),
    ],
  },
  {
    id: "materials",
    title: "Materials & tools",
    description: "Fabrics, colour, thread, accessories, machines, and software.",
    tiles: [
      catalogTile(MASTER_TYPES.FABRIC_QUALITY),
      catalogTile(MASTER_TYPES.COLOUR_TONE),
      catalogTile(MASTER_TYPES.THREAD),
      catalogTile(MASTER_TYPES.ACCESSORIES),
      catalogTile(MASTER_TYPES.MACHINE),
      catalogTile(MASTER_TYPES.SOFTWARE),
    ],
  },
  {
    id: "specs",
    title: "Design specifications",
    description: "Pattern, stitching, grade, complexity, and sample location.",
    tiles: [
      catalogTile(MASTER_TYPES.COMPLEXITY_LEVEL),
      catalogTile(MASTER_TYPES.DESIGN_PATTERN),
      catalogTile(MASTER_TYPES.STITCHING_TYPE),
      catalogTile(MASTER_TYPES.DESIGN_GRADE),
      catalogTile(MASTER_TYPES.PHYSICAL_SAMPLE_LOCATION),
    ],
  },
  {
    id: "quality",
    title: "Quality & corrections",
    description: "Mistake categories and correction types used on the floor.",
    tiles: [
      catalogTile(MASTER_TYPES.MISTAKE_CATEGORY),
      catalogTile(MASTER_TYPES.CORRECTION_TYPE),
    ],
  },
  {
    id: "related",
    title: "Related setup",
    description: "Structured masters that live outside the flat catalog table.",
    tiles: [
      {
        kind: "link",
        id: "approval-levels",
        label: "Approval Level",
        href: "/admin/masters?tab=structured&section=approvals",
        description: "Stage approval levels",
      },
      {
        kind: "link",
        id: "skills",
        label: "Employee Skill",
        href: "/admin/masters?tab=structured&section=skills",
        description: "Skills for assignment",
      },
      {
        kind: "link",
        id: "checklist",
        label: "Checklist",
        href: "/admin/masters?tab=structured&section=checklist",
        description: "Quality checklist items",
      },
      {
        kind: "link",
        id: "hold-reasons",
        label: "Hold Reasons",
        href: "/admin/masters?tab=structured&section=holds",
        description: "Task hold reasons",
      },
      {
        kind: "link",
        id: "targets",
        label: "Concept Targets",
        href: "/admin/masters?tab=targets",
        description: "Monthly idea targets",
      },
      {
        kind: "link",
        id: "kpi",
        label: "KRA / KPI",
        href: "/admin/masters?tab=kpi",
        description: "Weight configuration",
      },
    ],
  },
];

/** Flat tile list (catalog + links) for search / legacy consumers. */
export const MASTER_HUB_TILES: MasterHubTile[] = MASTER_HUB_GROUPS.flatMap(
  (group) => group.tiles,
);
