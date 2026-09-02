import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_TOKENS: Record<string, { bg: string; text: string; dot: string }> = {
  DRAFT: { bg: "var(--color-info-bg)", text: "var(--color-info)", dot: "var(--color-info)" },
  ACTIVE: { bg: "var(--color-success-bg)", text: "var(--color-success)", dot: "var(--color-success)" },
  ON_HOLD: { bg: "var(--color-warning-bg)", text: "var(--color-warning)", dot: "var(--color-warning)" },
  APPROVAL_PENDING: { bg: "var(--color-warning-bg)", text: "var(--color-warning)", dot: "var(--color-warning)" },
  APPROVED: { bg: "var(--color-success-bg)", text: "var(--color-success)", dot: "var(--color-success)" },
  PRODUCTION_ACCEPTED: { bg: "var(--color-primary-light)", text: "var(--color-primary)", dot: "var(--color-primary)" },
  REJECTED: { bg: "var(--color-danger-bg)", text: "var(--color-danger)", dot: "var(--color-danger)" },
  PRODUCTION_RELEASED: { bg: "var(--color-success-bg)", text: "var(--color-success)", dot: "var(--color-success)" },
  LIVE: { bg: "var(--color-success-bg)", text: "var(--color-success)", dot: "var(--color-success)" },
  CLOSED: { bg: "var(--color-neutral-100)", text: "var(--color-neutral-500)", dot: "var(--color-neutral-400)" },
  PENDING: { bg: "var(--color-info-bg)", text: "var(--color-info)", dot: "var(--color-info)" },
  ASSIGNED: { bg: "var(--color-primary-light)", text: "var(--color-primary)", dot: "var(--color-primary)" },
  RUNNING: { bg: "var(--color-success-bg)", text: "var(--color-success)", dot: "var(--color-success)" },
  CHECKING: { bg: "var(--color-warning-bg)", text: "var(--color-warning)", dot: "var(--color-warning)" },
  CORRECTION_REQUIRED: { bg: "var(--color-warning-bg)", text: "var(--color-warning)", dot: "var(--color-warning)" },
  SKIPPED: { bg: "var(--color-neutral-100)", text: "var(--color-neutral-600)", dot: "var(--color-neutral-400)" },
  COMPLETED: { bg: "var(--color-success-bg)", text: "var(--color-success)", dot: "var(--color-success)" },
  CANCELLED: { bg: "var(--color-neutral-100)", text: "var(--color-neutral-500)", dot: "var(--color-neutral-400)" },
  OPEN: { bg: "var(--color-warning-bg)", text: "var(--color-warning)", dot: "var(--color-warning)" },
  IN_PROGRESS: { bg: "var(--color-primary-light)", text: "var(--color-primary)", dot: "var(--color-primary)" },
  READY: { bg: "var(--color-primary-light)", text: "var(--color-primary)", dot: "var(--color-primary)" },
  UPCOMING: { bg: "var(--color-neutral-100)", text: "var(--color-neutral-500)", dot: "var(--color-neutral-400)" },
  DONE: { bg: "var(--color-success-bg)", text: "var(--color-success)", dot: "var(--color-success)" },
  SYNCED: { bg: "var(--color-success-bg)", text: "var(--color-success)", dot: "var(--color-success)" },
  QUEUED: { bg: "var(--color-info-bg)", text: "var(--color-info)", dot: "var(--color-info)" },
  FAILED: { bg: "var(--color-danger-bg)", text: "var(--color-danger)", dot: "var(--color-danger)" },
};

type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const tokens = STATUS_TOKENS[status] ?? STATUS_TOKENS.CLOSED;
  const display = label ?? status.replace(/_/g, " ");

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border-transparent font-medium", className)}
      style={{ background: tokens.bg, color: tokens.text }}
      aria-label={`Status: ${display}`}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: tokens.dot }}
        aria-hidden
      />
      {display}
    </Badge>
  );
}
