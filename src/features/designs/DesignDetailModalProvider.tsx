"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/config/routes";

export type DesignDetailTab =
  | "overview"
  | "activity"
  | "corrections"
  | "costing"
  | "kra-kpi"
  | "files"
  | "approvals";

type DesignDetailModalContextValue = {
  openDesign: (designId: string, tab?: DesignDetailTab) => void;
  closeDesign: () => void;
  designId: string | null;
  tab: DesignDetailTab;
  setTab: (tab: DesignDetailTab) => void;
};

const DesignDetailModalContext = createContext<DesignDetailModalContextValue | null>(null);

/**
 * Opens designs on the full detail page (not the right drawer).
 * Kept as a provider so list/kanban callers can keep using openDesign().
 */
export function DesignDetailModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const openDesign = useCallback(
    (id: string, nextTab: DesignDetailTab = "overview") => {
      const href =
        nextTab === "overview"
          ? ROUTES.designs.detail(id)
          : `${ROUTES.designs.detail(id)}?tab=${nextTab}`;
      router.push(href);
    },
    [router],
  );

  const closeDesign = useCallback(() => {
    router.push(ROUTES.designs.list);
  }, [router]);

  const setTab = useCallback((_nextTab: DesignDetailTab) => {
    // Tab state lives on the full detail page; no-op for list/kanban callers.
  }, []);

  const value = useMemo(
    () => ({
      openDesign,
      closeDesign,
      designId: null,
      tab: "overview" as DesignDetailTab,
      setTab,
    }),
    [openDesign, closeDesign, setTab],
  );

  return (
    <DesignDetailModalContext.Provider value={value}>{children}</DesignDetailModalContext.Provider>
  );
}

export function useDesignDetailModal() {
  const ctx = useContext(DesignDetailModalContext);
  if (!ctx) {
    throw new Error("useDesignDetailModal must be used within DesignDetailModalProvider");
  }
  return ctx;
}

/** Optional hook when provider may be absent (e.g. isolated pages). */
export function useOptionalDesignDetailModal() {
  return useContext(DesignDetailModalContext);
}
