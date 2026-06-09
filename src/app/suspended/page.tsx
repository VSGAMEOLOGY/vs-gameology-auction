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
    const { data: profile } = await supabase
      .from("profiles")
      .select("suspension_reason, suspended_until, is_suspended")
      .eq("id", user.id)
      .single();

    if (profile?.suspension_reason) reason = profile.suspension_reason;
    if (profile?.suspended_until) until = profile.suspended_until;
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
