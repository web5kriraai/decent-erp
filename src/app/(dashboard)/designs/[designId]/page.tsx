import { DesignDetailView } from "@/features/designs/DesignDetailView";

type PageProps = { params: Promise<{ designId: string }> };

export default async function DesignDetailPage({ params }: PageProps) {
  const { designId } = await params;
  return <DesignDetailView designId={designId} />;
}
