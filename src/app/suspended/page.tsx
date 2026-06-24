import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export default async function SuspendedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let reason = "Your account has been suspended.";
  let until: string | null = null;

  if (user) {
    const { data: suspension } = await supabase
      .from("user_suspensions")
      .select("reason, suspended_until")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (suspension?.reason) reason = suspension.reason;
    if (suspension?.suspended_until) until = suspension.suspended_until;
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-xl font-bold text-gray-900">Account Suspended</h1>
          <p className="mt-2 text-gray-600">{reason}</p>
          {until && (
            <p className="mt-2 text-sm text-gray-500">
              Suspension ends: {formatDate(until)}
            </p>
          )}
          <p className="mt-4 text-sm text-gray-500">
            Contact <a href="mailto:support@vsgameology.com" className="text-brand-600">support@vsgameology.com</a> for assistance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
