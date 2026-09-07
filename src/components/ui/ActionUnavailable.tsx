import { IconInfo } from "@/components/icons";
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
      <IconInfo className="action-unavailable-icon" aria-hidden />
      <p className="action-unavailable-text">{reason}</p>
    </div>
  );
}
