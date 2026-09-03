"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Children } from "react";
import { AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";

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
