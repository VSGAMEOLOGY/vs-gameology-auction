import Link from "next/link";
import Image from "next/image";
import { Clock, Truck, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, getTimeRemaining } from "@/lib/utils";
import type { Auction } from "@/types/database";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info" | "brand"> = {
  draft: "default",
  scheduled: "info",
  active: "success",
  ended: "danger",
  cancelled: "warning",
};

interface AuctionCardProps {
  auction: Auction;
}

export function AuctionCard({ auction }: AuctionCardProps) {
  return (
    <Link href={`/auctions/${auction.id}`}>
      <Card className="group overflow-hidden transition-shadow hover:shadow-md">
        <div className="relative aspect-[4/3] bg-gray-100">
          {auction.cover_photo_url ? (
            <Image
              src={auction.cover_photo_url}
              alt={auction.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">
              No Image
            </div>
          )}
          <div className="absolute left-3 top-3">
            <Badge variant={statusVariant[auction.status]}>
              {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
            </Badge>
          </div>
        </div>
        <CardContent className="space-y-2">
          <h3 className="line-clamp-2 font-semibold text-gray-900 group-hover:text-brand-600">
            {auction.title}
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Current Bid</p>
              <p className="text-lg font-bold text-brand-600">
                {formatCurrency(auction.current_bid || auction.starting_price)}
              </p>
            </div>
            {auction.status === "active" && auction.end_at && (
              <div className="text-right">
                <p className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {getTimeRemaining(auction.end_at)}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {auction.shipping_type === "shipping" ? (
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                Shipping {(auction.shipping_fee ?? 0) > 0 && `+${formatCurrency(auction.shipping_fee ?? 0)}`}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Collection
              </span>
            )}
            {auction.end_at && (
              <span>Ends {formatDate(auction.end_at)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
