import type { HTMLAttributes, ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AppCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Border only, no soft elevation. */
  flat?: boolean;
  /** No outer padding - use for full-bleed tables inside the card. */
  flush?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

/** Standard page section card built on shadcn Card. */
export function AppCard({
  flat,
  flush,
  title,
  description,
  headerAction,
  className,
  contentClassName,
  children,
  ...props
}: AppCardProps) {
  return (
    <Card
      className={cn(
        flat && "shadow-none",
        // Keep header spacing; only collapse card gap/padding so tables can go full-bleed.
        flush && "gap-0 py-0",
        className,
      )}
      {...props}
    >
      {title || description || headerAction ? (
        <CardHeader
          className={cn(
            "flex flex-row justify-between gap-3 space-y-0 border-b",
            description ? "items-start py-3" : "items-center py-3",
          )}
        >
          <div className="min-w-0 space-y-1">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {headerAction ? (
            <div className="flex shrink-0 items-center">{headerAction}</div>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent
        className={cn(
          !(title || description || headerAction) && "pt-0",
          flush && "px-0 py-0",
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
