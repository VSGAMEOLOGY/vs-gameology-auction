import { createClient } from "@/lib/supabase/server";
import { AdminUserList } from "@/components/admin/admin-user-list";

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

      <AdminUserList initialUsers={users ?? []} />
    </div>
  );
}
