import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

/**
 * Legacy Pipeline Board URL — redirects to Dashboard.
 * DesignKanbanView stays the source of truth (rendered on /dashboard for Design Head / Admin).
 */
export default function DesignKanbanPage() {
  redirect(ROUTES.dashboard);
}
