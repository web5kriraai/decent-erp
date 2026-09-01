"use client";

import { Sidebar, TopBar } from "@/components/layout/DashboardShell";
import { BreadcrumbProvider } from "@/components/layout/BreadcrumbProvider";
import { SidebarProvider, useSidebarState } from "@/components/layout/SidebarProvider";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarState();

  return (
    <div className={`app-shell ${collapsed ? "app-shell--sidebar-collapsed" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <main id="main-content" className="app-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <BreadcrumbProvider>
        <DashboardShellInner>{children}</DashboardShellInner>
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
