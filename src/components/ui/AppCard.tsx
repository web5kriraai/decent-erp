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
  title?: ReactNode;
  description?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

/** Standard page section card built on shadcn Card. */
export function AppCard({
  flat,
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
      className={cn(flat && "shadow-none", className)}
      {...props}
    >
      {title || description || headerAction ? (
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b pb-3">
          <div className="min-w-0 space-y-1">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(!(title || description || headerAction) && "pt-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
