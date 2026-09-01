import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ActionUnavailableProps = {
  reason: string;
  className?: string;
  compact?: boolean;
};

export function ActionUnavailable({ reason, className, compact }: ActionUnavailableProps) {
  return (
    <div
      className={cn(
        "action-unavailable",
        compact && "action-unavailable--compact",
        className,
      )}
      role="note"
    >
      <InfoIcon className="action-unavailable-icon" aria-hidden />
      <p className="action-unavailable-text">{reason}</p>
    </div>
  );
}
