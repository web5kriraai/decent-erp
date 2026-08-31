import { z } from "zod";
import { jsonOk, parseBody, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createEmployee,
  listEmployeesForAdmin,
} from "@/lib/services/role-admin-service";

const createSchema = z.object({
  employeeCode: z.string().trim().min(3).max(20).optional(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  roleCode: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function GET() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const employees = await listEmployeesForAdmin();
    return jsonOk(employees, ctx.correlationId);
  });
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const body = await parseBody(request, createSchema);
    const employee = await createEmployee(body);
    return jsonOk(employee, ctx.correlationId, 201);
  });
}
