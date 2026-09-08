import { prisma } from "@/lib/db";

export type MasterUsageWarning = {
  code: string;
  message: string;
  count: number;
};

function pushIfUsed(
  warnings: MasterUsageWarning[],
  code: string,
  count: number,
  singular: string,
  plural: string,
) {
  if (count <= 0) return;
  warnings.push({
    code,
    count,
    message: `Referenced by ${count} ${count === 1 ? singular : plural}`,
  });
}

/** Usage counts for soft-deactivate warnings only - never blocks retirement. */
export async function getProcessUsage(processId: number): Promise<MasterUsageWarning[]> {
  const [designTasks, patternTasks, designProcesses, activeChildren] =
    await Promise.all([
      prisma.designTask.count({ where: { processId } }),
      prisma.workflowPatternTask.count({ where: { processId } }),
      prisma.designProcess.count({ where: { processId } }),
      prisma.designSubProcessMaster.count({ where: { processId, active: true } }),
    ]);

  const warnings: MasterUsageWarning[] = [];
  pushIfUsed(warnings, "DESIGN_TASKS", designTasks, "design task", "design tasks");
  pushIfUsed(
    warnings,
    "WORKFLOW_PATTERN_TASKS",
    patternTasks,
    "workflow pattern step",
    "workflow pattern steps",
  );
  pushIfUsed(
    warnings,
    "DESIGN_PROCESSES",
    designProcesses,
    "design process instance",
    "design process instances",
  );
  pushIfUsed(
    warnings,
    "ACTIVE_SUB_PROCESSES",
    activeChildren,
    "active sub-process (will also be deactivated)",
    "active sub-processes (will also be deactivated)",
  );
  return warnings;
}

/** Usage counts for soft-deactivate warnings only - never blocks retirement. */
export async function getSubProcessUsage(
  subProcessId: number,
): Promise<MasterUsageWarning[]> {
  const [designTasks, patternTasks, designSubProcesses, checklist, corrections] =
    await Promise.all([
      prisma.designTask.count({ where: { subProcessId } }),
      prisma.workflowPatternTask.count({ where: { subProcessId } }),
      prisma.designSubProcess.count({ where: { subProcessId } }),
      prisma.qualityChecklistItem.count({ where: { subProcessId } }),
      prisma.designCorrection.count({ where: { routeToSubProcessId: subProcessId } }),
    ]);

  const warnings: MasterUsageWarning[] = [];
  pushIfUsed(warnings, "DESIGN_TASKS", designTasks, "design task", "design tasks");
  pushIfUsed(
    warnings,
    "WORKFLOW_PATTERN_TASKS",
    patternTasks,
    "workflow pattern step",
    "workflow pattern steps",
  );
  pushIfUsed(
    warnings,
    "DESIGN_SUB_PROCESSES",
    designSubProcesses,
    "design sub-process instance",
    "design sub-process instances",
  );
  pushIfUsed(
    warnings,
    "CHECKLIST_ITEMS",
    checklist,
    "checklist item",
    "checklist items",
  );
  pushIfUsed(
    warnings,
    "ROUTED_CORRECTIONS",
    corrections,
    "correction route",
    "correction routes",
  );
  return warnings;
}

/** Usage counts for soft-deactivate warnings only - never blocks retirement. */
export async function getCatalogUsage(catalogId: number): Promise<MasterUsageWarning[]> {
  const row = await prisma.masterCatalog.findUnique({
    where: { id: catalogId },
    select: { id: true, masterType: true },
  });
  if (!row) return [];

  const warnings: MasterUsageWarning[] = [];

  const [
    asProductType,
    asSeason,
    asFabric,
    asMachine,
    asStitching,
    asGrade,
    asComponents,
    asMaterials,
    asPatternProduct,
    asConceptTargets,
    asSampleMachine,
  ] = await Promise.all([
    prisma.designConcept.count({ where: { productTypeId: catalogId } }),
    prisma.designConcept.count({ where: { seasonId: catalogId } }),
    prisma.designConcept.count({ where: { fabricId: catalogId } }),
    prisma.designConcept.count({ where: { machineId: catalogId } }),
    prisma.designConcept.count({ where: { stitchingTypeId: catalogId } }),
    prisma.designConcept.count({ where: { designGradeId: catalogId } }),
    prisma.designComponent.count({ where: { componentTypeId: catalogId } }),
    prisma.designMaterialLine.count({ where: { catalogItemId: catalogId } }),
    prisma.workflowPattern.count({ where: { productTypeId: catalogId } }),
    prisma.conceptTarget.count({
      where: { OR: [{ productTypeId: catalogId }, { seasonId: catalogId }] },
    }),
    prisma.designTask.count({ where: { sampleMachineId: catalogId } }),
  ]);

  pushIfUsed(warnings, "DESIGNS_PRODUCT_TYPE", asProductType, "design", "designs");
  pushIfUsed(warnings, "DESIGNS_SEASON", asSeason, "design", "designs");
  pushIfUsed(warnings, "DESIGNS_FABRIC", asFabric, "design", "designs");
  pushIfUsed(warnings, "DESIGNS_MACHINE", asMachine, "design", "designs");
  pushIfUsed(warnings, "DESIGNS_STITCHING", asStitching, "design", "designs");
  pushIfUsed(warnings, "DESIGNS_GRADE", asGrade, "design", "designs");
  pushIfUsed(warnings, "DESIGN_COMPONENTS", asComponents, "component link", "component links");
  pushIfUsed(warnings, "MATERIAL_LINES", asMaterials, "material line", "material lines");
  pushIfUsed(warnings, "WORKFLOW_PATTERNS", asPatternProduct, "workflow pattern", "workflow patterns");
  pushIfUsed(warnings, "CONCEPT_TARGETS", asConceptTargets, "concept target", "concept targets");
  pushIfUsed(warnings, "SAMPLE_MACHINE_TASKS", asSampleMachine, "sample task", "sample tasks");

  return warnings;
}
