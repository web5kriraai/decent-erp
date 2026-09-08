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
  /**
   * Full-bleed body (tables, matrices). Header keeps normal inset —
   * never zero `--card-spacing` or titles sit on the card edge.
   */
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
  const hasHeader = !!(title || description || headerAction);

  return (
    <Card
      data-card-flush={flush ? "true" : undefined}
      className={cn(
        flat && "shadow-none",
        // Flush: collapse outer py/gap only. Keep --card-spacing so headers stay padded.
        flush && "gap-0 py-0",
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <CardHeader
          className={cn(
            "flex flex-row items-start justify-between gap-3 space-y-0 border-b",
            // Always keep horizontal inset (overrides any accidental spacing token = 0)
            "px-4 sm:px-5 pb-3 sm:pb-3.5",
            // When card py is removed (flush), restore top inset on the header itself
            flush && "pt-4",
          )}
        >
          <div className="min-w-0 space-y-1.5">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {headerAction ? <div className="shrink-0 pt-0.5">{headerAction}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent
        className={cn(
          !hasHeader && "pt-0",
          flush && "px-0 py-0",
          !flush && hasHeader && "pt-4",
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
