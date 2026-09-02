import { cn } from "@/lib/utils";

type StatCardTone = "default" | "accent" | "warning" | "danger" | "success";

type StatCardProps = {
  label: string;
  value: string | number;
  trend?: string;
  /**
   * Semantic left-border only. Prefer warning/danger/success for status;
   * accent for a single primary focus metric. Default = identical base card.
   */
  tone?: StatCardTone;
  /** @deprecated Prefer tone="accent" — kept for call-site compatibility */
  accent?: boolean;
};

export function StatCard({ label, value, trend, tone, accent }: StatCardProps) {
  const resolvedTone: StatCardTone = tone ?? (accent ? "accent" : "default");

  return (
    <div
      className={cn(
        "stat-card",
        resolvedTone !== "default" && `stat-card--${resolvedTone}`,
      )}
    >
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value">{value}</span>
      {trend ? <span className="stat-card-trend">{trend}</span> : null}
    </div>
  );
}
