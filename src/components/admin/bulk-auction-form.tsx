"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

interface BulkAuctionFormProps {
  userId: string;
}

export function BulkAuctionForm({ userId }: BulkAuctionFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [csvData, setCsvData] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState<"draft" | "scheduled">("draft");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult("");
    setLoading(true);

    const lines = csvData.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      setError("Please enter at least one auction");
      setLoading(false);
      return;
    }

    const auctions = lines.map((line) => {
      const [title, description, startingPrice, bidIncrement, shippingFee, fulfillment] =
        line.split("|").map((s) => s.trim());
      return {
        title,
        description: description || null,
        starting_price: parseFloat(startingPrice) || 0,
        current_price: parseFloat(startingPrice) || 0,
        bid_increment: parseFloat(bidIncrement) || 1,
        shipping_fee: parseFloat(shippingFee) || 0,
        fulfillment_type: (fulfillment === "collection" ? "collection" : "shipping") as "shipping" | "collection",
        start_time: startTime ? new Date(startTime).toISOString() : null,
        end_time: endTime ? new Date(endTime).toISOString() : null,
        status,
        created_by: userId,
      };
    });

    const { error: insertError } = await supabase.from("auctions").insert(auctions);

    if (insertError) {
      setError(insertError.message);
    } else {
      setResult(`Successfully created ${auctions.length} auction(s)`);
      setTimeout(() => router.push("/admin/auctions"), 1500);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      {result && <Alert variant="success">{result}</Alert>}

      <Alert variant="info">
        Format: one auction per line, fields separated by | (pipe):
        <br />
        <code className="text-xs">Title | Description | Starting Price | Bid Increment | Shipping Fee | shipping/collection</code>
      </Alert>

      <Textarea
        label="Auction Data"
        value={csvData}
        onChange={(e) => setCsvData(e.target.value)}
        rows={10}
        placeholder="Rare Card #1 | Limited edition | 50 | 5 | 10 | shipping&#10;Rare Card #2 | Mint condition | 100 | 10 | 15 | collection"
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Shared Start Time (optional)"
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <Input
          label="Shared End Time (optional)"
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant={status === "draft" ? "primary" : "outline"}
          onClick={() => setStatus("draft")}
        >
          Save as Drafts
        </Button>
        <Button
          type="button"
          variant={status === "scheduled" ? "primary" : "outline"}
          onClick={() => setStatus("scheduled")}
        >
          Schedule All
        </Button>
      </div>

      <Button type="submit" loading={loading} className="w-full">
        Create {csvData.trim().split("\n").filter(Boolean).length || 0} Auction(s)
      </Button>
    </form>
  );
}
