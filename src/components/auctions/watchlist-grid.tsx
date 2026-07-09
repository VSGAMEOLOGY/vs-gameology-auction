"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuctionCard } from "@/components/auctions/auction-card";
import type { Auction } from "@/types/database";

interface WatchlistGridProps {
  userId: string;
  initialAuctions: Auction[];
}

export function WatchlistGrid({ userId, initialAuctions }: WatchlistGridProps) {
  const [auctions, setAuctions] = useState(initialAuctions);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const supabase = createClient();

  async function handleRemove(auctionId: number) {
    setRemovingId(auctionId);
    const { error } = await supabase
      .from("watchlists")
      .delete()
      .eq("user_id", userId)
      .eq("auction_id", auctionId);
    setRemovingId(null);
    if (!error) {
      setAuctions((prev) => prev.filter((a) => a.id !== auctionId));
    }
  }

  if (auctions.length === 0) {
    return (
      <div className="mt-12 text-center text-gray-500">
        <Heart className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-4 text-lg">Your watchlist is empty</p>
        <p className="mt-1 text-sm">Add auctions to track them here</p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {auctions.map((auction) => (
        <div key={auction.id} className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRemove(auction.id);
            }}
            disabled={removingId === auction.id}
            aria-label="Remove from watchlist"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-sm transition-colors hover:bg-white disabled:opacity-50"
          >
            <Heart className="h-4 w-4 fill-red-500" />
          </button>
          <AuctionCard auction={auction} />
        </div>
      ))}
    </div>
  );
}
