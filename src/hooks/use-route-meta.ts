"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useBreadcrumbReplacements } from "@/components/layout/BreadcrumbProvider";
import { getBreadcrumbsForPath, getPageTitle } from "@/config/routes";

/** Breadcrumbs + page title for the shell. Document title comes from Next.js metadata. */
export function useRouteMeta() {
  const pathname = usePathname();
  const replacements = useBreadcrumbReplacements();

  const breadcrumbs = useMemo(() => {
    const base = getBreadcrumbsForPath(pathname);
    if (Object.keys(replacements).length === 0) return base;
    return base.map((crumb) =>
      replacements[crumb.label] ? { ...crumb, label: replacements[crumb.label] } : crumb,
    );
  }, [pathname, replacements]);

  const title = breadcrumbs[breadcrumbs.length - 1]?.label ?? getPageTitle(pathname);

  return { pathname, breadcrumbs, title };
}
