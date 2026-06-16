"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Truck, MapPin, Package } from "lucide-react";
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
  categoryName?: string | null;
  userId?: string;
}

export function AuctionDetailClient({ initialAuction, categoryName, userId }: AuctionDetailClientProps) {
  const [auction, setAuction] = useState(initialAuction);
  const [bidRefreshKey, setBidRefreshKey] = useState(0);
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

    return () => { supabase.removeChannel(channel); };
  }, [auction.id, supabase]);

  const isActive = auction.status === "active";
  const shippingType = auction.shipping_type;
  const hasShipping = shippingType === "shipping" || shippingType === "both";
  const hasCollection = shippingType === "collection" || shippingType === "both";

  const detailFields: { label: string; value: string }[] = [];
  if (categoryName) detailFields.push({ label: "Category", value: categoryName });
  if (auction.item_type) detailFields.push({ label: "Item Type", value: auction.item_type });
  if (auction.condition) detailFields.push({ label: "Condition", value: auction.condition });
  if (auction.region && auction.region !== "-") detailFields.push({ label: "Region", value: auction.region });
  if (auction.quantity > 1) detailFields.push({ label: "Quantity", value: String(auction.quantity) });
  if (auction.languages && auction.languages.length > 0) {
    detailFields.push({ label: "Language(s)", value: auction.languages.join(", ") });
  }
  if (hasShipping && auction.courier_name) {
    detailFields.push({ label: "Courier", value: auction.courier_name });
  }
  if (auction.auction_number) {
    detailFields.push({ label: "Auction #", value: auction.auction_number });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
        {auction.cover_photo_url ? (
          <Image src={auction.cover_photo_url} alt={auction.title} fill className="object-cover" priority />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">No Image</div>
        )}
      </div>

      {/* Main info */}
      <div className="space-y-5">
        {/* Title + watchlist */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{auction.title}</h1>
            {userId && <WatchlistButton auctionId={auction.id} userId={userId} />}
          </div>

          {/* Status + fulfillment badges */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={isActive ? "success" : "default"}>
              {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
            </Badge>
            {hasShipping && (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Truck className="h-4 w-4" />
                Shipping{(auction.shipping_fee ?? 0) > 0 && ` (+${formatCurrency(auction.shipping_fee ?? 0)})`}
              </span>
            )}
            {hasCollection && (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                Self Collection
              </span>
            )}
          </div>
        </div>

        {/* Current bid */}
        <div className="rounded-xl bg-brand-50 p-6">
          <p className="text-sm text-brand-700">Current Bid</p>
          <p className="text-3xl font-bold text-brand-600">
            {formatCurrency(auction.current_bid || auction.starting_price)}
          </p>
          {auction.bid_count != null && auction.bid_count > 0 && (
            <p className="mt-1 text-xs text-brand-600">
              {auction.bid_count} bid{auction.bid_count !== 1 ? "s" : ""}
              {auction.unique_bidder_count != null && ` · ${auction.unique_bidder_count} bidder${auction.unique_bidder_count !== 1 ? "s" : ""}`}
            </p>
          )}
          {isActive && auction.end_at && (
            <p className="mt-2 text-sm text-brand-700">
              Ends in {getTimeRemaining(auction.end_at)} ({formatDate(auction.end_at)})
            </p>
          )}
        </div>

        {/* Short description */}
        {auction.short_description && (
          <div>
            <h2 className="font-semibold text-gray-900">Description</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{auction.short_description}</p>
          </div>
        )}

        {/* Item details grid */}
        {detailFields.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-900">Item Details</h2>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {detailFields.map(({ label, value }) => (
                <div key={label}>
                  <p className="text-gray-500">{label}</p>
                  <p className="font-medium text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Condition notes */}
        {auction.condition_notes && (
          <div>
            <h2 className="font-semibold text-gray-900">Condition Notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{auction.condition_notes}</p>
          </div>
        )}

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Starting Price</p>
            <p className="font-medium">{formatCurrency(auction.starting_price)}</p>
          </div>
          <div>
            <p className="text-gray-500">Bid Increment</p>
            <p className="font-medium">{formatCurrency(auction.minimum_increment)}</p>
          </div>
        </div>

        {/* Bid form */}
        {isActive && userId && (
          <Card>
            <CardHeader>
              <CardTitle>Place a Bid</CardTitle>
            </CardHeader>
            <CardContent>
              <BidForm auction={auction} userId={userId} onBidPlaced={() => setBidRefreshKey((k) => k + 1)} />
            </CardContent>
          </Card>
        )}

        {!userId && isActive && (
          <p className="text-center text-sm text-gray-600">
            <a href="/login" className="font-medium text-brand-600 hover:text-brand-700">Sign in</a>{" "}
            to place a bid
          </p>
        )}
      </div>

      {/* Bid history — full width */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Bid History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BidHistory auctionId={auction.id} refreshKey={bidRefreshKey} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
