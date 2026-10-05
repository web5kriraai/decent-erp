import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { scanAndNotifyTaskDues } from "@/lib/services/task-due-notification-service";

/** Manual / external-cron trigger for due-soon and overdue notifications (Spec §17). */
export async function POST() {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const result = await scanAndNotifyTaskDues(ctx.correlationId);
    return jsonOk(result, ctx.correlationId);
  });
}
