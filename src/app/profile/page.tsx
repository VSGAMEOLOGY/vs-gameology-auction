import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/profile-form";
import { AddressManager } from "@/components/profile/address-manager";

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: addresses } = await supabase
    .from("shipping_addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false });

  if (!profile) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          Your profile is still being set up. Please refresh the page in a moment, or contact support if this persists.
        </div>
        <AddressManager addresses={[]} userId={user.id} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileForm profile={profile} />
      <AddressManager addresses={addresses ?? []} userId={user.id} />
    </div>
  );
}