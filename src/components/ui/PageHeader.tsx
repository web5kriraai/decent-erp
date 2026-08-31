import Link from "next/link";
import type { ReactNode } from "react";

type Breadcrumb = { label: string; href?: string };

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {i > 0 && <span className="breadcrumbs-sep">/</span>}
                {crumb.href ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span className="breadcrumbs-current">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
