import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  trend?: string;
  accent?: boolean;
};

export function StatCard({ label, value, trend, accent }: StatCardProps) {
  return (
    <Card
      size="sm"
      className={cn(
        "shadow-none",
        accent && "ring-primary/20 bg-primary/5",
      )}
    >
      <CardContent className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="block text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        {trend ? (
          <span className="block text-xs text-muted-foreground">{trend}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
