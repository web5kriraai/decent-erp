"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getBreadcrumbsForPath, getPageTitle } from "@/config/routes";

export function useRouteMeta() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbsForPath(pathname);
  const title = getPageTitle(pathname);

  useEffect(() => {
    document.title = `${title} · Decent ERP`;
  }, [title]);

  return { pathname, breadcrumbs, title };
}
