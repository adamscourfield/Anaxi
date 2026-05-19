"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    void load();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    void load();
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="calm-transition relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-container-low hover:bg-surface-container"
        aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M10 2a5 5 0 0 0-5 5v2.5L3 12v1h14v-1l-2-2.5V7a5 5 0 0 0-5-5Z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path d="M8 14a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-on-primary">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface-container-lowest shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-semibold text-text">Notifications</span>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() => void markAllRead()}
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            <ul className="max-h-80 overflow-y-auto py-1">
              {items.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted">No new notifications</li>
              ) : (
                items.map((item) => (
                  <li key={item.id} className="border-b border-border/60 last:border-0">
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="block px-3 py-2.5 hover:bg-surface-container-low"
                        onClick={() => {
                          void markRead(item.id);
                          setOpen(false);
                        }}
                      >
                        <p className="text-sm font-medium text-text">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{item.body}</p>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full px-3 py-2.5 text-left hover:bg-surface-container-low"
                        onClick={() => void markRead(item.id)}
                      >
                        <p className="text-sm font-medium text-text">{item.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{item.body}</p>
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
