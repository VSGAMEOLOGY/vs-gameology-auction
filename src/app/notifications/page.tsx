"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Notification } from "@/types/database";

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const supabase = createClient();

  async function loadPage(offset: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    return data ?? [];
  }

  useEffect(() => {
    async function load() {
      const data = await loadPage(0);
      setNotifications(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function loadMore() {
    setLoadingMore(true);
    const data = await loadPage(notifications.length);
    setNotifications((prev) => [...prev, ...data]);
    setHasMore(data.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function markRead(id: number) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  async function dismissNotification(id: number) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase
      .from("notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-7 w-7 text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        </div>
        {notifications.some((n) => !n.is_read) && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <p className="mt-8 text-center text-gray-500">Loading...</p>
      ) : notifications.length > 0 ? (
        <div className="mt-6 space-y-3">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={notification.is_read ? "opacity-60" : "border-brand-200"}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{notification.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                    <p className="mt-2 text-xs text-gray-400">
                      {formatDate(notification.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    {!notification.is_read && (
                      <Button variant="ghost" size="sm" onClick={() => markRead(notification.id)}>
                        Mark read
                      </Button>
                    )}
                    {notification.related_auction_id != null && (
                      <Link
                        href={
                          notification.notification_type === "payment_submitted"
                            ? "/admin/payments"
                            : notification.notification_type === "auction_won" ||
                                notification.notification_type === "payment_verified" ||
                                notification.notification_type === "payment_rejected" ||
                                notification.notification_type === "order_dispatched" ||
                                notification.notification_type === "order_delivered" ||
                                notification.notification_type === "collection_confirmed"
                              ? `/payments/${notification.related_auction_id}`
                              : `/auctions/${notification.related_auction_id}`
                        }
                        onClick={() => {
                          if (
                            notification.notification_type === "bid_outbid" &&
                            !notification.is_read
                          ) {
                            markRead(notification.id);
                          }
                        }}
                      >
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => dismissNotification(notification.id)}
                      aria-label="Dismiss notification"
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {hasMore && (
            <div className="pt-2 text-center">
              <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-12 text-center text-gray-500">
          <Bell className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4">No notifications yet</p>
        </div>
      )}
    </div>
  );
}
