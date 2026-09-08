import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getSampleKanbanBoard } from "@/lib/services/sample-kanban-service";

export async function GET() {
  return withApiHandler(
    [PERMISSIONS.DESIGN_CREATE, PERMISSIONS.TASK_EXECUTE, PERMISSIONS.KPI_ADMIN],
    async (ctx) => {
      const board = await getSampleKanbanBoard();
      return jsonOk(serializeBigInt(board), ctx.correlationId);
    },
  );
}
