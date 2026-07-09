import { createClient } from "@/lib/supabase/server";
import { WatchlistGrid } from "@/components/auctions/watchlist-grid";
import { Heart } from "lucide-react";
import type { Auction } from "@/types/database";

export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from("watchlists")
    .select("*, auction:auctions(*)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const auctions =
    items?.map((item) => item.auction).filter((a): a is Auction => a !== null) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Heart className="h-7 w-7 text-red-500" />
        <h1 className="text-2xl font-bold text-gray-900">My Watchlist</h1>
      </div>

      <WatchlistGrid userId={user!.id} initialAuctions={auctions} />
    </div>
  );
}
