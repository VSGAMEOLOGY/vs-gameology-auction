import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/profile-form";
import { AddressManager } from "@/components/profile/address-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile, error } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user!.id)
  .single();


  const { data: addresses } = await supabase
    .from("shipping_addresses")
    .select("*")
    .eq("user_id", user!.id)
    .order("is_default", { ascending: false });

    
    return (
      <div className="space-y-6">
        <ProfileForm profile={profile} />
    
        <AddressManager
          addresses={addresses ?? []}
          userId={user!.id}
        />
      </div>
    );