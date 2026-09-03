/** Lifecycle status labels and accent colors for pipeline accordion rows. */

export type PipelineStatusAccent = {
  bg: string;
  text: string;
};

export type PipelineStatusTheme = {
  label: string;
  accent: PipelineStatusAccent;
};

export const PIPELINE_STATUS_THEME: Record<string, PipelineStatusTheme> = {
  DRAFT: { label: "Draft", accent: { bg: "var(--color-primary-light)", text: "var(--color-navy)" } },
  ACTIVE: { label: "Active", accent: { bg: "#dcfce7", text: "#15803d" } },
  ON_HOLD: { label: "On Hold", accent: { bg: "#ffedd5", text: "#c2410c" } },
  APPROVAL_PENDING: { label: "Approval Pending", accent: { bg: "#fef3c7", text: "#b45309" } },
  APPROVED: { label: "Approved", accent: { bg: "#d1fae5", text: "#047857" } },
  PRODUCTION_ACCEPTED: {
    label: "Production Accepted",
    accent: { bg: "color-mix(in srgb, var(--color-navy) 10%, white)", text: "var(--color-navy)" },
  },
  PRODUCTION_RELEASED: { label: "Production Released", accent: { bg: "#ccfbf1", text: "#0f766e" } },
  LIVE: { label: "Live", accent: { bg: "#dcfce7", text: "#166534" } },
};

export function pipelineStatusLabel(status: string): string {
  return PIPELINE_STATUS_THEME[status]?.label ?? status.replace(/_/g, " ");
}

export function pipelineStatusAccent(status: string): PipelineStatusAccent {
  return (
    PIPELINE_STATUS_THEME[status]?.accent ?? {
      bg: "var(--color-neutral-100)",
      text: "var(--color-neutral-600)",
    }
  );
}
