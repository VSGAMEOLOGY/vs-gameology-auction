import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function AdminSuspensionsPage() {
  const supabase = await createClient();

  const [{ data: suspended }, { data: blacklist }, { data: history }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .or("is_suspended.eq.true,suspended_until.gt.now()")
      .order("updated_at", { ascending: false }),
    supabase.from("blacklist").select("*").order("created_at", { ascending: false }),
    supabase
      .from("suspension_history")
      .select("*, user:profiles!suspension_history_user_id_fkey(full_name, email), admin:profiles!suspension_history_suspended_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Suspension Management</h1>
        <p className="mt-1 text-gray-600">Manage suspended users and blacklist</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currently Suspended ({suspended?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {suspended && suspended.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {suspended.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{user.full_name || user.email}</p>
                    <p className="text-sm text-gray-500">{user.suspension_reason}</p>
                  </div>
                  {user.suspended_until && (
                    <Badge variant="warning">Until {formatDate(user.suspended_until)}</Badge>
                  )}
                  {!user.suspended_until && user.is_suspended && (
                    <Badge variant="danger">Permanent</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No suspended users</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blacklist ({blacklist?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {blacklist && blacklist.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {blacklist.map((entry) => (
                <div key={entry.id} className="py-3">
                  <p className="font-medium">{entry.email}</p>
                  <p className="text-sm text-gray-500">{entry.reason}</p>
                  <p className="text-xs text-gray-400">{formatDate(entry.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No blacklisted emails</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suspension History</CardTitle>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {history.map((record) => (
                <div key={record.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {(record as { user?: { full_name?: string; email?: string } }).user?.full_name ||
                        (record as { user?: { email?: string } }).user?.email}
                    </p>
                    <p className="text-gray-500">{record.reason}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={record.type === "permanent" ? "danger" : "warning"}>
                      {record.type}
                    </Badge>
                    <p className="mt-1 text-xs text-gray-400">{formatDate(record.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No suspension history</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
