import { prisma } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 403 });
  }

  await seedDatabase();
  return Response.json({ ok: true, message: "Seed completed" });
}
