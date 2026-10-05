import { DesignDetailView } from "@/features/designs/DesignDetailView";
import { designDetailMetadata } from "@/config/page-metadata";
import type { DesignDetailTab } from "@/features/designs/DesignDetailModalProvider";

const DETAIL_TABS: DesignDetailTab[] = [
  "overview",
  "corrections",
  "costing",
  "kra-kpi",
  "files",
  "approvals",
];

type PageProps = {
  params: Promise<{ designId: string }>;
  searchParams: Promise<{ setup?: string; image?: string; tab?: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { designId } = await params;
  return designDetailMetadata(designId);
}

export default async function DesignDetailPage({ params, searchParams }: PageProps) {
  const { designId } = await params;
  const { setup, image, tab } = await searchParams;
  const initialTab =
    tab && DETAIL_TABS.includes(tab as DesignDetailTab)
      ? (tab as DesignDetailTab)
      : undefined;
  return (
    <DesignDetailView
      designId={designId}
      showConceptSetup={setup === "images"}
      highlightImageId={image ?? null}
      initialTab={initialTab}
    />
  );
}
