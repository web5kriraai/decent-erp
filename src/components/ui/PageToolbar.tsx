import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageToolbarProps = {
  children: ReactNode;
  className?: string;
  /** Muted panel chrome (legacy `.toolbar` look for tab strips / report filters). */
  panel?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">;

/** Canonical list/filter toolbar — use instead of ad-hoc `.toolbar` / flex rows. */
export function PageToolbar({
  children,
  className,
  panel = false,
  ...props
}: PageToolbarProps) {
  return (
    <div className={cn(panel ? "toolbar" : "page-toolbar", className)} {...props}>
      {children}
    </div>
  );
}
