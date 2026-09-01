import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const taskId = BigInt(process.argv[2] ?? "421");

try {
  const task = await prisma.designTask.findUnique({
    where: { id: taskId },
    include: {
      subProcess: true,
      process: true,
      assignedEmployee: true,
      design: { select: { ideaRef: true } },
    },
  });
  console.log(JSON.stringify(task, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));

  if (task) {
    const siblings = await prisma.designTask.findMany({
      where: { designId: task.designId },
      orderBy: { sequence: "asc" },
      select: {
        id: true,
        sequence: true,
        dependencySequence: true,
        status: true,
        assignedEmployeeId: true,
        subProcess: { select: { code: true, name: true } },
        assignedEmployee: { select: { name: true } },
      },
    });
    console.log(
      "SIBLINGS:",
      JSON.stringify(siblings, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
    );
  }
} finally {
  await prisma.$disconnect();
}
