import type { KeyboardEvent } from "react";

/**
 * Enter submits the primary action; Shift+Enter inserts a newline (native).
 * Use on textareas inside modals and stage-approval remark fields.
 */
export function handleEnterSubmitKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  onSubmit: (() => void) | undefined,
  options?: { disabled?: boolean },
): void {
  if (!onSubmit || options?.disabled) return;
  if (event.key !== "Enter" || event.shiftKey) return;
  if (event.nativeEvent.isComposing) return;
  event.preventDefault();
  onSubmit();
}
