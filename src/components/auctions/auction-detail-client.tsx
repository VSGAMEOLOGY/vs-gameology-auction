"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Truck, MapPin, Package, X, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BidForm } from "@/components/auctions/bid-form";
import { BidHistory } from "@/components/auctions/bid-history";
import { WatchlistButton } from "@/components/auctions/watchlist-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, getTimeRemaining } from "@/lib/utils";
import type { Auction } from "@/types/database";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info" | "brand"> = {
  draft: "default",
  scheduled: "info",
  active: "success",
  ended: "danger",
  cancelled: "warning",
};

interface AuctionDetailClientProps {
  initialAuction: Auction;
  categoryName?: string | null;
  userId?: string;
}

export function AuctionDetailClient({ initialAuction, categoryName, userId }: AuctionDetailClientProps) {
  const [auction, setAuction] = useState(initialAuction);
  const [bidRefreshKey, setBidRefreshKey] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [, setNow] = useState(() => Date.now());
  const supabase = createClient();

  const photos = [auction.cover_photo_url, ...(auction.gallery_photos ?? [])].filter(
    (url): url is string => Boolean(url)
  );

  function showPrev() {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }

  function showNext() {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }

  useEffect(() => {
    if (lightboxIndex === null) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, photos.length]);

  useEffect(() => {
    if (auction.status !== "active" || !auction.end_at) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [auction.status, auction.end_at]);

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
  if (auction.condition) detailFields.push({ label: "Condition", value: auction.condition });
  if (auction.region && auction.region !== "-") detailFields.push({ label: "Region", value: auction.region });
  if (auction.quantity > 1) detailFields.push({ label: "Quantity", value: String(auction.quantity) });
  if (auction.languages && auction.languages.length > 0) {
    detailFields.push({ label: "Language(s)", value: auction.languages.join(", ") });
  }
  if (auction.auction_number) {
    detailFields.push({ label: "Auction #", value: auction.auction_number });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Image */}
      <div>
        {auction.cover_photo_url ? (
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl bg-gray-100"
          >
            <Image src={auction.cover_photo_url} alt={auction.title} fill className="object-cover" priority />
          </button>
        ) : (
          <div className="relative flex aspect-square items-center justify-center rounded-xl bg-gray-100 text-gray-400">
            No Image
          </div>
        )}

        {auction.gallery_photos && auction.gallery_photos.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {auction.gallery_photos.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setLightboxIndex(i + 1)}
                className="relative block aspect-square cursor-zoom-in overflow-hidden rounded-lg bg-gray-100"
              >
                <Image
                  src={url}
                  alt={`${auction.title} photo ${i + 2}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 25vw, 12vw"
                />
              </button>
            ))}
          </div>
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

          {/* Status badge */}
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={statusVariant[auction.status]}>
              {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
            </Badge>
            {auction.status === "scheduled" && auction.start_at && (
              <span className="text-sm text-gray-600">
                Starts at {formatDate(auction.start_at)}
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

        {/* Fulfillment options */}
        {(hasShipping || hasCollection) && (
          <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-700">Delivery Options</p>
            {hasShipping && (
              <div className="flex items-start gap-3 text-sm">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-800">Shipping Fee</p>
                  <p className="text-gray-600">
                    RM {(auction.shipping_fee_west ?? 0).toFixed(0)} (West Malaysia)
                    {" / "}
                    RM {(auction.shipping_fee_east ?? 0).toFixed(0)} (East Malaysia)
                  </p>
                </div>
              </div>
            )}
            {hasCollection && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-800">Self Collection</p>
                  <p className="text-gray-600">Free</p>
                </div>
              </div>
            )}
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

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 text-white/80 hover:text-white"
            aria-label="Close"
          >
            <X className="h-8 w-8" />
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); showPrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-10 w-10" />
            </button>
          )}

          <div
            className="relative h-full max-h-[85vh] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photos[lightboxIndex]}
              alt={`${auction.title} full view`}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); showNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
              aria-label="Next photo"
            >
              <ChevronRight className="h-10 w-10" />
            </button>
          )}

          {photos.length > 1 && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
              {lightboxIndex + 1} / {photos.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
