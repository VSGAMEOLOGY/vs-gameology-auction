"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SuspensionListener() {
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!pathname.startsWith("/suspended")) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", user.id)
          .single();

        if (profile?.status === "suspended") {
          await supabase.rpc("lift_expired_suspension");
          const { data: rechecked } = await supabase
            .from("profiles")
            .select("status")
            .eq("id", user.id)
            .single();
          if (rechecked?.status === "suspended") {
            window.location.href = "/suspended";
            return;
          }
        }
      }

      channel = supabase
        .channel(`profile-status-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new as { status: string };
            if (updated.status === "suspended" && !pathname.startsWith("/suspended")) {
              window.location.href = "/suspended";
            }
          }
        )
        .subscribe();
    }

    subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, pathname]);

  return null;
}
