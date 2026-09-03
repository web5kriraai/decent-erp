"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignImageRecord } from "@/lib/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TaskCompareVersionsPanelProps = {
  designId: string;
};

function pickComparisonImages(images: DesignImageRecord[]) {
  const approved = images.filter((img) => img.reviewStatus !== "REJECTED");
  const primary = approved.find((img) => img.isPrimary) ?? approved[0] ?? null;
  const nonPrimary = approved
    .filter((img) => img.id !== primary?.id)
    .sort(
      (a, b) =>
        new Date(b.uploadedAtUtc).getTime() - new Date(a.uploadedAtUtc).getTime(),
    );
  const latest = nonPrimary[0] ?? null;
  return { primary, latest };
}

function ImagePane({
  label,
  image,
  emptyHint,
}: {
  label: string;
  image: DesignImageRecord | null;
  emptyHint: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {image ? (
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          {image.contentType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.downloadUrl}
              alt={image.fileName}
              className="max-h-40 w-full object-contain bg-background"
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">{image.fileName}</div>
          )}
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            {image.fileName}
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {emptyHint}
        </p>
      )}
    </div>
  );
}

export function TaskCompareVersionsPanel({ designId }: TaskCompareVersionsPanelProps) {
  const imagesQuery = useQuery({
    queryKey: queryKeys.designs.images(designId),
    queryFn: () => apiGet<DesignImageRecord[]>(`/api/designs/${designId}/images`),
    enabled: !!designId,
  });

  const { primary, latest } = useMemo(
    () => pickComparisonImages(imagesQuery.data ?? []),
    [imagesQuery.data],
  );

  if (imagesQuery.isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Compare versions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading design files…</p>
        </CardContent>
      </Card>
    );
  }

  if (!primary && !latest) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Compare versions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <ImagePane label="Primary / baseline" image={primary} emptyHint="No primary file yet." />
          <ImagePane
            label="Latest revision"
            image={latest}
            emptyHint={primary ? "No additional revision uploaded." : "No files to compare."}
          />
        </div>
      </CardContent>
    </Card>
  );
}
