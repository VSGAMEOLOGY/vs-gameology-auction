"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Truck, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BidForm } from "@/components/auctions/bid-form";
import { BidHistory } from "@/components/auctions/bid-history";
import { WatchlistButton } from "@/components/auctions/watchlist-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, getTimeRemaining } from "@/lib/utils";
import type { Auction } from "@/types/database";

interface AuctionDetailClientProps {
  initialAuction: Auction;
  userId?: string;
}

export function AuctionDetailClient({ initialAuction, userId }: AuctionDetailClientProps) {
  const [auction, setAuction] = useState(initialAuction);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`auction-${auction.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auction.id}` },
        (payload) => setAuction(payload.new as Auction)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auction.id, supabase]);

  const isActive = auction.status === "active";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
        {auction.image_url ? (
          <Image src={auction.image_url} alt={auction.title} fill className="object-cover" priority />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">No Image</div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{auction.title}</h1>
            {userId && <WatchlistButton auctionId={auction.id} userId={userId} />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={isActive ? "success" : "default"}>
              {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
            </Badge>
            {auction.fulfillment_type === "shipping" ? (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Truck className="h-4 w-4" />
                Shipping {auction.shipping_fee > 0 && `(+${formatCurrency(auction.shipping_fee)})`}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                Collection Only
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-brand-50 p-6">
          <p className="text-sm text-brand-700">Current Price</p>
          <p className="text-3xl font-bold text-brand-600">
            {formatCurrency(auction.current_price || auction.starting_price)}
          </p>
          {isActive && auction.end_time && (
            <p className="mt-2 text-sm text-brand-700">
              Ends in {getTimeRemaining(auction.end_time)} ({formatDate(auction.end_time)})
            </p>
          )}
        </div>

        {auction.description && (
          <div>
            <h2 className="font-semibold text-gray-900">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-gray-600">{auction.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Starting Price</p>
            <p className="font-medium">{formatCurrency(auction.starting_price)}</p>
          </div>
          <div>
            <p className="text-gray-500">Bid Increment</p>
            <p className="font-medium">{formatCurrency(auction.bid_increment)}</p>
          </div>
          {auction.reserve_price && (
            <div>
              <p className="text-gray-500">Reserve Price</p>
              <p className="font-medium">{formatCurrency(auction.reserve_price)}</p>
            </div>
          )}
        </div>

        {isActive && userId && (
          <Card>
            <CardHeader>
              <CardTitle>Place a Bid</CardTitle>
            </CardHeader>
            <CardContent>
              <BidForm auction={auction} userId={userId} />
            </CardContent>
          </Card>
        )}

        {!userId && isActive && (
          <p className="text-center text-sm text-gray-600">
            <a href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </a>{" "}
            to place a bid
          </p>
        )}
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Bid History</CardTitle>
          </CardHeader>
          <CardContent>
            <BidHistory auctionId={auction.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
