import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Gavel, CreditCard, Activity } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: activeAuctions },
    { count: pendingPayments },
    { data: recentLogs },
    { data: revenue },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("auctions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase
      .from("admin_activity_logs")
      .select("*, admin:profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("payments").select("total_amount").eq("status", "verified"),
  ]);

  const totalRevenue = revenue?.reduce((sum, p) => sum + Number(p.total_amount), 0) ?? 0;

  const stats = [
    { label: "Total Users", value: userCount ?? 0, icon: Users, color: "text-blue-600 bg-blue-100" },
    { label: "Active Auctions", value: activeAuctions ?? 0, icon: Gavel, color: "text-green-600 bg-green-100" },
    { label: "Pending Payments", value: pendingPayments ?? 0, icon: CreditCard, color: "text-yellow-600 bg-yellow-100" },
    { label: "Total Revenue", value: formatCurrency(totalRevenue), icon: Activity, color: "text-brand-600 bg-brand-100" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-gray-600">Overview of your auction platform</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 py-6">
              <div className={`rounded-xl p-3 ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs && recentLogs.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{log.action}</p>
                    <p className="text-gray-500">
                      {log.admin?.full_name || log.admin?.email} &middot; {log.entity_type}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No activity yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
