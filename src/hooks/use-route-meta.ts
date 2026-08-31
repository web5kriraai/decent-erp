"use client";

import { usePathname } from "next/navigation";
import { getBreadcrumbsForPath, getPageTitle } from "@/config/routes";

/** Breadcrumbs + page title for the shell. Document title comes from Next.js metadata. */
export function useRouteMeta() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbsForPath(pathname);
  const title = getPageTitle(pathname);

  return { pathname, breadcrumbs, title };
}
