"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Auction } from "@/types/database";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info" | "brand"> = {
  draft: "default",
  scheduled: "info",
  active: "success",
  ended: "danger",
  cancelled: "warning",
};

interface AdminAuctionListProps {
  initialAuctions: Auction[];
}

export function AdminAuctionList({ initialAuctions }: AdminAuctionListProps) {
  const [auctions, setAuctions] = useState(initialAuctions);
  const supabase = createClient();

  useEffect(() => {
    setAuctions(initialAuctions);
  }, [initialAuctions]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-auctions-list")
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

  return (
    <div className="mt-6 space-y-3">
      {auctions.map((auction) => (
        <Card key={auction.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-gray-900">{auction.title}</p>
                <Badge variant={statusVariant[auction.status]}>{auction.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {formatCurrency(auction.current_bid || auction.starting_price)}
                {auction.end_at && ` · Ends ${formatDate(auction.end_at)}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/auctions/${auction.id}/edit`}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
              <Link href={`/admin/auctions/${auction.id}/clone`}>
                <Button variant="ghost" size="sm">
                  <Copy className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/auctions/${auction.id}`}>
                <Button variant="ghost" size="sm">View</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
