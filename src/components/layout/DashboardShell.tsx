"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { BrandLogo } from "@/components/brand/BrandLogo";
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
  IconClose,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/icons";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { cn } from "@/lib/utils";

const SEARCH_PLACEHOLDER = "Search or jump to…";
const MOBILE_NAV_MQ = "(max-width: 959px)";

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

/** True below the desktop shell breakpoint (phone + tablet drawer). */
function useIsMobileNav() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_NAV_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = useRouteMeta().pathname;
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebarState();
  const isMobileNav = useIsMobileNav();
  // On phone/tablet always show full labels in the drawer (ignore desktop collapsed)
  const showCollapsed = collapsed && !isMobileNav;
  const permissions = session?.user?.permissions ?? [];
  const roleCode = session?.user?.roleCode;
  const sections = getVisibleNavSections(permissions, roleCode);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (!isMobileNav || !mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isMobileNav, mobileOpen, closeMobile]);

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
        id="app-sidebar"
        className={cn(
          "sidebar",
          showCollapsed && "sidebar--collapsed",
          mobileOpen && "sidebar--mobile-open",
          isMobileNav && "sidebar--drawer",
        )}
        aria-label="Main navigation"
        aria-hidden={isMobileNav && !mobileOpen ? true : undefined}
      >
        <div className="sidebar-brand">
          {showCollapsed ? (
            <div className="sidebar-brand-collapsed">
              <Link
                href={ROUTES.dashboard}
                className="sidebar-brand-mark"
                onClick={closeMobile}
                title="Decent ERP"
                aria-label="Decent ERP home"
              >
                <BrandLogo variant="mark" size="sm" alt="" />
              </Link>
              <button
                type="button"
                className="sidebar-collapse-btn sidebar-collapse-btn--expand"
                onClick={toggleCollapsed}
                aria-label="Expand sidebar"
                aria-expanded={false}
                title="Expand sidebar"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          ) : (
            <>
              <Link
                href={ROUTES.dashboard}
                className="sidebar-brand-link"
                onClick={closeMobile}
              >
                <span className="sidebar-brand-mark" aria-hidden>
                  <BrandLogo variant="mark" size="sm" alt="" />
                </span>
                <span className="sidebar-brand-text">
                  <span className="sidebar-brand-name">Decent ERP</span>
                </span>
              </Link>
              {isMobileNav ? (
                <button
                  type="button"
                  className="sidebar-drawer-close"
                  onClick={closeMobile}
                  aria-label="Close navigation menu"
                >
                  <IconClose size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  className="sidebar-collapse-btn sidebar-collapse-btn--collapse"
                  onClick={toggleCollapsed}
                  aria-label="Collapse sidebar"
                  aria-expanded
                  title="Collapse sidebar"
                >
                  <IconChevronLeft size={16} />
                </button>
              )}
            </>
          )}
        </div>

        <nav className="sidebar-nav scroll-region" aria-label="Workspace sections">
          {sections.map((section) => (
            <div key={section.id} className="sidebar-section">
              {!showCollapsed && (
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
                        title={showCollapsed ? item.label : undefined}
                        onClick={closeMobile}
                      >
                        {Icon && <Icon size={18} className="sidebar-link-icon" />}
                        {!showCollapsed && (
                          <span className="sidebar-link-label">{item.label}</span>
                        )}
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
  const { mobileOpen, toggleMobile, closeMobile } = useSidebarState();
  const isMobileNav = useIsMobileNav();
  const name = session?.user?.name ?? "User";
  const role = session?.user?.roleCode ?? "employee";
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const toggleSearch = useCallback(() => setSearchOpen((open) => !open), []);
  useGlobalSearchShortcut(toggleSearch);
  const modKey = usePlatformModKeyLabel();

  return (
    <header className="topbar">
      {/* Phone/tablet: always-visible menu control */}
      <AppButton
        type="button"
        appVariant="outline"
        size="icon"
        className="topbar-menu-btn"
        onClick={toggleMobile}
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
        aria-controls="app-sidebar"
      >
        {mobileOpen && isMobileNav ? <IconClose size={18} /> : <IconMenu size={18} />}
      </AppButton>

      <div className="topbar-mobile-brand">
        <BrandLogo variant="mark" size="sm" className="h-8 w-8" alt="" />
        <span className="topbar-mobile-title">Decent ERP</span>
      </div>

      <Breadcrumbs items={breadcrumbs} variant="topbar" className="topbar-breadcrumbs" />

      <div className="topbar-search topbar-search--desktop">
        <AppButton
          type="button"
          appVariant="outline"
          className="topbar-search-trigger h-9 w-full justify-start gap-2 px-2.5 font-normal text-muted-foreground"
          onClick={() => setSearchOpen(true)}
          aria-label="Open global search"
        >
          <IconSearch size={16} />
          <span className="truncate">{SEARCH_PLACEHOLDER}</span>
          <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium lg:inline">
            {modKey} K
          </kbd>
        </AppButton>
      </div>

      <GlobalSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="topbar-actions shrink-0">
        <AppButton
          type="button"
          appVariant="ghost"
          size="icon"
          className="topbar-search-mobile"
          onClick={() => setSearchOpen(true)}
          aria-label="Open global search"
        >
          <IconSearch size={18} />
        </AppButton>
        <NotificationBell />
        <div className="relative">
          <AppButton
            type="button"
            appVariant="ghost"
            className="topbar-user h-auto min-h-11 gap-2 px-1.5 py-1"
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
                className="absolute right-0 z-50 mt-1 min-w-48 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border bg-card p-1 shadow-md"
              >
                <div className="border-b px-2.5 py-2">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{formatRole(role)}</p>
                </div>
                <AppButton
                  type="button"
                  appVariant="ghost"
                  className="min-h-11 w-full justify-start gap-2"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    closeMobile();
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
