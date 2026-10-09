"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IconBell } from "@/components/icons";
import { apiGet, apiPatch } from "@/lib/api-client";
import { notificationDescription } from "@/lib/notifications/messages";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  readAtUtc?: string | null;
  createdAtUtc: string;
};

type NotificationsResponse = {
  items: NotificationRow[];
  unreadCount: number;
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.list,
    queryFn: () => apiGet<NotificationsResponse>("/api/notifications"),
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      apiPatch(`/api/notifications`, { notificationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => apiPatch(`/api/notifications`, { all: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list });
    },
  });

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const unread = notificationsQuery.data?.unreadCount ?? 0;
  const items = notificationsQuery.data?.items ?? [];

  return (
    <div className="notification-bell-wrap" ref={panelRef}>
      <button
        type="button"
        className="notification-bell-btn"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell className="size-4" aria-hidden />
        {unread > 0 ? <span className="notification-bell-badge">{unread}</span> : null}
      </button>
      {open ? (
        <div className="notification-bell-panel" role="dialog" aria-label="Notifications">
          <div className="notification-bell-header">
            <div>
              <p className="notification-bell-title">Notifications</p>
              <p className="notification-bell-count">
                {unread > 0 ? `${unread} unread` : "All caught up"}
              </p>
            </div>
            <button
              type="button"
              className="notification-bell-mark-all"
              disabled={unread === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="notification-bell-empty">No notifications yet.</p>
          ) : (
            <ul className="notification-bell-list">
              {items.map((item) => {
                const unreadItem = !item.readAtUtc;
                const description = notificationDescription(item.body);
                const content = (
                  <>
                    <span
                      className={cn(
                        "notification-bell-dot",
                        unreadItem && "notification-bell-dot--unread",
                      )}
                      aria-hidden
                    />
                    <span className="notification-bell-item-copy">
                      <span className="notification-bell-item-title">{item.title}</span>
                      <span className="notification-bell-item-body">{description}</span>
                      <time className="notification-bell-item-time" dateTime={item.createdAtUtc}>
                        {relativeTime(item.createdAtUtc)}
                      </time>
                    </span>
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className={cn(
                          "notification-bell-item",
                          unreadItem && "notification-bell-item--unread",
                        )}
                        onClick={() => {
                          if (unreadItem) markRead.mutate(item.id);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={cn(
                          "notification-bell-item",
                          unreadItem && "notification-bell-item--unread",
                        )}
                        onClick={() => {
                          if (unreadItem) markRead.mutate(item.id);
                        }}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
