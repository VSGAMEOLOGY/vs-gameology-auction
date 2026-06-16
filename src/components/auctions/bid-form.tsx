"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/utils";
import type { Auction } from "@/types/database";

interface BidFormProps {
  auction: Auction;
  userId: string;
  onBidPlaced?: () => void;
}

export function BidForm({ auction, userId, onBidPlaced }: BidFormProps) {
  const minBid =
  (auction.current_bid ?? auction.starting_price) +
  auction.minimum_increment;
  const [amount, setAmount] = useState(minBid.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const bidAmount = parseFloat(amount);
    if (isNaN(bidAmount) || bidAmount < minBid) {
      setError(`Minimum bid is ${formatCurrency(minBid)}`);
      setLoading(false);
      return;
    }

    const { error: bidError } = await supabase.from("bids").insert({
      auction_id: auction.id,
      bidder_id: userId,
      bid_amount: bidAmount,
    });
    
    if (bidError) {
      setError(bidError.message);
    } else {

    
      setSuccess("Bid placed successfully!");
      setAmount((bidAmount + auction.minimum_increment).toString());
      onBidPlaced?.();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div className="rounded-lg bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Minimum bid</p>
        <p className="text-2xl font-bold text-brand-600">{formatCurrency(minBid)}</p>
      </div>

      <Input
        label="Your Bid (RM)"
        type="number"
        step="0.01"
        min={minBid}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />


      <Button type="submit" className="w-full" size="lg" loading={loading}>
        Place Bid
      </Button>
    </form>
  );
}
