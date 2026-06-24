"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuctionCard } from "@/components/auctions/auction-card";
import type { Auction } from "@/types/database";

interface AuctionListClientProps {
  initialAuctions: Auction[];
}

export function AuctionListClient({ initialAuctions }: AuctionListClientProps) {
  const [auctions, setAuctions] = useState(initialAuctions);
  const supabase = createClient();

  useEffect(() => {
    setAuctions(initialAuctions);
  }, [initialAuctions]);

  useEffect(() => {
    const ids = initialAuctions.map((a) => a.id);
    if (ids.length === 0) return;

    supabase
      .from("auctions")
      .select("*")
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        setAuctions((prev) =>
          prev.map((auction) => data.find((fresh) => fresh.id === auction.id) ?? auction)
        );
      });
  }, [initialAuctions, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("auctions-list")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions" },
        (payload) => {
          const updated = payload.new as Auction;
          setAuctions((prev) =>
            prev.map((auction) => (auction.id === updated.id ? updated : auction))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  if (auctions.length === 0) {
    return (
      <div className="mt-12 text-center text-gray-500">
        <p className="text-lg">No auctions found</p>
        <p className="mt-1 text-sm">Check back soon for new listings</p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {auctions.map((auction) => (
        <AuctionCard key={auction.id} auction={auction} />
      ))}
    </div>
  );
}
