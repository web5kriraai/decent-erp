"use client";

import type { ComponentProps } from "react";
import { IconGripVertical } from "@/components/icons";
import { cn } from "@/lib/utils";

type DragHandleProps = ComponentProps<"button"> & {
  label?: string;
};

/** Grabber for row reorder - use with useRowDragReorder handle props. */
export function DragHandle({
  label = "Drag to reorder",
  className,
  disabled,
  ...props
}: DragHandleProps) {
  return (
    <button
      type="button"
      className={cn("drag-handle", className)}
      title={label}
      aria-label={label}
      disabled={disabled}
      {...props}
    >
      <IconGripVertical size={16} aria-hidden />
    </button>
  );
}
