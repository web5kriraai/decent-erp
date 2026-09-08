"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconAlertCircle } from "@/components/icons";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignImageRecord } from "@/lib/types/api";
import { ConceptMediaPanel } from "@/components/ConceptMediaPanel";
import { AppButton } from "@/components/ui/AppButton";

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
          const sizeLabel = formatBytes(image.fileSize);
          const ext = image.fileName?.includes(".")
            ? image.fileName.split(".").pop()?.toUpperCase()
            : "FILE";

          return (
            <div
              key={image.id}
              id={`design-file-${image.id}`}
              ref={isHighlighted ? highlightRef : undefined}
              className={`image-gallery-item${isRejected ? " image-gallery-item--rejected" : ""}${
                isHighlighted ? " ring-2 ring-primary" : ""
              }`}
            >
              <div className="image-gallery-preview">
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
                  <img
                    src={image.downloadUrl}
                    alt={image.fileName}
                    className="image-gallery-thumb"
                  />
                ) : kind === "AUDIO" ? (
                  <audio controls src={image.downloadUrl} className="image-gallery-audio" />
                ) : kind === "VIDEO" ? (
                  <video controls src={image.downloadUrl} className="image-gallery-video" />
                ) : (
                  <div className="image-gallery-file" title={image.fileName}>
                    <span className="image-gallery-file-ext">{ext}</span>
                    {sizeLabel ? (
                      <span className="image-gallery-file-size">{sizeLabel}</span>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="image-gallery-meta">
                <p className="image-gallery-name" title={image.fileName}>
                  {image.fileName}
                </p>
                <div className="image-gallery-footer">
                  <span className="badge">{kind}</span>
                  {!isRejected && image.downloadUrl ? (
                    <a
                      href={image.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={image.fileName}
                      className="image-gallery-download"
                    >
                      Download
                    </a>
                  ) : null}
                </div>
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
