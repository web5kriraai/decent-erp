"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Children } from "react";
import { AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { isNavActive } from "@/config/routes";

export function WorkbenchEmpty({ message }: { message: string }) {
  return <p className="workbench-empty">{message}</p>;
}

export function WorkbenchShell({
  firstName,
  title,
  subtitle,
  actions,
  isLoading,
  isError,
  error,
  onRetry,
  children,
}: {
  firstName: string;
  title?: string;
  subtitle: string;
  actions?: ReactNode;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  children: ReactNode;
}) {
  return (
    <div className="page-shell">
      <PageHeader
        title={title ?? `Welcome back, ${firstName}`}
        subtitle={subtitle}
        actions={actions}
      />
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={onRetry}
        skeletonVariant="stats"
      >
        {children}
      </QueryState>
    </div>
  );
}

export type WorkbenchQuickAction = {
  href: string;
  label: string;
  badge?: number;
};

function quickActionPath(href: string) {
  return href.split("?")[0] || href;
}

/** Shared dashboard nav chips — one inactive + one active style app-wide. */
export function WorkbenchQuickActions({
  title = "Quick actions",
  actions,
  description,
  className,
}: {
  title?: string;
  actions: WorkbenchQuickAction[];
  description?: string;
  className?: string;
}) {
  const pathname = usePathname();

  if (actions.length === 0) return null;

  return (
    <AppCard title={title} className={className} contentClassName="space-y-2">
      <div className="nav-chip-row contextual-actions-buttons">
        {actions.map((action) => {
          const path = quickActionPath(action.href);
          const active = isNavActive(pathname, path);
          return (
            <AppButtonLink
              key={`${action.href}-${action.label}`}
              href={action.href}
              appVariant="outline"
              size="sm"
              data-app-surface="nav-chip"
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {action.badge != null && action.badge > 0
                ? `${action.label} (${action.badge})`
                : action.label}
            </AppButtonLink>
          );
        })}
      </div>
      {description ? (
        <p className="m-0 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </AppCard>
  );
}

export function WorkbenchQueueCard({
  title,
  href,
  linkLabel,
  emptyMessage,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <AppCard
      title={title}
      headerAction={
        href ? (
          <AppButtonLink href={href} appVariant="ghost" size="sm">
            {linkLabel ?? "View all"}
          </AppButtonLink>
        ) : null
      }
    >
      {Children.count(children) > 0 ? (
        children
      ) : (
        <WorkbenchEmpty message={emptyMessage} />
      )}
    </AppCard>
  );
}

export function WorkbenchListItem({
  primaryHref,
  primaryLabel,
  meta,
  detail,
  trailing,
  action,
}: {
  primaryHref: string;
  primaryLabel: string;
  meta?: string;
  detail?: string;
  trailing?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className={action ? "workbench-list-row" : undefined}>
      <div className={action ? "workbench-list-item" : undefined}>
        <div>
          <Link href={primaryHref} className="data-table-link">
            {primaryLabel}
          </Link>
          {meta ? <p className="workbench-row-meta">{meta}</p> : null}
          {detail ? <p className="workbench-row-meta">{detail}</p> : null}
        </div>
        <div className="workbench-list-trailing">{trailing}</div>
      </div>
      {action}
    </li>
  );
}
