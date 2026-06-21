"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WatchlistButtonProps {
  auctionId: string;
  userId: string;
}

export function WatchlistButton({ auctionId, userId }: WatchlistButtonProps) {
  const [isWatching, setIsWatching] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function check() {
      const { data } = await supabase
        .from("watchlists")
        .select("id")
        .eq("user_id", userId)
        .eq("auction_id", auctionId)
        .maybeSingle();
      setIsWatching(!!data);
    }
    check();
  }, [auctionId, userId, supabase]);

  async function toggle() {
    setLoading(true);
    if (isWatching) {
      await supabase
        .from("watchlists")
        .delete()
        .eq("user_id", userId)
        .eq("auction_id", auctionId);
      setIsWatching(false);
    } else {
      await supabase.from("watchlists").insert({ user_id: userId, auction_id: auctionId });
      setIsWatching(true);
    }
    setLoading(false);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      loading={loading}
      className={cn(isWatching && "border-red-300 text-red-600")}
    >
      <Heart className={cn("h-4 w-4", isWatching && "fill-red-500")} />
      {isWatching ? "Watching" : "Watch"}
    </Button>
  );
}
