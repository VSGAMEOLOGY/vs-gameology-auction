import { createClient } from "@/lib/supabase/server";
import { AuctionCard } from "@/components/auctions/auction-card";
import { Heart } from "lucide-react";

export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from("watchlists")
    .select("*, auction:auctions(*)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const auctions = items?.map((item) => item.auction).filter(Boolean) ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Heart className="h-7 w-7 text-red-500" />
        <h1 className="text-2xl font-bold text-gray-900">My Watchlist</h1>
      </div>

      {auctions.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((auction) => (
            <AuctionCard key={auction!.id} auction={auction!} />
          ))}
        </div>
      ) : (
        <div className="mt-12 text-center text-gray-500">
          <Heart className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-lg">Your watchlist is empty</p>
          <p className="mt-1 text-sm">Add auctions to track them here</p>
        </div>
      )}
    </div>
  );
}
