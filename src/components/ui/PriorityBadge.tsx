import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  LOW: { bg: "var(--color-neutral-100)", text: "var(--color-neutral-500)", label: "Low" },
  MEDIUM: { bg: "var(--color-info-bg)", text: "var(--color-info)", label: "Medium" },
  HIGH: { bg: "var(--color-warning-bg)", text: "var(--color-warning)", label: "High" },
  URGENT: { bg: "var(--color-danger-bg)", text: "var(--color-danger)", label: "Urgent" },
};

type PriorityBadgeProps = {
  priority: string;
  className?: string;
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.MEDIUM;
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", className)}
      style={{ background: style.bg, color: style.text }}
    >
      {PRIORITY_STYLES[priority]?.label ?? priority}
    </Badge>
  );
}
