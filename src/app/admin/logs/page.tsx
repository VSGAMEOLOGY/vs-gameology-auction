import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function AdminLogsPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("admin_activity_logs")
    .select("*, admin:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Activity Audit Logs</h1>
      <p className="mt-1 text-gray-600">Complete admin action history</p>

      <div className="mt-6">
        {logs && logs.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Time</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Admin</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Entity</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {log.admin?.full_name || log.admin?.email}
                        </td>
                        <td className="px-4 py-3 font-medium">{log.action}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {log.entity_type}
                          {log.entity_id && (
                            <span className="block text-xs text-gray-400">
                              {log.entity_id.slice(0, 8)}...
                            </span>
                          )}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-gray-500">
                          {log.details ? JSON.stringify(log.details) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="text-gray-500">No activity logs yet</p>
        )}
      </div>
    </div>
  );
}
