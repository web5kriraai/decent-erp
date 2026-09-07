import { ROUTES } from "@/config/routes";

export type WorkOpenIntent = "task" | "work" | "design";

/**
 * Canonical open URLs so timer + stage actions land on the same task page
 * when a concrete taskId is known.
 */
export function resolveWorkOpenHref(input: {
  taskId?: string | null;
  designId?: string | null;
  intent?: WorkOpenIntent;
}): string | null {
  const intent = input.intent ?? "work";
  if ((intent === "task" || intent === "work") && input.taskId) {
    return ROUTES.work.taskDetail(input.taskId);
  }
  if (input.designId) {
    return ROUTES.designs.detail(input.designId);
  }
  if (input.taskId) {
    return ROUTES.work.taskDetail(input.taskId);
  }
  return null;
}
