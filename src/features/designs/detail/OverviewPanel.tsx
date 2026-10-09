"use client";

import { useQuery } from "@tanstack/react-query";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { DesignImageRecord, DesignSummary } from "@/lib/types/api";
import { useState } from "react";

export function OverviewPanel({
  design,
  onEditComponents,
  canEdit,
}: {
  design: DesignSummary;
  onEditComponents?: () => void;
  canEdit?: boolean;
}) {
  const imagesQuery = useQuery({
    queryKey: queryKeys.designs.images(design.id),
    queryFn: () => apiGet<DesignImageRecord[]>(`/api/designs/${design.id}/images`),
    enabled: !!design.id,
  });
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const imageRows = (imagesQuery.data ?? []).filter(
    (image) => (image.mediaKind ?? "IMAGE") === "IMAGE",
  );
  const createdLabel = design.createdAtUtc
    ? new Date(design.createdAtUtc).toLocaleDateString()
    : "-";
  const endLabel = design.targetEndDate
    ? new Date(design.targetEndDate).toLocaleDateString()
    : "-";

  return (
    <div className="grid grid-cols-1 gap-4">
      <AppCard title="Concept information">
        <dl className="design-detail-facts">
          <div>
            <dt>Product</dt>
            <dd>{design.productType?.name ?? "-"}</dd>
          </div>
          <div>
            <dt>Season</dt>
            <dd>{design.season?.name ?? "-"}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{design.priority}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{createdLabel}</dd>
          </div>
          <div>
            <dt>End date</dt>
            <dd>{endLabel}</dd>
          </div>
          <div>
            <dt>Style</dt>
            <dd>{design.styleName?.trim() || "-"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt>Note</dt>
            <dd>{design.conceptNote?.trim() || "-"}</dd>
          </div>
        </dl>
      </AppCard>
      <AppCard title="Components">
        <div className="space-y-3">
          {(design.components ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No components yet.</p>
          ) : (
            <div className="component-view-grid">
              {(design.components ?? []).map((component) => {
                const photos = imageRows.filter(
                  (image) => image.designComponentId === component.id,
                );
                const name = component.componentType?.name ?? "Component";
                return (
                  <article key={component.id} className="component-view-card">
                    <p className="component-view-name">{name}</p>
                    {photos.length === 0 ? (
                      <div className="component-view-empty">No image for this component.</div>
                    ) : (
                      <div className="component-view-photos">
                        {photos.map((photo) => (
                          <button
                            key={photo.id}
                            type="button"
                            className="component-view-photo"
                            title={photo.isPrimary ? `${name} · shown outside` : name}
                            onClick={() =>
                              setLightbox({
                                url: photo.downloadUrl,
                                title: `${name} · ${photo.fileName}`,
                              })
                            }
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.downloadUrl} alt={name} />
                            {photo.isPrimary ? (
                              <span className="component-view-badge">Shown outside</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
        {canEdit && onEditComponents ? (
          <AppButton
            type="button"
            appVariant="outline"
            size="sm"
            className="mt-4"
            onClick={onEditComponents}
          >
            Edit Components
          </AppButton>
        ) : null}
      </AppCard>
      <ImageLightboxModal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        imageUrl={lightbox?.url}
        title={lightbox?.title ?? "Component image"}
      />
    </div>
  );
}
