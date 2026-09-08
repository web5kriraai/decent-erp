import Link from "next/link";
import { IconChevronRight, IconHome } from "@/components/icons";
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
          const isHome = index === 0 && (crumb.label === "Dashboard" || crumb.label === "Overview");
          const showLink = !isLast && crumb.href;

          return (
            <li key={`${crumb.label}-${index}`} className="breadcrumb-list-item">
              {index > 0 ? (
                <IconChevronRight className="breadcrumb-chevron" aria-hidden />
              ) : null}
              {showLink ? (
                <Link href={crumb.href!} className="breadcrumb-link">
                  {isHome ? <IconHome className="breadcrumb-icon" aria-hidden /> : null}
                  <span className="breadcrumb-label">{crumb.label}</span>
                </Link>
              ) : (
                <span
                  className={cn("breadcrumb-current", isLast && "breadcrumb-current--active")}
                  aria-current={isLast ? "page" : undefined}
                >
                  {isHome ? <IconHome className="breadcrumb-icon" aria-hidden /> : null}
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
