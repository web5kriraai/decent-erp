"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignImageRecord } from "@/lib/types/api";
import { FileUploader } from "@/components/FileUploader";

type ImageGalleryProps = {
  designId: string;
  canUpload?: boolean;
};

export function ImageGallery({ designId, canUpload = true }: ImageGalleryProps) {
  const imagesQuery = useQuery({
    queryKey: queryKeys.designs.images(designId),
    queryFn: () => apiGet<DesignImageRecord[]>(`/api/designs/${designId}/images`),
    enabled: !!designId,
  });

  async function handleDelete(imageId: string) {
    await fetch(`/api/designs/${designId}/images?imageId=${imageId}`, { method: "DELETE" });
    imagesQuery.refetch();
  }

  return (
    <div>
      {canUpload && (
        <FileUploader designId={designId} onUploaded={() => imagesQuery.refetch()} />
      )}
      <div className="image-gallery" style={{ marginTop: "1rem" }}>
        {(imagesQuery.data ?? []).map((image) => (
          <div key={image.id} className="image-gallery-item">
            {image.contentType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.downloadUrl} alt={image.fileName} className="image-gallery-thumb" />
            ) : (
              <div className="image-gallery-file">{image.fileName}</div>
            )}
            <div className="image-gallery-meta">
              <span>{image.fileName}</span>
              {image.isPrimary && <span className="badge">Primary</span>}
              {canUpload && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDelete(image.id)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {!imagesQuery.isLoading && (imagesQuery.data?.length ?? 0) === 0 && (
          <p style={{ color: "var(--color-neutral-500)", margin: 0 }}>No files uploaded yet</p>
        )}
      </div>
    </div>
  );
}
