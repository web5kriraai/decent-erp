"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet } from "@/lib/api-client";
import type { DesignListResponse } from "@/lib/types/api";

type GlobalSearchCommandProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GlobalSearchCommand({ open, onOpenChange }: GlobalSearchCommandProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canSearchDesigns = permissions.includes(PERMISSIONS.DESIGN_CREATE);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DesignListResponse["items"]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (term: string) => {
      if (!canSearchDesigns || term.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await apiGet<DesignListResponse>(
          `/api/designs?search=${encodeURIComponent(term.trim())}&limit=8`,
        );
        setResults(data.items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [canSearchDesigns],
  );

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      setResults([]);
    }
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void search(query), 250);
    return () => clearTimeout(timer);
  }, [open, query, search]);

  function navigate(href: string) {
    handleOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search Decent ERP"
      description="Search designs by idea reference or collection name"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search designs, collections…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!canSearchDesigns && (
          <CommandEmpty>You do not have permission to search designs.</CommandEmpty>
        )}
        {canSearchDesigns && query.trim().length < 2 && (
          <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
        )}
        {canSearchDesigns && query.trim().length >= 2 && !loading && results.length === 0 && (
          <CommandEmpty>No designs found.</CommandEmpty>
        )}
        {canSearchDesigns && results.length > 0 && (
          <CommandGroup heading="Designs">
            {results.map((d) => (
              <CommandItem
                key={d.id}
                value={`${d.ideaRef} ${d.collectionName}`}
                onSelect={() => navigate(ROUTES.designs.detail(d.id))}
              >
                <span className="font-medium">{d.ideaRef}</span>
                <span className="ml-2 text-muted-foreground">{d.collectionName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {permissions.includes(PERMISSIONS.TASK_EXECUTE) && (
          <CommandGroup heading="Quick links">
            <CommandItem onSelect={() => navigate(ROUTES.work.tasks)}>My Tasks</CommandItem>
            <CommandItem onSelect={() => navigate(ROUTES.work.myTime)}>My Time Today</CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function useGlobalSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);
}
