"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BreadcrumbReplacements = Record<string, string>;

type BreadcrumbActions = {
  setReplacement: (fromLabel: string, toLabel: string) => void;
  clearReplacement: (fromLabel: string) => void;
};

type BreadcrumbContextValue = {
  replacements: BreadcrumbReplacements;
} & BreadcrumbActions;

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [replacements, setReplacements] = useState<BreadcrumbReplacements>({});

  // Drop page-specific labels when the route changes.
  useEffect(() => {
    setReplacements({});
  }, [pathname]);

  const setReplacement = useCallback((fromLabel: string, toLabel: string) => {
    setReplacements((prev) => {
      if (prev[fromLabel] === toLabel) return prev;
      return { ...prev, [fromLabel]: toLabel };
    });
  }, []);

  const clearReplacement = useCallback((fromLabel: string) => {
    setReplacements((prev) => {
      if (!(fromLabel in prev)) return prev;
      const next = { ...prev };
      delete next[fromLabel];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ replacements, setReplacement, clearReplacement }),
    [replacements, setReplacement, clearReplacement],
  );

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbReplacements() {
  return useContext(BreadcrumbContext)?.replacements ?? {};
}

/** Swap a raw route segment (e.g. design id) for a human label in the top bar. */
export function useBreadcrumbReplacement(fromLabel: string | undefined, toLabel: string | undefined) {
  const setReplacement = useContext(BreadcrumbContext)?.setReplacement;
  const clearReplacement = useContext(BreadcrumbContext)?.clearReplacement;

  useEffect(() => {
    if (!setReplacement || !clearReplacement || !fromLabel || !toLabel || fromLabel === toLabel) {
      return;
    }
    setReplacement(fromLabel, toLabel);
    return () => clearReplacement(fromLabel);
  }, [fromLabel, toLabel, setReplacement, clearReplacement]);
}
