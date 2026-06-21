"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import type { Auction, AuctionStatus, Category } from "@/types/database";

const STANDARD_LANGUAGES = ["English", "Chinese", "Japanese"];

const REGION_OPTIONS = [
  { value: "-", label: "- (No Region)" },
  { value: "R1", label: "R1" },
  { value: "R2", label: "R2" },
  { value: "R3", label: "R3" },
  { value: "R4", label: "R4" },
  { value: "All", label: "All" },
];

const CONDITION_OPTIONS = [
  { value: "Brand New & Sealed", label: "Brand New & Sealed" },
  { value: "Used Like New", label: "Used Like New" },
  { value: "Used", label: "Used" },
  { value: "Used No Box", label: "Used No Box" },
  { value: "Others", label: "Others" },
];

interface AuctionFormProps {
  auction?: Auction;
  userId: string;
  mode?: "create" | "edit" | "clone";
}

function initShippingOptions(auction?: Auction): string[] {
  if (!auction?.shipping_type) return ["shipping"];
  if (auction.shipping_type === "both") return ["shipping", "collection"];
  return [auction.shipping_type];
}

function initLanguagesSelected(auction?: Auction): string[] {
  const langs = auction?.languages ?? [];
  const standard = langs.filter((l) => STANDARD_LANGUAGES.includes(l));
  const hasOthers = langs.some((l) => !STANDARD_LANGUAGES.includes(l));
  return [...standard, ...(hasOthers ? ["Others"] : [])];
}

function initLanguagesOther(auction?: Auction): string {
  return (auction?.languages ?? [])
    .filter((l) => !STANDARD_LANGUAGES.includes(l))
    .join(", ");
}

function initCondition(auction?: Auction): string {
  const c = auction?.condition ?? "Brand New & Sealed";
  return CONDITION_OPTIONS.some((o) => o.value === c) ? c : "Others";
}

function initConditionOther(auction?: Auction): string {
  const c = auction?.condition ?? "";
  return CONDITION_OPTIONS.some((o) => o.value === c) ? "" : c;
}

export function AuctionForm({ auction, userId, mode = "create" }: AuctionFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    supabase
      .from("categories")
      .select("id, name, display_order, is_active, created_at")
      .eq("is_active", true)
      .order("display_order", { ascending: true, nullsFirst: false })
      .then(({ data }) => { if (data) setCategories(data); });
  }, [supabase]);

  const [form, setForm] = useState({
    title: mode === "clone" && auction ? `${auction.title} (Copy)` : auction?.title ?? "",
    short_description: auction?.short_description ?? "",
    category_id: auction?.category_id?.toString() ?? "",
    quantity: auction?.quantity?.toString() ?? "1",
    condition: initCondition(auction),
    condition_other: initConditionOther(auction),
    region: auction?.region ?? "-",
    languages_selected: initLanguagesSelected(auction),
    languages_other: initLanguagesOther(auction),
    starting_price: auction?.starting_price?.toString() ?? "0",
    minimum_increment: auction?.minimum_increment?.toString() ?? "5",
    shipping_options: initShippingOptions(auction),
    shipping_fee_west: auction?.shipping_fee_west?.toString() ?? "0",
    shipping_fee_east: auction?.shipping_fee_east?.toString() ?? "0",
    cover_photo_url: auction?.cover_photo_url ?? "",
    start_at: auction?.start_at?.slice(0, 16) ?? "",
    end_at: auction?.end_at?.slice(0, 16) ?? "",
    anti_snipe_enabled: auction?.anti_snipe_enabled ?? true,
    anti_snipe_trigger_minutes: auction?.anti_snipe_trigger_minutes?.toString() ?? "5",
    anti_snipe_extend_minutes: auction?.anti_snipe_extend_minutes?.toString() ?? "5",
    status: (auction?.status ?? "draft") as AuctionStatus,
  });

  function toggleShippingOption(option: string) {
    setForm((prev) => ({
      ...prev,
      shipping_options: prev.shipping_options.includes(option)
        ? prev.shipping_options.filter((o) => o !== option)
        : [...prev.shipping_options, option],
    }));
  }

  function toggleLanguage(lang: string) {
    setForm((prev) => ({
      ...prev,
      languages_selected: prev.languages_selected.includes(lang)
        ? prev.languages_selected.filter((l) => l !== lang)
        : [...prev.languages_selected, lang],
    }));
  }

  async function save(status: AuctionStatus) {
    setError("");
    setLoading(true);

    const shippingType =
      form.shipping_options.includes("shipping") && form.shipping_options.includes("collection")
        ? "both"
        : form.shipping_options[0] ?? "shipping";

    const languages = [
      ...form.languages_selected.filter((l) => l !== "Others"),
      ...(form.languages_selected.includes("Others") && form.languages_other.trim()
        ? form.languages_other.split(",").map((l) => l.trim()).filter(Boolean)
        : []),
    ];

    const condition =
      form.condition === "Others"
        ? form.condition_other.trim() || "Others"
        : form.condition;

    const payload = {
      title: form.title,
      short_description: form.short_description || null,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      quantity: parseInt(form.quantity),
      condition,
      region: form.region,
      languages,
      starting_price: parseFloat(form.starting_price),
      minimum_increment: parseFloat(form.minimum_increment),
      shipping_fee_west: form.shipping_options.includes("shipping")
        ? parseFloat(form.shipping_fee_west)
        : 0,
      shipping_fee_east: form.shipping_options.includes("shipping")
        ? parseFloat(form.shipping_fee_east)
        : 0,
      shipping_type: shippingType,
      cover_photo_url: form.cover_photo_url || null,
      start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      anti_snipe_enabled: form.anti_snipe_enabled,
      anti_snipe_trigger_minutes: parseInt(form.anti_snipe_trigger_minutes),
      anti_snipe_extend_minutes: parseInt(form.anti_snipe_extend_minutes),
      status,
      current_bid: parseFloat(form.starting_price),
      created_by: userId,
    };

    if (mode === "edit" && auction) {
      const { error: updateError } = await supabase
        .from("auctions")
        .update(payload)
        .eq("id", auction.id);
      if (updateError) { setError(updateError.message); setLoading(false); return; }
      router.push("/admin/auctions");
    } else {
      const { error: insertError } = await supabase.from("auctions").insert(payload);
      if (insertError) { setError(insertError.message); setLoading(false); return; }
      router.push("/admin/auctions");
    }
    setLoading(false);
  }

  const shippingChecked = form.shipping_options.includes("shipping");
  const collectionChecked = form.shipping_options.includes("collection");

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
          onChange={(e) => setForm({ ...form, short_description: e.target.value })}
          rows={4}
          className="sm:col-span-2"
        />
        <Select
          label="Category"
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          options={[
            { value: "", label: "Select category..." },
            ...categories.map((c) => ({ value: c.id.toString(), label: c.name })),
          ]}
        />

        {/* Condition */}
        <div className="space-y-3">
          <Select
            label="Condition"
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value, condition_other: "" })}
            options={CONDITION_OPTIONS}
          />
          {form.condition === "Others" && (
            <Input
              label="Specify Condition"
              value={form.condition_other}
              onChange={(e) => setForm({ ...form, condition_other: e.target.value })}
              placeholder="Describe the condition"
            />
          )}
        </div>

        {/* Region */}
        <Select
          label="Region"
          value={form.region}
          onChange={(e) => setForm({ ...form, region: e.target.value })}
          options={REGION_OPTIONS}
        />

        {/* Languages */}
        <div className="space-y-2 sm:col-span-2">
          <p className="text-sm font-medium text-gray-700">Languages</p>
          <div className="flex flex-wrap gap-6">
            {[...STANDARD_LANGUAGES, "Others"].map((lang) => (
              <label key={lang} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.languages_selected.includes(lang)}
                  onChange={() => toggleLanguage(lang)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                {lang}
              </label>
            ))}
          </div>
          {form.languages_selected.includes("Others") && (
            <Input
              label="Specify other language(s)"
              value={form.languages_other}
              onChange={(e) => setForm({ ...form, languages_other: e.target.value })}
              placeholder="e.g. Korean, German (comma separated)"
            />
          )}
        </div>

        {/* Pricing */}
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

        {/* Fulfillment */}
        <div className="space-y-3 sm:col-span-2">
          <p className="text-sm font-medium text-gray-700">Fulfillment Options</p>
          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shippingChecked}
                onChange={() => toggleShippingOption("shipping")}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Shipping
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={collectionChecked}
                onChange={() => toggleShippingOption("collection")}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Self Collection
            </label>
          </div>

          {shippingChecked && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Shipping Fee — West Malaysia (RM)"
                type="number"
                step="1"
                value={form.shipping_fee_west}
                onChange={(e) => setForm({ ...form, shipping_fee_west: e.target.value })}
              />
              <Input
                label="Shipping Fee — East Malaysia (RM)"
                type="number"
                step="1"
                value={form.shipping_fee_east}
                onChange={(e) => setForm({ ...form, shipping_fee_east: e.target.value })}
              />
            </div>
          )}
        </div>

        <Input
          label="Cover Photo URL"
          value={form.cover_photo_url}
          onChange={(e) => setForm({ ...form, cover_photo_url: e.target.value })}
          className="sm:col-span-2"
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
