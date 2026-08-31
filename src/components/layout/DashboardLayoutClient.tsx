"use client";

import { Sidebar, TopBar } from "@/components/layout/DashboardShell";
import { SidebarProvider, useSidebarState } from "@/components/layout/SidebarProvider";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarState();

  return (
    <div className={`app-shell ${collapsed ? "app-shell--sidebar-collapsed" : ""}`}>
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </SidebarProvider>
  );
}
