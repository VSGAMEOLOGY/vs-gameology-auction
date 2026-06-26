import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function AdminSuspensionsPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Auto-lift expired temporary suspensions when admin views this page
  const { data: expiredSuspensions } = await supabase
    .from("user_suspensions")
    .select("id, user_id")
    .eq("is_active", true)
    .eq("suspension_type", "temporary")
    .lt("suspended_until", now);

  if (expiredSuspensions && expiredSuspensions.length > 0) {
    const expiredIds = expiredSuspensions.map((s) => s.id);
    const expiredUserIds = [...new Set(expiredSuspensions.map((s) => s.user_id))];

    await supabase
      .from("user_suspensions")
      .update({ is_active: false })
      .in("id", expiredIds);

    // Check which users have no remaining active suspensions and restore them
    const { data: remainingActive } = await supabase
      .from("user_suspensions")
      .select("user_id")
      .in("user_id", expiredUserIds)
      .eq("is_active", true);

    const stillSuspendedIds = new Set((remainingActive ?? []).map((s) => s.user_id));
    const nowFreeUserIds = expiredUserIds.filter((id) => !stillSuspendedIds.has(id));

    if (nowFreeUserIds.length > 0) {
      await supabase
        .from("profiles")
        .update({ status: "active" })
        .in("id", nowFreeUserIds);
    }
  }

  const [{ data: active }, { data: blacklist }, { data: history }] = await Promise.all([
    supabase
      .from("user_suspensions")
      .select("*")
      .eq("is_active", true)
      .or(`suspension_type.eq.permanent,suspended_until.gt.${now}`)
      .order("created_at", { ascending: false }),
    supabase.from("blacklist").select("*").order("created_at", { ascending: false }),
    supabase
      .from("user_suspensions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const userIds = [...new Set([...(active ?? []), ...(history ?? [])].map((s) => s.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, real_name, username").in("id", userIds)
    : { data: [] as { id: string; real_name: string; username: string }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const suspended = (active ?? []).map((s) => ({ ...s, profile: profileById.get(s.user_id) }));

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
          {suspended.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {suspended.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{s.profile?.real_name || s.profile?.username || "Unknown user"}</p>
                    <p className="text-sm text-gray-500">{s.reason}</p>
                  </div>
                  {s.suspension_type === "temporary" && s.suspended_until ? (
                    <Badge variant="warning">Until {formatDate(s.suspended_until)}</Badge>
                  ) : (
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
              {history.map((record) => {
                const profile = profileById.get(record.user_id);
                return (
                  <div key={record.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">{profile?.real_name || profile?.username || "Unknown user"}</p>
                      <p className="text-gray-500">{record.reason}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={record.suspension_type === "permanent" ? "danger" : "warning"}>
                        {record.suspension_type}
                        {!record.is_active && " (lifted)"}
                      </Badge>
                      <p className="mt-1 text-xs text-gray-400">{formatDate(record.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No suspension history</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
