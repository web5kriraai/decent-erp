import { getTaskTimeDetail } from "../src/lib/services/time-service.ts";
import { serializeBigInt } from "../src/lib/api-utils.ts";

try {
  const task = await getTaskTimeDetail(2n, 1, ["TASK_EXECUTE", "TIME_VIEW_TEAM", "MASTER_ADMIN"]);
  const serialized = serializeBigInt(task);
  JSON.stringify(serialized);
  console.log("OK", serialized.id, serialized.design.id, serialized.timeline.length);
} catch (e) {
  console.error("FAIL", e);
}
