"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  getVisibleNavSections,
  isNavActive,
  ROUTES,
} from "@/config/routes";
import { formatRoleLabel } from "@/config/roles";
import { useRouteMeta } from "@/hooks/use-route-meta";
import { useSidebarState } from "@/components/layout/SidebarProvider";
import {
  GlobalSearchCommand,
  useGlobalSearchShortcut,
} from "@/components/layout/GlobalSearchCommand";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AppButton } from "@/components/ui/AppButton";
import {
  IconSearch,
  IconLogout,
  IconMenu,
} from "@/components/icons";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { cn } from "@/lib/utils";

const SEARCH_PLACEHOLDER = "Search or jump to…";

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

function usePlatformModKeyLabel(): string {
  const [label] = useState(() => {
    if (typeof navigator === "undefined") return "Ctrl";
    const isApple =
      /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ||
      /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isApple ? "⌘" : "Ctrl";
  });
  return label;
}

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = useRouteMeta().pathname;
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebarState();
  const permissions = session?.user?.permissions ?? [];
  const roleCode = session?.user?.roleCode;
  const sections = getVisibleNavSections(permissions, roleCode);
  const brandModule = roleCode ? formatRoleLabel(roleCode) : "Design Management";

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
        className={cn(
          "sidebar",
          collapsed && "sidebar--collapsed",
          mobileOpen && "sidebar--mobile-open",
        )}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <button
            type="button"
            className="sidebar-brand-mark"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            DE
          </button>
          {!collapsed && (
            <Link
              href={ROUTES.dashboard}
              className="sidebar-brand-link"
              onClick={closeMobile}
            >
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-name">Decent ERP</span>
                <span className="sidebar-brand-module">{brandModule}</span>
              </div>
            </Link>
          )}
        </div>

        <nav className="sidebar-nav scroll-region" aria-label="Workspace sections">
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
                        className={cn("sidebar-link", active && "sidebar-link--active")}
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const toggleSearch = useCallback(() => setSearchOpen((open) => !open), []);
  useGlobalSearchShortcut(toggleSearch);
  const modKey = usePlatformModKeyLabel();

  return (
    <header className="topbar">
      <AppButton
        type="button"
        appVariant="ghost"
        size="icon"
        className="topbar-menu-btn"
        onClick={toggleMobile}
        aria-label="Open navigation menu"
      >
        <IconMenu size={18} />
      </AppButton>

      <Breadcrumbs items={breadcrumbs} variant="topbar" className="topbar-breadcrumbs" />

      <div className="topbar-search topbar-search--desktop">
        <AppButton
          type="button"
          appVariant="outline"
          className="topbar-search-trigger h-8 w-full justify-start gap-2 px-2.5 font-normal text-muted-foreground"
          onClick={() => setSearchOpen(true)}
          aria-label="Open global search"
        >
          <IconSearch size={16} />
          <span>{SEARCH_PLACEHOLDER}</span>
          <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
            {modKey} K
          </kbd>
        </AppButton>
      </div>

      <GlobalSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="topbar-actions">
        <NotificationBell />
        <div className="relative">
          <AppButton
            type="button"
            appVariant="ghost"
            className="topbar-user h-auto gap-2 px-1.5 py-1"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            onClick={() => setUserMenuOpen((open) => !open)}
          >
            <div className="topbar-avatar" aria-hidden>
              {getInitials(name)}
            </div>
            <div className="topbar-user-info topbar-user-info--desktop text-left">
              <span className="topbar-user-name block leading-tight">{name}</span>
              <span className="topbar-user-role block leading-tight">{formatRole(role)}</span>
            </div>
          </AppButton>
          {userMenuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close user menu"
                onClick={() => setUserMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1 min-w-48 overflow-hidden rounded-lg border bg-card p-1 shadow-md"
              >
                <div className="border-b px-2.5 py-2">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{formatRole(role)}</p>
                </div>
                <AppButton
                  type="button"
                  appVariant="ghost"
                  className="w-full justify-start gap-2"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    void signOut({ callbackUrl: ROUTES.login });
                  }}
                >
                  <IconLogout size={16} />
                  Sign out
                </AppButton>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
