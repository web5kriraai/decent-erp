"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";

type UseRowDragReorderOptions = {
  enabled?: boolean;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

/**
 * HTML5 drag-and-drop helpers for reordering list/table rows via a drag handle.
 */
export function useRowDragReorder({ enabled = true, onReorder }: UseRowDragReorderOptions) {
  const dragIndexRef = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const reset = useCallback(() => {
    dragIndexRef.current = null;
    setOverIndex(null);
    setDraggingIndex(null);
  }, []);

  const getHandleProps = useCallback(
    (index: number) => ({
      draggable: enabled,
      onDragStart: (event: DragEvent) => {
        if (!enabled) return;
        dragIndexRef.current = index;
        setDraggingIndex(index);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
        try {
          event.dataTransfer.setDragImage(event.currentTarget as Element, 12, 12);
        } catch {
          /* ignore browsers that reject setDragImage */
        }
      },
      onDragEnd: () => {
        reset();
      },
    }),
    [enabled, reset],
  );

  const getRowProps = useCallback(
    (index: number) => ({
      onDragOver: (event: DragEvent) => {
        if (!enabled || dragIndexRef.current == null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (overIndex !== index) setOverIndex(index);
      },
      onDragLeave: () => {
        if (overIndex === index) setOverIndex(null);
      },
      onDrop: (event: DragEvent) => {
        if (!enabled) return;
        event.preventDefault();
        const from = dragIndexRef.current;
        reset();
        if (from == null || from === index) return;
        onReorder(from, index);
      },
      "data-dragging": draggingIndex === index ? "true" : undefined,
      "data-drag-over": overIndex === index && draggingIndex !== index ? "true" : undefined,
    }),
    [enabled, onReorder, overIndex, draggingIndex, reset],
  );

  return { getHandleProps, getRowProps, draggingIndex, overIndex };
}
