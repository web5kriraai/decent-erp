import { EmployeeTimeView } from "@/features/time/EmployeeTimeView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("workTime");

export default function MyTimePage() {
  return <EmployeeTimeView />;
}
