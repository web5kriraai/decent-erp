"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DesignDetailModal } from "@/features/designs/DesignDetailModal";

export type DesignDetailTab =
  | "overview"
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

const TAB_VALUES: DesignDetailTab[] = [
  "overview",
  "corrections",
  "costing",
  "kra-kpi",
  "files",
  "approvals",
];

function parseTab(value: string | null): DesignDetailTab {
  if (value && TAB_VALUES.includes(value as DesignDetailTab)) {
    return value as DesignDetailTab;
  }
  return "overview";
}

export function DesignDetailModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlDesignId = searchParams.get("designId");
  const urlTab = parseTab(searchParams.get("tab"));
  const urlImageId = searchParams.get("image");

  const [localDesignId, setLocalDesignId] = useState<string | null>(null);
  const [localTab, setLocalTab] = useState<DesignDetailTab>("overview");

  const designId = urlDesignId ?? localDesignId;
  const tabFromUrl = urlDesignId ? urlTab : localTab;
  const highlightImageId = urlDesignId ? urlImageId : null;
  const tab =
    highlightImageId && tabFromUrl === "overview" ? "files" : tabFromUrl;

  const syncUrl = useCallback(
    (nextId: string | null, nextTab: DesignDetailTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextId) {
        params.set("designId", nextId);
        params.set("tab", nextTab);
      } else {
        params.delete("designId");
        params.delete("tab");
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openDesign = useCallback(
    (id: string, nextTab: DesignDetailTab = "overview") => {
      setLocalDesignId(id);
      setLocalTab(nextTab);
      syncUrl(id, nextTab);
    },
    [syncUrl],
  );

  const closeDesign = useCallback(() => {
    setLocalDesignId(null);
    setLocalTab("overview");
    syncUrl(null, "overview");
  }, [syncUrl]);

  const setTab = useCallback(
    (nextTab: DesignDetailTab) => {
      setLocalTab(nextTab);
      if (designId) syncUrl(designId, nextTab);
    },
    [designId, syncUrl],
  );

  const value = useMemo(
    () => ({ openDesign, closeDesign, designId, tab, setTab }),
    [openDesign, closeDesign, designId, tab, setTab],
  );

  return (
    <DesignDetailModalContext.Provider value={value}>
      {children}
      {designId ? (
        <DesignDetailModal
          designId={designId}
          open={!!designId}
          tab={tab}
          onTabChange={setTab}
          onClose={closeDesign}
          highlightImageId={highlightImageId}
        />
      ) : null}
    </DesignDetailModalContext.Provider>
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
