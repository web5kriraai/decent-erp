/** Scroll the first invalid field into view inside a form or dialog. */
export function scrollToFirstFormError(rootId: string) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const target =
    root.querySelector<HTMLElement>("[aria-invalid='true']") ??
    root.querySelector<HTMLElement>(".form-error") ??
    root.querySelector<HTMLElement>("[role='alert']");
  if (!target) return;

  const field =
    target.closest<HTMLElement>(".form-group, .manual-task-row, .form-field") ?? target;
  field.style.scrollMarginTop = "6rem";
  field.style.scrollMarginBottom = "1.5rem";
  field.scrollIntoView({ behavior: "smooth", block: "start" });

  const focusable =
    target.matches("input, textarea, select, button")
      ? target
      : field.querySelector<HTMLElement>("input, textarea, select, button");
  focusable?.focus({ preventScroll: true });
}
