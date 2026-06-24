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
}

export function AdminUserList({ initialUsers }: AdminUserListProps) {
  const [users, setUsers] = useState(initialUsers);
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

  return (
    <div className="mt-6 space-y-3">
      {users.map((user) => (
        <Card key={user.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">
                  {user.real_name || user.username || "No name"}
                </p>
                <Badge variant={user.role === "admin" ? "brand" : "default"}>
                  {user.role}
                </Badge>
                {user.status === "suspended" && <Badge variant="danger">Suspended</Badge>}
              </div>
              <p className="text-sm text-gray-500">
                @{user.username} · Joined {formatDate(user.created_at)}
              </p>
            </div>
            <UserActions user={user} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
