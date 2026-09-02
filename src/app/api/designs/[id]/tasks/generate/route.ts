import { z } from "zod";
import { jsonOk, parseBody, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { generateTasksFromPattern } from "@/lib/services/design-service";

const schema = z.object({
  workflowPatternId: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.DESIGN_ASSIGN, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, schema);
    await generateTasksFromPattern(
      BigInt(id),
      body.workflowPatternId,
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk({ generated: true }, ctx.correlationId);
  });
}
