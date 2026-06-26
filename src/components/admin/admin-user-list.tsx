"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserActions } from "@/components/admin/user-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/types/database";

interface AdminUserListProps {
  initialUsers: Profile[];
  suspensionCounts?: Record<string, number>;
}

export function AdminUserList({ initialUsers, suspensionCounts = {} }: AdminUserListProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-users-list")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const updated = payload.new as Profile;
          setUsers((prev) =>
            prev.map((user) => (user.id === updated.id ? updated : user))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const filtered = search.trim()
    ? users.filter((u) => {
        const term = search.toLowerCase();
        return (
          u.username?.toLowerCase().includes(term) ||
          u.real_name?.toLowerCase().includes(term)
        );
      })
    : users;

  return (
    <div className="mt-6 space-y-3">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, username, or email…"
        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      {filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No users match your search.</p>
      )}

      {filtered.map((user) => {
        const suspendedCount = suspensionCounts[user.id] ?? 0;
        return (
          <Card key={user.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-900">
                    {user.real_name || user.username || "No name"}
                  </p>
                  <Badge variant={user.role === "admin" ? "brand" : "default"}>
                    {user.role}
                  </Badge>
                  {user.status === "suspended" && <Badge variant="danger">Suspended</Badge>}
                  {suspendedCount > 0 && (
                    <Badge variant="warning">Suspended {suspendedCount}x</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  @{user.username} · Joined {formatDate(user.created_at)}
                </p>
              </div>
              <UserActions
                user={user}
                onStatusChange={(status) =>
                  setUsers((prev) =>
                    prev.map((u) => (u.id === user.id ? { ...u, status } : u))
                  )
                }
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
