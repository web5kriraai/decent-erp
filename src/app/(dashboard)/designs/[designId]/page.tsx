import { DesignDetailView } from "@/features/designs/DesignDetailView";
import { designDetailMetadata } from "@/config/page-metadata";

type PageProps = {
  params: Promise<{ designId: string }>;
  searchParams: Promise<{ setup?: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { designId } = await params;
  return designDetailMetadata(designId);
}

export default async function DesignDetailPage({ params, searchParams }: PageProps) {
  const { designId } = await params;
  const { setup } = await searchParams;
  return (
    <DesignDetailView designId={designId} showConceptSetup={setup === "images"} />
  );
}
