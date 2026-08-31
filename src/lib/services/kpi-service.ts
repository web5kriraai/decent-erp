import { prisma } from "@/lib/db";

export async function getEmployeeKpiDashboard(employeeId?: number) {
  const where = employeeId ? { employeeId } : {};
  return prisma.employeeKpiScore.findMany({
    where,
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    include: {
      employee: { select: { id: true, name: true, employeeCode: true } },
    },
  });
}

export async function getDesignHeadKpi() {
  return prisma.employeeKpiScore.findMany({
    where: {
      employee: { role: { code: "DESIGN_HEAD" } },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    include: {
      employee: { select: { id: true, name: true } },
    },
  });
}

export async function getProcessMasters() {
  return prisma.designProcessMaster.findMany({
    where: { active: true },
    orderBy: { sequence: "asc" },
    include: {
      subProcesses: {
        where: { active: true },
        orderBy: { sequence: "asc" },
      },
    },
  });
}

export async function getWorkflowPatterns() {
  return prisma.workflowPattern.findMany({
    where: { active: true },
    include: {
      tasks: { orderBy: { sequence: "asc" } },
      productType: true,
    },
  });
}
