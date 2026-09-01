import Link from "next/link";
import { ChevronRightIcon, HomeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = { label: string; href?: string };

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  /** Compact single-line trail for the dashboard top bar. */
  variant?: "topbar" | "page";
  className?: string;
};

export function Breadcrumbs({ items, variant = "page", className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      className={cn(
        "breadcrumb-nav",
        variant === "topbar" && "breadcrumb-nav--topbar",
        variant === "page" && "breadcrumb-nav--page",
        className,
      )}
      aria-label="Breadcrumb"
    >
      <ol className="breadcrumb-list">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1;
          const isOverview = index === 0 && crumb.label === "Overview";
          const showLink = !isLast && crumb.href;

          return (
            <li key={`${crumb.label}-${index}`} className="breadcrumb-list-item">
              {index > 0 ? (
                <ChevronRightIcon className="breadcrumb-chevron" aria-hidden />
              ) : null}
              {showLink ? (
                <Link href={crumb.href!} className="breadcrumb-link">
                  {isOverview ? <HomeIcon className="breadcrumb-icon" aria-hidden /> : null}
                  <span className="breadcrumb-label">{crumb.label}</span>
                </Link>
              ) : (
                <span
                  className={cn("breadcrumb-current", isLast && "breadcrumb-current--active")}
                  aria-current={isLast ? "page" : undefined}
                >
                  {isOverview ? <HomeIcon className="breadcrumb-icon" aria-hidden /> : null}
                  <span className="breadcrumb-label">{crumb.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
