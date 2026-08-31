import { DesignCreateForm } from "@/features/designs/DesignCreateForm";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("designsNew");

export default function NewDesignPage() {
  return <DesignCreateForm />;
}
