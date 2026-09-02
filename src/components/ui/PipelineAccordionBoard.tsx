"use client";

import type { ReactNode } from "react";
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
  return (
    <div className={cn("pipeline-accordion", className)}>
      {sections.map((section) => {
        const isOpen = expandedId === section.id;
        const visibleItems = section.items.slice(0, previewLimit);
        const hiddenCount = Math.max(0, section.items.length - previewLimit);

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
                      <div className="pipeline-card pipeline-card--more" aria-label={`${hiddenCount} more designs`}>
                        +{hiddenCount} more designs
                      </div>
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
