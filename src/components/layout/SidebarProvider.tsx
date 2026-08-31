"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "decent-erp-sidebar-collapsed";

type SidebarContextValue = {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((o) => !o), []);

  const value = useMemo(
    () => ({ collapsed, mobileOpen, toggleCollapsed, closeMobile, toggleMobile }),
    [collapsed, mobileOpen, toggleCollapsed, closeMobile, toggleMobile],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarState() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebarState must be used within SidebarProvider");
  return ctx;
}
