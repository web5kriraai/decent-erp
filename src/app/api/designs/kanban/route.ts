import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { buildKanbanWorkflowInfo } from "@/lib/design-workflow";
import { PERMISSIONS } from "@/lib/permissions";
import { listDesignsForKanban } from "@/lib/services/design-service";
import type { DesignTask, KanbanDesignItem } from "@/lib/types/api";

export async function GET() {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const designs = await listDesignsForKanban();
    const items: KanbanDesignItem[] = designs.map((design) => {
      const serialized = serializeBigInt(design) as unknown as Omit<KanbanDesignItem, "workflow"> & {
        tasks?: DesignTask[];
      };
      const { tasks, ...rest } = serialized;
      return {
        ...rest,
        workflow: buildKanbanWorkflowInfo({ status: rest.status, tasks }),
      };
    });
    return jsonOk(items, ctx.correlationId);
  });
}
