"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BellIcon } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api-client";
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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.list,
    queryFn: () => apiGet<NotificationsResponse>("/api/notifications"),
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      apiPatch(`/api/notifications`, { notificationId }),
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
        <BellIcon className="size-4" aria-hidden />
        {unread > 0 ? <span className="notification-bell-badge">{unread}</span> : null}
      </button>
      {open ? (
        <div className="notification-bell-panel" role="menu">
          <p className="notification-bell-title">Notifications</p>
          {items.length === 0 ? (
            <p className="notification-bell-empty">No notifications yet.</p>
          ) : (
            <ul className="notification-bell-list">
              {items.map((item) => (
                <li key={item.id} className={cn(!item.readAtUtc && "notification-bell-item--unread")}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="notification-bell-item"
                      onClick={() => {
                        if (!item.readAtUtc) markRead.mutate(item.id);
                        setOpen(false);
                      }}
                    >
                      <span className="notification-bell-item-title">{item.title}</span>
                      <span className="notification-bell-item-body">{item.body.split("\n")[0]}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="notification-bell-item"
                      onClick={() => {
                        if (!item.readAtUtc) markRead.mutate(item.id);
                      }}
                    >
                      <span className="notification-bell-item-title">{item.title}</span>
                      <span className="notification-bell-item-body">{item.body.split("\n")[0]}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
