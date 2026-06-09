"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import type { Auction, AuctionStatus, FulfillmentType } from "@/types/database";

interface AuctionFormProps {
  auction?: Auction;
  userId: string;
  mode?: "create" | "edit" | "clone";
}

export function AuctionForm({ auction, userId, mode = "create" }: AuctionFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: mode === "clone" && auction ? `${auction.title} (Copy)` : auction?.title ?? "",
    description: auction?.description ?? "",
    image_url: auction?.image_url ?? "",
    starting_price: auction?.starting_price?.toString() ?? "0",
    reserve_price: auction?.reserve_price?.toString() ?? "",
    bid_increment: auction?.bid_increment?.toString() ?? "1",
    shipping_fee: auction?.shipping_fee?.toString() ?? "0",
    fulfillment_type: (auction?.fulfillment_type ?? "shipping") as FulfillmentType,
    start_time: auction?.start_time?.slice(0, 16) ?? "",
    end_time: auction?.end_time?.slice(0, 16) ?? "",
    status: (auction?.status ?? "draft") as AuctionStatus,
  });

  async function save(status: AuctionStatus) {
    setError("");
    setLoading(true);

    const payload = {
      title: form.title,
      description: form.description || null,
      image_url: form.image_url || null,
      starting_price: parseFloat(form.starting_price),
      reserve_price: form.reserve_price ? parseFloat(form.reserve_price) : null,
      bid_increment: parseFloat(form.bid_increment),
      shipping_fee: parseFloat(form.shipping_fee),
      fulfillment_type: form.fulfillment_type,
      start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      status,
      current_price: parseFloat(form.starting_price),
      created_by: userId,
    };

    if (mode === "edit" && auction) {
      const { error: updateError } = await supabase
        .from("auctions")
        .update(payload)
        .eq("id", auction.id);
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      router.push("/admin/auctions");
    } else {
      const { error: insertError } = await supabase.from("auctions").insert(payload);
      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }
      router.push("/admin/auctions");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="sm:col-span-2"
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
          className="sm:col-span-2"
        />
        <Input
          label="Image URL"
          value={form.image_url}
          onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          className="sm:col-span-2"
        />
        <Input
          label="Starting Price"
          type="number"
          step="0.01"
          value={form.starting_price}
          onChange={(e) => setForm({ ...form, starting_price: e.target.value })}
          required
        />
        <Input
          label="Reserve Price (optional)"
          type="number"
          step="0.01"
          value={form.reserve_price}
          onChange={(e) => setForm({ ...form, reserve_price: e.target.value })}
        />
        <Input
          label="Bid Increment"
          type="number"
          step="0.01"
          value={form.bid_increment}
          onChange={(e) => setForm({ ...form, bid_increment: e.target.value })}
          required
        />
        <Input
          label="Shipping Fee"
          type="number"
          step="0.01"
          value={form.shipping_fee}
          onChange={(e) => setForm({ ...form, shipping_fee: e.target.value })}
        />
        <Select
          label="Fulfillment"
          value={form.fulfillment_type}
          onChange={(e) => setForm({ ...form, fulfillment_type: e.target.value as FulfillmentType })}
          options={[
            { value: "shipping", label: "Shipping" },
            { value: "collection", label: "Collection" },
          ]}
        />
        <Input
          label="Start Time"
          type="datetime-local"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
        />
        <Input
          label="End Time"
          type="datetime-local"
          value={form.end_time}
          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
        />
      </div>

      {(form.start_time || form.end_time) && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-medium text-brand-800">Schedule Preview</p>
          <div className="mt-2 grid gap-2 text-sm text-brand-700 sm:grid-cols-2">
            {form.start_time && (
              <p>Starts: {new Date(form.start_time).toLocaleString("en-AU")}</p>
            )}
            {form.end_time && (
              <p>Ends: {new Date(form.end_time).toLocaleString("en-AU")}</p>
            )}
            {form.start_time && form.end_time && (
              <p className="sm:col-span-2">
                Duration:{" "}
                {Math.round(
                  (new Date(form.end_time).getTime() - new Date(form.start_time).getTime()) /
                    (1000 * 60 * 60)
                )}{" "}
                hours
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => save("draft")} loading={loading}>
          Save Draft
        </Button>
        <Button onClick={() => save("scheduled")} loading={loading}>
          Schedule Auction
        </Button>
        <Button variant="secondary" onClick={() => save("active")} loading={loading}>
          Publish Now
        </Button>
      </div>
    </div>
  );
}
