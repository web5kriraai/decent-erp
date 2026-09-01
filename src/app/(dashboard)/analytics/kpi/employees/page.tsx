import { redirect } from "next/navigation";
import { ROUTES } from "@/config/routes";

export default function KpiEmployeesPage() {
  redirect(ROUTES.analytics.kpi);
}
