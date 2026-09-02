import type { ReactNode } from "react";
import { IconEmpty } from "@/components/icons";
import { AppCard } from "@/components/ui/AppCard";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  bare?: boolean;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  bare,
}: EmptyStateProps) {
  const body = (
    <div className={cn("flex flex-col items-center px-4 py-10 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <IconEmpty size={28} />}
      </div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );

  if (bare) return body;
  return <AppCard flat contentClassName="p-0">{body}</AppCard>;
}
