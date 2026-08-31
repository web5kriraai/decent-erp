const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  LOW: { bg: "var(--color-neutral-100)", text: "var(--color-neutral-500)" },
  MEDIUM: { bg: "var(--color-info-bg)", text: "var(--color-info)" },
  HIGH: { bg: "var(--color-warning-bg)", text: "var(--color-warning)" },
  URGENT: { bg: "var(--color-danger-bg)", text: "var(--color-danger)" },
};

type PriorityBadgeProps = {
  priority: string;
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.MEDIUM;
  return (
    <span
      className="badge"
      style={{ background: style.bg, color: style.text }}
    >
      {priority}
    </span>
  );
}
