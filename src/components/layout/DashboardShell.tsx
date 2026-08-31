"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  getVisibleNavSections,
  isNavActive,
  ROUTES,
} from "@/config/routes";
import { formatRoleLabel, getRoleDefinition } from "@/config/roles";
import { useRouteMeta } from "@/hooks/use-route-meta";
import { useSidebarState } from "@/components/layout/SidebarProvider";
import { IconSearch, IconLogout } from "@/components/icons";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRole(code: string) {
  return formatRoleLabel(code);
}

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = useRouteMeta().pathname;
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebarState();
  const permissions = session?.user?.permissions ?? [];
  const sections = getVisibleNavSections(permissions);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={closeMobile}
        />
      )}

      <aside
        className={`sidebar ${collapsed ? "sidebar--collapsed" : ""} ${mobileOpen ? "sidebar--mobile-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <Link href={ROUTES.dashboard} className="sidebar-brand-link" onClick={closeMobile}>
            <div className="sidebar-brand-mark" aria-hidden>
              DE
            </div>
            {!collapsed && (
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-name">Decent ERP</span>
                <span className="sidebar-brand-module">Design Management</span>
              </div>
            )}
          </Link>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {sections.map((section) => (
            <div key={section.id} className="sidebar-section">
              {!collapsed && (
                <div className="sidebar-section-label">{section.label}</div>
              )}
              <ul className="sidebar-list">
                {section.items.map((item) => {
                  const active = isNavActive(pathname, item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={`sidebar-link ${active ? "sidebar-link--active" : ""}`}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                        onClick={closeMobile}
                      >
                        {Icon && <Icon size={18} className="sidebar-link-icon" />}
                        {!collapsed && <span className="sidebar-link-label">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {!collapsed && session?.user?.roleCode && (
          <div className="sidebar-footer">
            <div className="sidebar-footer-role">{formatRoleLabel(session.user.roleCode)}</div>
            <div className="sidebar-footer-hint">
              {getRoleDefinition(session.user.roleCode)?.navFocus.slice(0, 2).join(" · ") ??
                "Design Management"}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

export function TopBar() {
  const { data: session } = useSession();
  const { breadcrumbs } = useRouteMeta();
  const { toggleMobile } = useSidebarState();
  const name = session?.user?.name ?? "User";
  const role = session?.user?.roleCode ?? "employee";

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar-menu-btn btn btn-ghost btn-icon"
        onClick={toggleMobile}
        aria-label="Open navigation menu"
      >
        ☰
      </button>

      <nav className="topbar-breadcrumbs breadcrumbs" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => (
          <span key={`${crumb.label}-${i}`} className="breadcrumb-item">
            {i > 0 && <span className="breadcrumbs-sep">/</span>}
            {crumb.href ? (
              <Link href={crumb.href}>{crumb.label}</Link>
            ) : (
              <span className="breadcrumbs-current">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="topbar-search topbar-search--desktop">
        <span className="toolbar-search-icon">
          <IconSearch size={16} />
        </span>
        <input
          type="search"
          placeholder="Search designs, tasks…"
          aria-label="Global search"
          className="form-input"
        />
      </div>

      <div className="topbar-actions">
        <div className="topbar-user">
          <div className="topbar-avatar" aria-hidden>
            {getInitials(name)}
          </div>
          <div className="topbar-user-info topbar-user-info--desktop">
            <span className="topbar-user-name">{name}</span>
            <span className="topbar-user-role">{formatRole(role)}</span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => signOut({ callbackUrl: ROUTES.login })}
          aria-label="Sign out"
          title="Sign out"
        >
          <IconLogout size={18} />
        </button>
      </div>
    </header>
  );
}
