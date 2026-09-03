"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignImageRecord } from "@/lib/types/api";
import { FileUploader } from "@/components/FileUploader";
import { AppButton } from "@/components/ui/AppButton";
import { useApiToast } from "@/components/ui/ToastProvider";

type ImageGalleryProps = {
  designId: string;
  canUpload?: boolean;
  highlightImageId?: string | null;
};

export function ImageGallery({
  designId,
  canUpload = true,
  highlightImageId = null,
}: ImageGalleryProps) {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const imagesQuery = useQuery({
    queryKey: queryKeys.designs.images(designId),
    queryFn: () => apiGet<DesignImageRecord[]>(`/api/designs/${designId}/images`),
    enabled: !!designId,
  });

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
    <div>
      {canUpload && (
        <FileUploader designId={designId} onUploaded={() => imagesQuery.refetch()} />
      )}
      <div className="image-gallery mt-4">
        {(imagesQuery.data ?? []).map((image) => {
          const isRejected = image.reviewStatus === "REJECTED";
          const isHighlighted = highlightImageId === image.id;
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
                  <AlertCircleIcon className="image-gallery-rejected-icon" aria-hidden />
                  <p className="image-gallery-rejected-name">{image.fileName}</p>
                  <p className="image-gallery-rejected-label">Image not approved</p>
                  <p className="image-gallery-rejected-hint">
                    {image.reviewNote ?? "Click to view error"}
                  </p>
                </div>
              ) : image.contentType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.downloadUrl} alt={image.fileName} className="image-gallery-thumb" />
              ) : (
                <div className="image-gallery-file">{image.fileName}</div>
              )}
              <div className="image-gallery-meta">
                {!isRejected ? <span>{image.fileName}</span> : null}
                {image.isPrimary && <span className="badge">Primary</span>}
                {canUpload && !image.isPrimary && !isRejected && (
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
        {!imagesQuery.isLoading && (imagesQuery.data?.length ?? 0) === 0 && (
          <p className="m-0 text-sm text-[var(--color-neutral-500)]">No files uploaded yet</p>
        )}
      </div>
    </div>
  );
}
