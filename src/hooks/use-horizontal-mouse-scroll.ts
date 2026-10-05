"use client";

import { useCallback, useRef, type RefCallback } from "react";

type Options = {
  /** CSS selector for nested vertical scroll areas (e.g. column card lists). */
  verticalScrollSelector?: string;
  /** Enable click-and-drag panning on empty board chrome. Default true. */
  dragToScroll?: boolean;
};

/**
 * Makes a horizontal overflow container pan with the mouse wheel (and optional
 * click-drag). Nested vertical scroll regions keep their wheel until they hit
 * an edge, then overflow scrolls the board sideways.
 *
 * Uses a callback ref so listeners attach when the node mounts after async UI
 * (e.g. QueryState loading → board).
 */
export function useHorizontalMouseScroll<T extends HTMLElement>(
  options: Options = {},
): RefCallback<T> {
  const {
    verticalScrollSelector = ".kanban-cards",
    dragToScroll = true,
  } = options;

  const optionsRef = useRef({ verticalScrollSelector, dragToScroll });
  optionsRef.current = { verticalScrollSelector, dragToScroll };

  const cleanupRef = useRef<(() => void) | null>(null);

  return useCallback((el: T | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!el) return;

    const { verticalScrollSelector: nestedSel, dragToScroll: enableDrag } =
      optionsRef.current;

    const canScrollX = () => el.scrollWidth > el.clientWidth + 1;

    const onWheel = (event: WheelEvent) => {
      if (!canScrollX()) return;

      // Trackpads / shift+wheel already provide horizontal delta.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const nested = nestedSel
        ? (event.target as Element | null)?.closest?.(nestedSel)
        : null;
      if (nested instanceof HTMLElement && nested.scrollHeight > nested.clientHeight + 1) {
        const atTop = nested.scrollTop <= 0;
        const atBottom =
          nested.scrollTop + nested.clientHeight >= nested.scrollHeight - 1;
        const scrollingUp = event.deltaY < 0;
        const scrollingDown = event.deltaY > 0;
        if ((scrollingUp && !atTop) || (scrollingDown && !atBottom)) {
          return;
        }
      }

      event.preventDefault();
      el.scrollLeft += event.deltaY + event.deltaX;
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    if (!enableDrag) {
      cleanupRef.current = () => {
        el.removeEventListener("wheel", onWheel);
      };
      return;
    }

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startScrollLeft = 0;
    const DRAG_THRESHOLD = 4;

    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          "a, button, input, textarea, select, [role='button'], [data-no-drag-scroll]",
        ),
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !canScrollX()) return;
      if (isInteractiveTarget(event.target)) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startScrollLeft = el.scrollLeft;
      el.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      if (!moved && Math.abs(dx) < DRAG_THRESHOLD) return;
      moved = true;
      el.classList.add("is-drag-scrolling");
      el.scrollLeft = startScrollLeft - dx;
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("is-drag-scrolling");
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!moved) return;
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClickCapture, true);

    cleanupRef.current = () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClickCapture, true);
      el.classList.remove("is-drag-scrolling");
    };
  }, []);
}
