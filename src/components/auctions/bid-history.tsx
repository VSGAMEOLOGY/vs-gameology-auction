"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Bid } from "@/types/database";

interface BidHistoryProps {
  auctionId: string;
}

export function BidHistory({ auctionId }: BidHistoryProps) {
  const [bids, setBids] = useState<Bid[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadBids() {
      const { data } = await supabase
        .from("bids")
        .select("*, bidder:profiles(real_name, username)")
        .eq("auction_id", auctionId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setBids(data as Bid[]);
    }
    loadBids();

    const channel = supabase
      .channel(`bids-${auctionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `auction_id=eq.${auctionId}` },
        () => loadBids()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionId, supabase]);

  if (bids.length === 0) {
    return <p className="text-sm text-gray-500">No bids yet. Be the first!</p>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {bids.map((bid, i) => (
        <div key={bid.id} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">
            {bid.bidder?.real_name || bid.bidder?.username || "Anonymous"}
              {i === 0 && (
                <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                  Highest
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">{formatDate(bid.created_at)}</p>
          </div>
          <p className="font-semibold text-brand-600">{formatCurrency(bid.amount)}</p>
        </div>
      ))}
    </div>
  );
}
