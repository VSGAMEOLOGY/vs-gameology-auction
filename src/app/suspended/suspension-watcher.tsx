"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface SuspensionWatcherProps {
  until: string | null;
}

export function SuspensionWatcher({ until }: SuspensionWatcherProps) {
  const supabase = createClient();

  useEffect(() => {
    if (!until) return;

    async function checkExpiry() {
      if (new Date(until!).getTime() > Date.now()) return;
      const { data: lifted } = await supabase.rpc("lift_expired_suspension");
      if (lifted) window.location.href = "/";
    }

    checkExpiry();
    const interval = setInterval(checkExpiry, 30000);
    return () => clearInterval(interval);
  }, [until, supabase]);

  return null;
}
