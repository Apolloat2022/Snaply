"use client";

import { useMemo, useState } from "react";
import type { SellerNotification } from "@/types/notification";

interface NotificationListProps {
  sellerId: string;
  initialNotifications: SellerNotification[];
}

export default function NotificationList({ sellerId, initialNotifications }: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

    const response = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });

    if (!response.ok) {
      // Roll back on failure so the UI doesn't lie about server state.
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    }
  }

  async function markAllRead() {
    const previous = notifications;
    setIsMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerId }),
    });

    if (!response.ok) {
      setNotifications(previous);
    }
    setIsMarkingAll(false);
  }

  if (notifications.length === 0) {
    return <p className="text-sm text-neutral-500">No notifications yet — they'll show up here when your items sell.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={isMarkingAll}
            className="text-sm font-medium text-neutral-600 underline disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border p-4 ${n.read ? "border-neutral-200 bg-white" : "border-neutral-900 bg-neutral-50"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-neutral-900">{n.title}</p>
                <p className="mt-1 text-sm text-neutral-600">{n.body}</p>
                <p className="mt-2 text-xs text-neutral-400">{new Date(n.createdAt).toLocaleString()}</p>
                {n.listingId && (
                  <a href={`/listings/${n.listingId}`} className="mt-1 inline-block text-xs font-medium underline">
                    View listing
                  </a>
                )}
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="shrink-0 rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700"
                >
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
