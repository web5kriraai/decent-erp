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

/** Usage counts for soft-deactivate warnings only — never blocks retirement. */
export async function getProcessUsage(processId: number): Promise<MasterUsageWarning[]> {
  const [designTasks, patternTasks, designProcesses, mappings, activeChildren] =
    await Promise.all([
      prisma.designTask.count({ where: { processId } }),
      prisma.workflowPatternTask.count({ where: { processId } }),
      prisma.designProcess.count({ where: { processId } }),
      prisma.productProcessMapping.count({ where: { processId } }),
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
    "PRODUCT_MAPPINGS",
    mappings,
    "product–process mapping",
    "product–process mappings",
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

/** Usage counts for soft-deactivate warnings only — never blocks retirement. */
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
