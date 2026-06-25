import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { SuspensionWatcher } from "./suspension-watcher";

export default async function SuspendedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let reason = "Your account has been suspended.";
  let until: string | null = null;
  let username = "";

  if (user) {
    const [{ data: suspension }, { data: profile }] = await Promise.all([
      supabase
        .from("user_suspensions")
        .select("reason, suspended_until")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("username").eq("id", user.id).single(),
    ]);

    if (suspension?.reason) reason = suspension.reason;
    if (suspension?.suspended_until) until = suspension.suspended_until;
    if (profile?.username) username = profile.username;
  }

  const whatsappMessage = `Hi VS GAMEOLOGY, my account has been suspended and I would like to appeal. My username is ${username || "N/A"}.`;
  const whatsappUrl = `https://wa.me/60139681228?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <SuspensionWatcher until={until} />
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
            Contact us on{" "}
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600">
              WhatsApp
            </a>{" "}
            for assistance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
