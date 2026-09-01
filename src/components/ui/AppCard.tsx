import type { HTMLAttributes, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AppCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Use legacy `.card--flat` styling (border only, no shadow). */
  flat?: boolean;
  /** Render as shadcn Card instead of legacy `.card` div. */
  asShadcn?: boolean;
  title?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
};

/** Bridge legacy `.card` and shadcn `Card` during UI migration. */
export function AppCard({
  flat,
  asShadcn,
  title,
  headerAction,
  className,
  children,
  ...props
}: AppCardProps) {
  if (asShadcn) {
    return (
      <Card className={cn(flat && "shadow-none", className)} {...props}>
        {title ? (
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>{title}</CardTitle>
            {headerAction}
          </CardHeader>
        ) : null}
        <CardContent>{children}</CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("card", flat && "card--flat", className)} {...props}>
      {title ? (
        <div className="card-header">
          <span className="card-title">{title}</span>
          {headerAction}
        </div>
      ) : null}
      {children}
    </div>
  );
}
