import { RequestSignOffView } from "@/features/quality/RequestSignOffView";
import { requestSignOffMetadata } from "@/config/page-metadata";

type PageProps = {
  params: Promise<{ designId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { designId } = await params;
  return requestSignOffMetadata(designId);
}

export default async function RequestSignOffPage({ params }: PageProps) {
  const { designId } = await params;
  return <RequestSignOffView designId={designId} />;
}
