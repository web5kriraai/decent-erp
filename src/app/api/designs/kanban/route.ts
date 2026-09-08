import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { buildKanbanWorkflowInfo } from "@/lib/design-workflow";
import { PERMISSIONS } from "@/lib/permissions";
import { getDesignWorkflowDashboard } from "@/lib/services/design-service";
import type {
  DesignTask,
  DesignWorkflowDashboardResponse,
  KanbanDesignItem,
} from "@/lib/types/api";

export async function GET() {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const dashboard = await getDesignWorkflowDashboard();
    const items: KanbanDesignItem[] = dashboard.items.map((raw) => {
      const serialized = serializeBigInt(raw) as unknown as Omit<
        KanbanDesignItem,
        "workflow"
      > & {
        tasks?: DesignTask[];
      };
      const { tasks, ...rest } = serialized;
      return {
        ...rest,
        workflow: buildKanbanWorkflowInfo({ status: rest.status, tasks }),
      };
    });

    const payload: DesignWorkflowDashboardResponse = {
      items,
      summary: dashboard.summary,
    };
    return jsonOk(payload, ctx.correlationId);
  });
}
