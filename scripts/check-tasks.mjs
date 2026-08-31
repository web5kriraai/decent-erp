import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tasks = await prisma.designTask.findMany({
  take: 10,
  include: { design: { select: { id: true, ideaRef: true } } },
});

console.log(
  tasks.map((t) => ({
    taskId: t.id.toString(),
    designId: t.designId.toString(),
    ideaRef: t.design.ideaRef,
    status: t.status,
  })),
);

await prisma.$disconnect();
