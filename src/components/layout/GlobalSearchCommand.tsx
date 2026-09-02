"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Loader2Icon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getVisibleNavSections, ROUTES, type NavLink } from "@/config/routes";
import { IconLogout, IconPlus, IconTasks } from "@/components/icons";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet } from "@/lib/api-client";
import type { DesignListResponse, DesignSummary, DesignTask } from "@/lib/types/api";
import { cn } from "@/lib/utils";

const RECENT_STORAGE_KEY = "decent-erp.cmdk.recent";
const RECENT_LIMIT = 5;
const ACTIVE_TASK_STATUSES = new Set(["READY", "RUNNING", "HOLD", "ASSIGNED", "IN_PROGRESS"]);

type GlobalSearchCommandProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type RecentEntry = {
  href: string;
  label: string;
  subtitle?: string;
};

type PageItem = {
  id: string;
  label: string;
  href: string;
  sectionLabel: string;
  icon?: NavLink["icon"];
};

function matchesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  return haystack.toLowerCase().includes(query.toLowerCase());
}

function readRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentEntry =>
          !!item &&
          typeof item === "object" &&
          typeof (item as RecentEntry).href === "string" &&
          typeof (item as RecentEntry).label === "string",
      )
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function writeRecent(entry: RecentEntry) {
  if (typeof window === "undefined") return;
  const existing = readRecent().filter((item) => item.href !== entry.href);
  const next = [entry, ...existing].slice(0, RECENT_LIMIT);
  window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
}

function taskSearchBlob(task: DesignTask): string {
  return [
    task.design.ideaRef,
    task.design.collectionName,
    task.process.name,
    task.subProcess.name,
    task.status,
    task.effectiveStatus ?? "",
  ].join(" ");
}

function taskLabel(task: DesignTask): string {
  return `${task.design.ideaRef} · ${task.subProcess.name}`;
}

export function GlobalSearchCommand({ open, onOpenChange }: GlobalSearchCommandProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const permissions = useMemo(
    () => session?.user?.permissions ?? [],
    [session?.user?.permissions],
  );
  const roleCode = session?.user?.roleCode;
  const isAuthenticated = sessionStatus === "authenticated";
  const canExecuteTasks = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const canCreateDesign = permissions.includes(PERMISSIONS.DESIGN_CREATE);

  const [query, setQuery] = useState("");
  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [designsLoading, setDesignsLoading] = useState(false);
  const [tasks, setTasks] = useState<DesignTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  const trimmed = query.trim();
  const searchingEntities = trimmed.length >= 2;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setQuery("");
        setDesigns([]);
        setDesignsLoading(false);
      } else {
        setRecent(readRecent());
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const navigate = useCallback(
    (href: string, label: string, subtitle?: string) => {
      writeRecent({ href, label, subtitle });
      handleOpenChange(false);
      router.push(href);
    },
    [handleOpenChange, router],
  );

  const pageItems = useMemo<PageItem[]>(() => {
    const sections = getVisibleNavSections(permissions, roleCode);
    return sections.flatMap((section) =>
      section.items.map((item) => ({
        id: item.id,
        label: item.label,
        href: item.href,
        sectionLabel: section.label,
        icon: item.icon,
      })),
    );
  }, [permissions, roleCode]);

  const filteredPages = useMemo(
    () =>
      pageItems.filter((item) =>
        matchesQuery(`${item.label} ${item.sectionLabel}`, trimmed),
      ),
    [pageItems, trimmed],
  );

  const filteredTasks = useMemo(() => {
    if (!canExecuteTasks) return [];
    if (!searchingEntities) {
      return tasks
        .filter((task) =>
          ACTIVE_TASK_STATUSES.has((task.effectiveStatus ?? task.status).toUpperCase()),
        )
        .slice(0, 5);
    }
    return tasks.filter((task) => matchesQuery(taskSearchBlob(task), trimmed)).slice(0, 8);
  }, [canExecuteTasks, searchingEntities, tasks, trimmed]);

  const filteredActions = useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      keywords: string;
      icon: typeof IconPlus;
      run: () => void;
    }> = [];

    if (canCreateDesign) {
      items.push({
        id: "new-concept",
        label: "New Concept",
        keywords: "new design create concept",
        icon: IconPlus,
        run: () => navigate(ROUTES.designs.new, "New Concept"),
      });
    }

    items.push({
      id: "sign-out",
      label: "Sign out",
      keywords: "logout sign out exit",
      icon: IconLogout,
      run: () => {
        handleOpenChange(false);
        void signOut({ callbackUrl: ROUTES.login });
      },
    });

    return items.filter((item) => matchesQuery(`${item.label} ${item.keywords}`, trimmed));
  }, [canCreateDesign, handleOpenChange, navigate, trimmed]);

  const searchDesigns = useCallback(
    async (term: string) => {
      if (!isAuthenticated || term.trim().length < 2) {
        setDesigns([]);
        return;
      }
      setDesignsLoading(true);
      try {
        const data = await apiGet<DesignListResponse>(
          `/api/designs?search=${encodeURIComponent(term.trim())}&limit=8`,
        );
        setDesigns(data.items);
      } catch {
        setDesigns([]);
      } finally {
        setDesignsLoading(false);
      }
    },
    [isAuthenticated],
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setRecent(readRecent());
      if (!canExecuteTasks) {
        setTasks([]);
        return;
      }
      setTasksLoading(true);
      void apiGet<DesignTask[]>("/api/tasks/my")
        .then((data) => setTasks(data))
        .catch(() => setTasks([]))
        .finally(() => setTasksLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, canExecuteTasks]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void searchDesigns(query), 250);
    return () => clearTimeout(timer);
  }, [open, query, searchDesigns]);

  const showRecent = !trimmed && recent.length > 0;
  const showActiveTasks = !searchingEntities && filteredTasks.length > 0;
  const showTaskResults = searchingEntities && canExecuteTasks;
  const showDesignResults = searchingEntities && isAuthenticated;
  const isLoading = designsLoading || (canExecuteTasks && tasksLoading && tasks.length === 0);

  const hasStaticResults =
    filteredPages.length > 0 ||
    filteredActions.length > 0 ||
    showRecent ||
    showActiveTasks;

  const hasEntityResults =
    (showDesignResults && designs.length > 0) ||
    (showTaskResults && filteredTasks.length > 0);

  const showEmpty =
    !isLoading &&
    !hasStaticResults &&
    !hasEntityResults &&
    !(showDesignResults && designsLoading) &&
    !(canExecuteTasks && tasksLoading);

  let emptyMessage = "No results found.";
  if (searchingEntities && !designsLoading && !tasksLoading) {
    emptyMessage = "No matching pages, designs, or tasks.";
  } else if (!trimmed) {
    emptyMessage = "No pages available.";
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search Decent ERP"
      description="Jump to pages, search designs and tasks, or run actions"
      shouldFilter={false}
      className="sm:max-w-xl"
    >
      <CommandInput
        placeholder="Search or jump to…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-80">
        {showEmpty ? <CommandEmpty>{emptyMessage}</CommandEmpty> : null}

        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Searching…
          </div>
        ) : null}

        {showRecent ? (
          <CommandGroup heading="Recent">
            {recent.map((item) => (
              <CommandItem
                key={`recent-${item.href}`}
                value={`recent ${item.label} ${item.subtitle ?? ""} ${item.href}`}
                onSelect={() => navigate(item.href, item.label, item.subtitle)}
              >
                <IconTasks size={16} className="text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                {item.subtitle ? (
                  <span className="truncate text-muted-foreground">{item.subtitle}</span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {filteredPages.length > 0 ? (
          <CommandGroup heading="Pages">
            {filteredPages.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.id}
                  value={`page ${item.label} ${item.sectionLabel}`}
                  onSelect={() => navigate(item.href, item.label, item.sectionLabel)}
                >
                  {Icon ? <Icon size={16} className="text-muted-foreground" /> : null}
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{item.sectionLabel}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}

        {showActiveTasks ? (
          <CommandGroup heading="Active tasks">
            {filteredTasks.map((task) => (
              <CommandItem
                key={`active-${task.id}`}
                value={`task ${taskSearchBlob(task)}`}
                onSelect={() =>
                  navigate(
                    ROUTES.work.taskDetail(task.id),
                    taskLabel(task),
                    task.design.collectionName,
                  )
                }
              >
                <IconTasks size={16} className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{taskLabel(task)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {task.design.collectionName} · {task.effectiveStatus ?? task.status}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {showTaskResults && filteredTasks.length > 0 ? (
          <CommandGroup heading="My Tasks">
            {filteredTasks.map((task) => (
              <CommandItem
                key={`task-${task.id}`}
                value={`task ${taskSearchBlob(task)}`}
                onSelect={() =>
                  navigate(
                    ROUTES.work.taskDetail(task.id),
                    taskLabel(task),
                    task.design.collectionName,
                  )
                }
              >
                <IconTasks size={16} className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{taskLabel(task)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {task.design.collectionName} · {task.effectiveStatus ?? task.status}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {showDesignResults && designsLoading && designs.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Searching designs…
          </div>
        ) : null}

        {showDesignResults && designs.length > 0 ? (
          <CommandGroup heading="Designs">
            {designs.map((design) => (
              <CommandItem
                key={design.id}
                value={`design ${design.ideaRef} ${design.collectionName} ${design.status}`}
                onSelect={() =>
                  navigate(
                    ROUTES.designs.detail(design.id),
                    design.ideaRef,
                    design.collectionName,
                  )
                }
              >
                <span className="min-w-0 flex-1 truncate font-medium">{design.ideaRef}</span>
                <span className="truncate text-muted-foreground">{design.collectionName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{design.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {filteredActions.length > 0 ? (
          <CommandGroup heading="Actions">
            {filteredActions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.id}
                  value={`action ${action.label} ${action.keywords}`}
                  onSelect={action.run}
                >
                  <Icon size={16} className="text-muted-foreground" />
                  <span className="font-medium">{action.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
      </CommandList>

      <div
        className={cn(
          "flex items-center gap-3 border-t border-border/80 px-3 py-2 text-[11px] text-muted-foreground",
        )}
      >
        <span>
          <kbd className="rounded border bg-muted px-1 py-0.5 font-medium">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="rounded border bg-muted px-1 py-0.5 font-medium">↵</kbd> open
        </span>
        <span>
          <kbd className="rounded border bg-muted px-1 py-0.5 font-medium">esc</kbd> close
        </span>
      </div>
    </CommandDialog>
  );
}

export function useGlobalSearchShortcut(onToggle: () => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onToggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onToggle]);
}
