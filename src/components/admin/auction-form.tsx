"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import type { Auction, AuctionStatus } from "@/types/database";

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
    title: mode === "clone" && auction
      ? `${auction.title} (Copy)`
      : auction?.title ?? "",
  
    short_description: auction?.short_description ?? "",
    condition_notes: auction?.condition_notes ?? "",
  
    category_id: auction?.category_id?.toString() ?? "",
    item_type: auction?.item_type ?? "",
  
    quantity: auction?.quantity?.toString() ?? "1",
  
    condition: auction?.condition ?? "Used Complete Set",
  
    region: auction?.region ?? "-",
  
    languages: auction?.languages?.join(", ") ?? "",
  
    starting_price: auction?.starting_price?.toString() ?? "0",
  
    minimum_increment:
      auction?.minimum_increment?.toString() ?? "5",
  
    shipping_fee:
      auction?.shipping_fee?.toString() ?? "0",
  
    shipping_type:
      auction?.shipping_type ?? "shipping",
  
    courier_name:
      auction?.courier_name ?? "",
  
    cover_photo_url:
      auction?.cover_photo_url ?? "",
  
    start_at:
      auction?.start_at?.slice(0,16) ?? "",
  
    end_at:
      auction?.end_at?.slice(0,16) ?? "",
  
    anti_snipe_enabled:
      auction?.anti_snipe_enabled ?? true,
  
    anti_snipe_trigger_minutes:
      auction?.anti_snipe_trigger_minutes?.toString() ?? "5",
  
    anti_snipe_extend_minutes:
      auction?.anti_snipe_extend_minutes?.toString() ?? "5",
  
    status:
      (auction?.status ?? "draft") as AuctionStatus,
  });

  async function save(status: AuctionStatus) {

  
    setError("");
    setLoading(true);

    const payload = {
      title: form.title,

      short_description: form.short_description || null,
      
      condition_notes: form.condition_notes || null,
      
      category_id: form.category_id
        ? parseInt(form.category_id)
        : null,
      
      item_type: form.item_type,
      
      quantity: parseInt(form.quantity),
      
      condition: form.condition,
      
      region: form.region,
      
      languages: form.languages
        ? form.languages
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : [],
      
      starting_price: parseFloat(form.starting_price),
      
      minimum_increment: parseFloat(form.minimum_increment),
      
      shipping_fee: parseFloat(form.shipping_fee),
      
      shipping_type: form.shipping_type,
      
      courier_name: form.courier_name || null,
      
      cover_photo_url: form.cover_photo_url || null,
      
      start_at: form.start_at
        ? new Date(form.start_at).toISOString()
        : null,
      
      end_at: form.end_at
        ? new Date(form.end_at).toISOString()
        : null,
      
      anti_snipe_enabled: form.anti_snipe_enabled,
      
      anti_snipe_trigger_minutes:
        parseInt(form.anti_snipe_trigger_minutes),
      
      anti_snipe_extend_minutes:
        parseInt(form.anti_snipe_extend_minutes),
      status,
      current_bid: parseFloat(form.starting_price),
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

    
      const { error: insertError } = await supabase
        .from("auctions")
        .insert(payload);
    

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
  label="Short Description"
  value={form.short_description}
  onChange={(e) =>
    setForm({
      ...form,
      short_description: e.target.value,
    })
  }
  rows={4}
  className="sm:col-span-2"
/>
<Textarea
  label="Condition Notes"
  value={form.condition_notes}
  onChange={(e) =>
    setForm({
      ...form,
      condition_notes: e.target.value,
    })
  }
  rows={3}
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
          label="Bid Increment"
          type="number"
          step="0.01"
          value={form.minimum_increment}
          onChange={(e) => setForm({ ...form, minimum_increment: e.target.value })}
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
          value={form.shipping_type}
          onChange={(e) => setForm({ ...form, shipping_type: e.target.value, })}
          options={[
            { value: "shipping", label: "Shipping" },
            { value: "collection", label: "Collection" },
          ]}
        />
        <Input
          label="Start Time"
          type="datetime-local"
          value={form.start_at}
          onChange={(e) => setForm({ ...form, start_at: e.target.value })}
        />
        <Input
          label="End Time"
          type="datetime-local"
          value={form.end_at}
          onChange={(e) => setForm({ ...form, end_at: e.target.value })}
        />
      </div>

      {(form.start_at || form.end_at) && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-medium text-brand-800">Schedule Preview</p>
          <div className="mt-2 grid gap-2 text-sm text-brand-700 sm:grid-cols-2">
            {form.start_at && (
              <p>Starts: {new Date(form.start_at).toLocaleString("en-AU")}</p>
            )}
            {form.end_at && (
              <p>Ends: {new Date(form.end_at).toLocaleString("en-AU")}</p>
            )}
            {form.start_at && form.end_at && (
              <p className="sm:col-span-2">
                Duration:{" "}
                {Math.round(
                  (new Date(form.end_at).getTime() - new Date(form.start_at).getTime()) /
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
