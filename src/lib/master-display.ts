/**
 * Prefer catalog display name; if missing/blank, humanize the code (e.g. SAREE → Saree).
 */
export function masterDisplayName(
  name?: string | null,
  code?: string | null,
  emptyFallback = "—",
): string {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;

  const trimmedCode = code?.trim();
  if (!trimmedCode) return emptyFallback;

  return trimmedCode
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
