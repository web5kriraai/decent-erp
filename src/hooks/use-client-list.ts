"use client";

import { useEffect, useMemo, useState } from "react";

export type UseClientListOptions<T> = {
  items: T[];
  /** Concatenate fields to search. Prefer this over inline match fns. */
  getSearchText?: (item: T) => string;
  /** Extra filter key (e.g. status). Changing it resets page to 1. */
  filterKey?: string | number | boolean | null;
  initialPageSize?: number;
};

export type ClientListState<T> = {
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  filtered: T[];
  pageItems: T[];
  total: number;
};

/**
 * Client-side search + pagination for list pages.
 * Resets to page 1 when search, page size, or filterKey changes.
 */
export function useClientList<T>({
  items,
  getSearchText,
  filterKey,
  initialPageSize = 25,
}: UseClientListOptions<T>): ClientListState<T> {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    if (!getSearchText) return items;
    return items.filter((item) => getSearchText(item).toLowerCase().includes(q));
  }, [items, getSearchText, search]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, filterKey]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    search,
    setSearch,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    filtered,
    pageItems,
    total,
  };
}
