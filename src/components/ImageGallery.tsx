"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IconAlertCircle } from "@/components/icons";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignImageRecord } from "@/lib/types/api";
import { ConceptMediaPanel } from "@/components/ConceptMediaPanel";
import { AppButton } from "@/components/ui/AppButton";
import { useApiToast } from "@/components/ui/ToastProvider";

type ImageGalleryProps = {
  designId: string;
  canUpload?: boolean;
  highlightImageId?: string | null;
  components?: Array<{ id: string; label: string }>;
  /** Hide the upload/record panel when parent already renders ConceptMediaPanel. */
  showUploader?: boolean;
};

type MediaFilter = "ALL" | "IMAGE" | "AUDIO" | "VIDEO" | "FILE";

function formatBytes(raw: string | number | undefined): string {
  const n = typeof raw === "string" ? Number(raw) : raw ?? 0;
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageGallery({
  designId,
  canUpload = true,
  highlightImageId = null,
  components,
  showUploader = true,
}: ImageGalleryProps) {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<MediaFilter>("ALL");

  const imagesQuery = useQuery({
    queryKey: queryKeys.designs.images(designId),
    queryFn: () => apiGet<DesignImageRecord[]>(`/api/designs/${designId}/images`),
    enabled: !!designId,
  });

  const rows = useMemo(() => {
    const all = imagesQuery.data ?? [];
    if (filter === "ALL") return all;
    return all.filter((r) => (r.mediaKind ?? "IMAGE") === filter);
  }, [filter, imagesQuery.data]);

  useEffect(() => {
    if (!highlightImageId || !imagesQuery.data?.length) return;
    highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlightImageId, imagesQuery.data]);

  async function handleDelete(imageId: string) {
    await fetch(`/api/designs/${designId}/images?imageId=${imageId}`, { method: "DELETE" });
    imagesQuery.refetch();
  }

  async function handleSetPrimary(imageId: string) {
    const res = await fetch(`/api/designs/${designId}/images?imageId=${imageId}`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.errorFromApi(
        new Error(typeof json.error === "string" ? json.error : "Could not set primary image"),
        "Could not set primary image",
      );
      return;
    }
    toast.success("Primary image updated");
    await queryClient.invalidateQueries({ queryKey: queryKeys.designs.images(designId) });
  }

  return (
    <div className="vstack vstack--loose w-full">
      {canUpload && showUploader ? (
        <ConceptMediaPanel
          designId={designId}
          canUpload={canUpload}
          components={components}
          onUploaded={() => imagesQuery.refetch()}
        />
      ) : null}
      <div className="flex w-full flex-wrap gap-2">
        {(["ALL", "IMAGE", "AUDIO", "VIDEO", "FILE"] as MediaFilter[]).map((f) => (
          <AppButton
            key={f}
            type="button"
            size="sm"
            appVariant={filter === f ? "primary" : "secondary"}
            onClick={() => setFilter(f)}
          >
            {f === "ALL"
              ? "All"
              : f === "IMAGE"
                ? "Images"
                : f === "AUDIO"
                  ? "Voice"
                  : f === "VIDEO"
                    ? "Video"
                    : "Files"}
          </AppButton>
        ))}
      </div>
      <div className="image-gallery">
        {rows.map((image) => {
          const isRejected = image.reviewStatus === "REJECTED";
          const isHighlighted = highlightImageId === image.id;
          const kind = image.mediaKind ?? "IMAGE";
          return (
            <div
              key={image.id}
              id={`design-file-${image.id}`}
              ref={isHighlighted ? highlightRef : undefined}
              className={`image-gallery-item${isRejected ? " image-gallery-item--rejected" : ""}${
                isHighlighted ? " ring-2 ring-primary" : ""
              }`}
            >
              {isRejected ? (
                <div className="image-gallery-rejected">
                  <IconAlertCircle className="image-gallery-rejected-icon" aria-hidden />
                  <p className="image-gallery-rejected-name">{image.fileName}</p>
                  <p className="image-gallery-rejected-label">Not approved</p>
                  <p className="image-gallery-rejected-hint">
                    {image.reviewNote ?? "Click to view error"}
                  </p>
                </div>
              ) : kind === "IMAGE" && image.contentType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.downloadUrl} alt={image.fileName} className="image-gallery-thumb" />
              ) : kind === "AUDIO" ? (
                <audio controls src={image.downloadUrl} className="w-full" />
              ) : kind === "VIDEO" ? (
                <video controls src={image.downloadUrl} className="w-full" style={{ maxHeight: 180 }} />
              ) : (
                <div className="image-gallery-file">
                  <p className="m-0 font-medium">{image.fileName}</p>
                  <p className="m-0 mt-1 text-xs opacity-80">
                    {formatBytes(image.fileSize)}
                    {image.contentType ? ` · ${image.contentType}` : ""}
                  </p>
                  <a
                    href={image.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-medium underline underline-offset-2"
                  >
                    Download
                  </a>
                </div>
              )}
              <div className="image-gallery-meta">
                {!isRejected && kind !== "FILE" ? <span>{image.fileName}</span> : null}
                <span className="badge">{kind}</span>
                {image.isPrimary && <span className="badge">Primary</span>}
                {canUpload && kind === "IMAGE" && !image.isPrimary && !isRejected && (
                  <AppButton
                    type="button"
                    appVariant="ghost"
                    size="sm"
                    onClick={() => void handleSetPrimary(image.id)}
                  >
                    Set primary
                  </AppButton>
                )}
                {canUpload && (
                  <AppButton
                    type="button"
                    appVariant="ghost"
                    size="sm"
                    onClick={() => handleDelete(image.id)}
                  >
                    Remove
                  </AppButton>
                )}
              </div>
            </div>
          );
        })}
        {!imagesQuery.isLoading && rows.length === 0 && (
          <p className="m-0 text-sm text-[var(--color-neutral-500)]">No files uploaded yet</p>
        )}
      </div>
    </div>
  );
}
