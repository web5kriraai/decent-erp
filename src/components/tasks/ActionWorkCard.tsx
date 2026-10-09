"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ImageLightboxModal } from "@/components/ui/ImageLightboxModal";
import type { Priority } from "@/lib/types/api";
import { cn } from "@/lib/utils";

export type ActionWorkCardMeta = {
  label: string;
  value: string;
};

export type ActionWorkCardProps = {
  href: string;
  designTitle: string;
  ideaRef: string;
  stageName: string;
  imageUrl?: string | null;
  imageFallback?: string;
  priority: Priority;
  status: string;
  meta?: ActionWorkCardMeta[];
  /** Role, assignee, assigned time, and deadline. */
  details?: string[];
  /** Due date, blocked reason, or completion hint. */
  hint?: string | null;
  hintTone?: "default" | "muted" | "warning";
  footerAction?: ReactNode;
  selected?: boolean;
  active?: boolean;
  waiting?: boolean;
  onSelect?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
};

/**
 * My Tasks card. Same image, badges, and meta grid as the workflow board card.
 * The card opens the task. Image view and footer buttons keep their own clicks.
 */
export function ActionWorkCard({
  href,
  designTitle,
  ideaRef,
  stageName,
  imageUrl,
  imageFallback,
  priority,
  status,
  meta,
  details,
  hint,
  hintTone = "default",
  footerAction,
  selected,
  active,
  waiting,
  onSelect,
  onKeyDown,
  className,
}: ActionWorkCardProps) {
  const router = useRouter();
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const showImage = Boolean(imageUrl) && failedImageUrl !== imageUrl;
  const fallbackLabel = imageFallback?.trim() || "No image";
  const metaItems =
    meta ??
    (details ?? []).map((line) => {
      const split = line.indexOf(" ");
      if (split <= 0) return { label: "Detail", value: line };
      return { label: line.slice(0, split), value: line.slice(split + 1) };
    });

  function openTask() {
    onSelect?.();
    router.push(href);
  }

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (target?.closest("a, button, input, select, textarea, [data-card-no-nav]")) {
      return;
    }
    openTask();
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openTask();
    }
  }

  return (
    <>
      <article
        className={cn(
          "workflow-dash-card task-card--openable",
          selected && "task-card--selected",
          active && "task-card--active",
          waiting && "task-card--waiting",
          className,
        )}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        role="link"
        tabIndex={0}
        aria-label={`${designTitle} · ${stageName}. Open task.`}
        aria-current={active ? "true" : undefined}
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
                onError={() => setFailedImageUrl(imageUrl ?? null)}
              />
              <span className="workflow-dash-card__open-hint">View image</span>
            </button>
          ) : (
            <div className="workflow-dash-card__fallback" aria-hidden>
              <span className="workflow-dash-card__fallback-label">{fallbackLabel}</span>
            </div>
          )}
          <div className="workflow-dash-card__badges">
            <span className="workflow-dash-card__stage">{stageName}</span>
            <PriorityBadge priority={priority} />
          </div>
        </div>

        <div className="workflow-dash-card__body">
          <div className="workflow-dash-card__top">
            <span className="workflow-dash-card__ref">{ideaRef}</span>
            <Link
              href={href}
              className="workflow-dash-card__full-page"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.();
              }}
            >
              Open
            </Link>
          </div>
          <p className="workflow-dash-card__title">{designTitle}</p>

          {metaItems.length > 0 ? (
            <dl className="workflow-dash-card__meta">
              {metaItems.map((item) => (
                <div key={item.label} className="workflow-dash-card__meta-item">
                  <dt>{item.label}</dt>
                  <dd title={item.value}>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {hint ? (
            <p
              className={cn(
                "task-card-hint",
                hintTone === "muted" && "task-card-hint--muted",
                hintTone === "warning" && "task-card-hint--warning",
              )}
            >
              {hint}
            </p>
          ) : null}

          <div className="task-card-meta">
            <StatusBadge status={status} />
            {footerAction ? (
              <div className="task-card-meta-action" data-card-no-nav>
                {footerAction}
              </div>
            ) : null}
          </div>
        </div>
      </article>

      <ImageLightboxModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={imageUrl}
        title={ideaRef}
        description={designTitle}
      />
    </>
  );
}
