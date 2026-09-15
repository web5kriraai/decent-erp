"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import { masterDisplayName } from "@/lib/master-display";
import type { Priority } from "@/lib/types/api";

export type WorkflowBoardCardMeta = {
  label: string;
  value: string;
};

type WorkflowBoardCardProps = {
  ideaRef: string;
  title: string;
  laneLabel: string;
  priority: Priority;
  productType?: { name?: string | null; code?: string | null } | null;
  primaryImageUrl?: string | null;
  detailHref: string;
  meta: WorkflowBoardCardMeta[];
  footer?: ReactNode;
  onOpenCard?: () => void;
};

/**
 * Shared kanban card: fixed image area (or product-name fallback),
 * non-overlapping meta grid, image opens in-page lightbox modal.
 */
export function WorkflowBoardCard({
  ideaRef,
  title,
  laneLabel,
  priority,
  productType,
  primaryImageUrl,
  detailHref,
  meta,
  footer,
  onOpenCard,
}: WorkflowBoardCardProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imageUrl = primaryImageUrl ?? null;
  const productLabel = masterDisplayName(productType?.name, productType?.code);
  const showImage = Boolean(imageUrl) && failedImageUrl !== imageUrl;

  return (
    <>
      <article
        className="workflow-dash-card"
        role={onOpenCard ? "button" : undefined}
        tabIndex={onOpenCard ? 0 : undefined}
        onClick={onOpenCard}
        onKeyDown={
          onOpenCard
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenCard();
                }
              }
            : undefined
        }
      >
        <div className="workflow-dash-card__visual">
          {showImage ? (
            <button
              type="button"
              className="workflow-dash-card__img-btn"
              title="View full image"
              aria-label={`View full image for ${ideaRef}`}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs */}
              <img
                key={imageUrl}
                src={imageUrl!}
                alt=""
                className="workflow-dash-card__img"
                onError={() => setFailedImageUrl(imageUrl)}
              />
              <span className="workflow-dash-card__open-hint">View image</span>
            </button>
          ) : (
            <div className="workflow-dash-card__fallback" aria-hidden>
              <span className="workflow-dash-card__fallback-label">
                {productLabel === "—" ? "No image" : productLabel}
              </span>
            </div>
          )}
          <div className="workflow-dash-card__badges">
            <span className="workflow-dash-card__stage">{laneLabel}</span>
            <PriorityBadge priority={priority} />
          </div>
        </div>

        <div className="workflow-dash-card__body">
          <div className="workflow-dash-card__top">
            <button
              type="button"
              className="workflow-dash-card__ref text-left"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCard?.();
              }}
            >
              {ideaRef}
            </button>
            <Link
              href={detailHref}
              className="workflow-dash-card__full-page"
              onClick={(e) => e.stopPropagation()}
            >
              Full page
            </Link>
          </div>
          <p className="workflow-dash-card__title">{title}</p>

          <dl className="workflow-dash-card__meta">
            {meta.map((item) => (
              <div key={item.label} className="workflow-dash-card__meta-item">
                <dt>{item.label}</dt>
                <dd title={item.value}>{item.value}</dd>
              </div>
            ))}
          </dl>

          {footer}
        </div>
      </article>

      <ImageLightboxModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={imageUrl}
        title={ideaRef}
        description={title}
      />
    </>
  );
}

export function buildProductSeasonOwnerDueMeta(input: {
  productType?: { name?: string | null; code?: string | null } | null;
  seasonName?: string | null;
  ownerName?: string | null;
  dueLabel: string;
}): WorkflowBoardCardMeta[] {
  return [
    {
      label: "Product",
      value: masterDisplayName(input.productType?.name, input.productType?.code),
    },
    {
      label: "Season",
      value: masterDisplayName(input.seasonName, null),
    },
    {
      label: "Owner",
      value: input.ownerName?.trim() || "—",
    },
    {
      label: "Due",
      value: input.dueLabel,
    },
  ];
}
