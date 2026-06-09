import { createClient } from "@/lib/supabase/server";
import { UserActions } from "@/components/admin/user-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
      <p className="mt-1 text-gray-600">{users?.length ?? 0} registered users</p>

      <div className="mt-6 space-y-3">
        {users?.map((user) => (
          <Card key={user.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">
                    {user.full_name || "No name"}
                  </p>
                  <Badge variant={user.role === "admin" ? "brand" : "default"}>
                    {user.role}
                  </Badge>
                  {user.is_suspended && <Badge variant="danger">Suspended</Badge>}
                </div>
                <p className="text-sm text-gray-500">
                  {user.email} · Joined {formatDate(user.created_at)}
                </p>
              </div>
              <UserActions user={user} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
