"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type PipelineAccordionSection<T> = {
  id: string;
  label: string;
  sequence: number;
  accent: { bg: string; text: string };
  items: T[];
};

type PipelineAccordionBoardProps<T> = {
  sections: PipelineAccordionSection<T>[];
  /** Single open section id, or null when all collapsed. */
  expandedId: string | null;
  onToggle: (sectionId: string) => void;
  renderCard: (item: T, sectionId: string) => ReactNode;
  onDragStart?: (itemId: string) => void;
  onDragEnd?: () => void;
  onDrop?: (sectionId: string) => void;
  getItemId?: (item: T) => string;
  /** Max cards shown per section before "+ N more designs". */
  previewLimit?: number;
  emptyLabel?: string;
  className?: string;
};

export const PIPELINE_PREVIEW_LIMIT = 15;

export function PipelineAccordionBoard<T>({
  sections,
  expandedId,
  onToggle,
  renderCard,
  onDragStart,
  onDragEnd,
  onDrop,
  getItemId,
  previewLimit = PIPELINE_PREVIEW_LIMIT,
  emptyLabel = "No items",
  className,
}: PipelineAccordionBoardProps<T>) {
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());

  function togglePreviewExpanded(sectionId: string) {
    setExpandedPreviews((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  return (
    <div className={cn("pipeline-accordion", className)}>
      {sections.map((section) => {
        const isOpen = expandedId === section.id;
        const previewExpanded = expandedPreviews.has(section.id);
        const visibleItems = previewExpanded
          ? section.items
          : section.items.slice(0, previewLimit);
        const hiddenCount = previewExpanded
          ? 0
          : Math.max(0, section.items.length - previewLimit);

        return (
          <section
            key={section.id}
            className={cn("pipeline-accordion-section", isOpen && "pipeline-accordion-section--open")}
            data-status={section.id}
          >
            <button
              type="button"
              className="pipeline-accordion-trigger"
              aria-expanded={isOpen}
              onClick={() => onToggle(section.id)}
            >
              <span
                className="pipeline-accordion-icon"
                style={{
                  background: section.accent.bg,
                  color: section.accent.text,
                }}
                aria-hidden
              >
                {section.sequence}
              </span>
              <span className="pipeline-accordion-label">{section.label}</span>
              <span className="pipeline-accordion-meta">
                <span className="pipeline-accordion-count">{section.items.length}</span>
                {isOpen ? (
                  <ChevronUp className="pipeline-accordion-chevron" aria-hidden />
                ) : (
                  <ChevronDown className="pipeline-accordion-chevron" aria-hidden />
                )}
              </span>
            </button>

            {isOpen ? (
              <div
                className="pipeline-accordion-panel"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop?.(section.id)}
              >
                {section.items.length === 0 ? (
                  <p className="pipeline-accordion-empty">{emptyLabel}</p>
                ) : (
                  <div className="pipeline-card-grid">
                    {visibleItems.map((item) => {
                      const itemId = getItemId?.(item);
                      return (
                        <div
                          key={itemId ?? section.label}
                          className="pipeline-card-wrap"
                          draggable={!!onDragStart && !!itemId}
                          onDragStart={() => itemId && onDragStart?.(itemId)}
                          onDragEnd={() => onDragEnd?.()}
                        >
                          {renderCard(item, section.id)}
                        </div>
                      );
                    })}
                    {hiddenCount > 0 ? (
                      <button
                        type="button"
                        className="pipeline-card pipeline-card--more"
                        aria-label={`Show ${hiddenCount} more designs`}
                        onClick={() => togglePreviewExpanded(section.id)}
                      >
                        +{hiddenCount} more designs
                      </button>
                    ) : null}
                    {previewExpanded && section.items.length > previewLimit ? (
                      <button
                        type="button"
                        className="pipeline-card pipeline-card--more"
                        aria-label="Show fewer designs"
                        onClick={() => togglePreviewExpanded(section.id)}
                      >
                        Show fewer designs
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
