"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateOnly, cn } from "@/lib/utils";
import { getCourierTrackingUrl } from "@/lib/couriers";
import { resolveShippingZone as resolveZone, resolveReceiverInfo } from "@/lib/shipping";
import { ChevronDown, UploadCloud, CheckCircle, XCircle, Truck } from "lucide-react";
import type { Payment, Profile, ShippingAddress } from "@/types/database";

const WHATSAPP_NUMBER = "60139681228";
const EAST_UNAVAILABLE_NOTICE =
  "This item does not ship to East Malaysia. Please choose Self Collection or contact us on WhatsApp to arrange.";

const MALAYSIA_STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis",
  "Penang", "Sabah", "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Putrajaya", "Labuan",
];

const TIME_SLOTS = [
  "10am - 12pm", "12pm - 2pm", "2pm - 4pm", "4pm - 6pm", "6pm - 8pm", "8pm - 10pm",
];

const PICKUP_ADDRESS =
  "NO 92-A (TINGKAT 1), JALAN BPU 1, BANDAR PUCHONG UTAMA, 47100 PUCHONG, SELANGOR";

const ADDRESS_LABELS = ["Home", "Office"];

const emptyAddress = {
  label: "",
  recipient_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "Malaysia",
  is_default: false,
};

export default function PaymentDetailPage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  // "" = nothing selected yet (placeholder), "new" = add-new-address form, else a saved address id
  const [addressSelection, setAddressSelection] = useState("");
  const [newAddress, setNewAddress] = useState(emptyAddress);
  const [proofUrl, setProofUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [fulfillmentChoice, setFulfillmentChoice] = useState<"shipping" | "collection">("shipping");
  const [collectionDate, setCollectionDate] = useState("");
  const [collectionTimeSlot, setCollectionTimeSlot] = useState("");
  const [collectionRemarks, setCollectionRemarks] = useState("");
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [confirmedAddress, setConfirmedAddress] = useState<ShippingAddress | null>(null);
  const [addressSaving, setAddressSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const name = file?.name ?? "";
    e.target.value = "";
    if (!file) return;
    setError("");
    setSelectedFileName(name);
    setReceiptUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("payment-receipts").getPublicUrl(path);
      setProofUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload payment screenshot");
    } finally {
      setReceiptUploading(false);
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setUserEmail(user.email ?? "");

      const [{ data: pay }, { data: prof }, { data: addrs }] = await Promise.all([
        supabase
          .from("payments")
          .select("*, auction:auctions(*), shipping_address:shipping_addresses(*)")
          .eq("auction_id", auctionId)
          .eq("winner_user_id", user.id)
          .single(),
        supabase
          .from("profiles")
          .select("username, real_name, whatsapp")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("shipping_addresses")
          .select("*")
          .eq("user_id", user.id),
      ]);

      if (pay) {
        setPayment(pay);
        if (pay.fulfillment_type === "collection" || pay.auction?.shipping_type === "collection") {
          setFulfillmentChoice("collection");
        }
        if (pay.payment_status === "pending" && !pay.win_email_sent) {
          fetch("/api/payments/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId: pay.id, event: "won" }),
          }).catch((err) => console.error("Failed to trigger win email:", err));
        }
      }
      if (prof) setProfile(prof);
      if (addrs) setAddresses(addrs);
    }
    load();
  }, [auctionId, supabase]);

  const auction = payment?.auction;
  const canChooseFulfillment = auction?.shipping_type === "both";
  const isCollection = fulfillmentChoice === "collection";

  const isAddingNewAddress = addressSelection === "new";
  const selectedSavedAddress = addresses.find((a) => a.id.toString() === addressSelection);
  const selectedState = isAddingNewAddress ? newAddress.state : selectedSavedAddress?.state;
  const zone = selectedState ? resolveZone(selectedState) : null;
  const eastUnavailable = zone === "east" && auction?.ships_to_east === false;

  // Shipping fee is unknown until the user has confirmed a delivery address.
  const shippingFeeKnown = isCollection || addressConfirmed;
  const resolvedShippingFee = isCollection ? 0 : zone === "east" ? auction?.shipping_fee_east ?? 0 : zone === "west" ? auction?.shipping_fee_west ?? 0 : null;

  async function confirmAddress() {
    setError("");
    if (addressSelection === "") {
      setError("Please select a delivery address");
      return;
    }

    let finalState: string | undefined;
    if (isAddingNewAddress) {
      if (
        !newAddress.label ||
        !newAddress.recipient_name ||
        !newAddress.phone ||
        !newAddress.address_line1 ||
        !newAddress.city ||
        !newAddress.state ||
        !newAddress.postal_code
      ) {
        setError("Please fill in all required address fields");
        return;
      }
      finalState = newAddress.state;
    } else {
      finalState = selectedSavedAddress?.state;
    }

    if (finalState && resolveZone(finalState) === "east" && auction?.ships_to_east === false) {
      setError(EAST_UNAVAILABLE_NOTICE);
      return;
    }

    if (isAddingNewAddress) {
      setAddressSaving(true);
      const { data: savedAddress, error: addressError } = await supabase
        .from("shipping_addresses")
        .insert({ ...newAddress, user_id: userId })
        .select()
        .single();
      setAddressSaving(false);
      if (addressError) {
        setError(addressError.message);
        return;
      }
      setAddresses((prev) => [...prev, savedAddress]);
      setAddressSelection(savedAddress.id.toString());
      setConfirmedAddress(savedAddress);
    } else if (selectedSavedAddress) {
      setConfirmedAddress(selectedSavedAddress);
    }

    setAddressConfirmed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payment) return;
    setError("");

    if (!proofUrl) {
      setError("Please upload your payment screenshot");
      return;
    }

    if (isCollection) {
      if (!collectionDate || !collectionTimeSlot) {
        setError("Please select a collection date and time slot");
        return;
      }
    } else {
      if (!addressConfirmed) {
        setError("Please confirm your delivery address");
        return;
      }
      if (eastUnavailable) {
        setError(EAST_UNAVAILABLE_NOTICE);
        return;
      }
    }

    setLoading(true);

    const shippingAddressId = isCollection ? null : Number(addressSelection);
    const shippingFee = isCollection ? 0 : resolvedShippingFee ?? 0;

    const updates: Partial<Payment> = {
      receipt_url: proofUrl,
      payment_status: "submitted",
      fulfillment_type: fulfillmentChoice,
      shipping_fee: shippingFee,
      total_amount: payment.winning_bid + shippingFee,
      ...(shippingAddressId ? { shipping_address_id: shippingAddressId } : {}),
      ...(isCollection
        ? {
            collection_date: collectionDate,
            collection_time_slot: collectionTimeSlot,
            collection_remarks: collectionRemarks || null,
          }
        : {}),
    };

    const { error: updateError } = await supabase
      .from("payments")
      .update(updates)
      .eq("id", payment.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const { data: refreshed } = await supabase
      .from("payments")
      .select("*, auction:auctions(*), shipping_address:shipping_addresses(*)")
      .eq("id", payment.id)
      .single();
    setPayment(refreshed ?? { ...payment, ...updates });

    fetch("/api/payments/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: payment.id, event: "submitted" }),
    })
      .then(async (res) => {
        if (!res.ok) {
          console.error("Failed to notify admin:", res.status, await res.text());
        }
      })
      .catch((err) => console.error("Failed to notify admin:", err));

    setLoading(false);
  }

  if (!payment) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-center text-gray-500">Loading...</div>;
  }

  const isPending = payment.payment_status === "pending";
  const isRejected = payment.payment_status === "rejected";
  const displayedShippingFee = isPending
    ? shippingFeeKnown
      ? resolvedShippingFee ?? 0
      : null
    : payment.shipping_fee;
  const displayedTotal = isPending
    ? shippingFeeKnown
      ? payment.winning_bid + (resolvedShippingFee ?? 0)
      : null
    : payment.total_amount;

  const readyForPayment = isPending && !eastUnavailable && shippingFeeKnown;
  const today = new Date().toISOString().slice(0, 10);

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const paymentPageUrl = `${appOrigin}/payments/${auctionId}`;

  const eastMalaysiaWhatsappMessage = [
    "Hi, I would like to arrange payment and delivery for my winning bid. Details below:",
    "",
    `Auction: ${auction?.title ?? ""}`,
    `Auction No: #${auction?.auction_number ?? ""}`,
    `Condition: ${auction?.condition ?? ""}`,
    `Winning Bid: RM${payment.winning_bid.toFixed(2)}`,
    `Winner: ${profile?.username ?? ""}`,
    `Email: ${userEmail}`,
    `Phone: ${profile?.whatsapp || "not provided"}`,
    "",
    "I am from East Malaysia. Kindly advise on self-collection or delivery arrangement.",
    "",
    `To upload your payment proof, please visit: ${paymentPageUrl}`,
    "",
    "Thank you!",
  ].join("\n");
  const eastMalaysiaWhatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(eastMalaysiaWhatsappMessage)}`;
  const trackingUrl = getCourierTrackingUrl(payment.courier, payment.tracking_number);
  const { name: receiverName, phone: receiverPhone } = resolveReceiverInfo({
    shippingAddress: payment.shipping_address,
    profileRealName: profile?.real_name,
    profileWhatsapp: profile?.whatsapp,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{payment.auction?.title}</CardTitle>
            <Badge
              variant={
                payment.payment_status === "verified" ||
                payment.payment_status === "collected" ||
                payment.payment_status === "delivered"
                  ? "success"
                  : payment.payment_status === "dispatched"
                    ? "info"
                    : "warning"
              }
            >
              {payment.payment_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canChooseFulfillment && isPending && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Fulfillment Method</p>
              <div className="flex gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="shipping"
                    checked={fulfillmentChoice === "shipping"}
                    onChange={() => setFulfillmentChoice("shipping")}
                    className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  Shipping
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="collection"
                    checked={fulfillmentChoice === "collection"}
                    onChange={() => setFulfillmentChoice("collection")}
                    className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  Self Collection
                </label>
              </div>
            </div>
          )}

          {isPending && (
            <div>
              <button
                type="button"
                onClick={() => setShowSummary((s) => !s)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700"
              >
                <span>Show order summary</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showSummary && "rotate-180")} />
              </button>
              {showSummary && (
                <div className="space-y-2 rounded-b-lg border border-t-0 border-gray-200 px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Item</span>
                    <span className="font-medium">{auction?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Auction Number</span>
                    <span className="font-medium">{auction?.auction_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping Fee</span>
                    <span>
                      {isCollection ? (
                        <span className="text-green-600">RM 0 (Self Collection)</span>
                      ) : !shippingFeeKnown ? (
                        <span className="text-gray-400">Select an address</span>
                      ) : (
                        formatCurrency(displayedShippingFee ?? 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                    <span>Total</span>
                    <span className={shippingFeeKnown ? "text-brand-600" : "text-gray-400"}>
                      {shippingFeeKnown ? formatCurrency(displayedTotal ?? 0) : "Select an address"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {isPending && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
              {error && <Alert variant="error">{error}</Alert>}

              {!isCollection && (
                <div className="space-y-3">
                  {addressConfirmed ? (
                    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-700">Delivery Address</p>
                        <button
                          type="button"
                          onClick={() => setAddressConfirmed(false)}
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          Change Address
                        </button>
                      </div>
                      <div className="space-y-1 text-gray-600">
                        <p>
                          {confirmedAddress?.label} — {confirmedAddress?.recipient_name}
                        </p>
                        <p>{confirmedAddress?.phone}</p>
                        <p>{confirmedAddress?.address_line1}</p>
                        {confirmedAddress?.address_line2 && <p>{confirmedAddress.address_line2}</p>}
                        <p>
                          {confirmedAddress?.city}, {confirmedAddress?.state}{" "}
                          {confirmedAddress?.postal_code}
                        </p>
                      </div>
                      {zone && (
                        <p className="text-xs text-gray-500">
                          Detected zone: {zone === "east" ? "East Malaysia" : "West Malaysia"}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <Select
                        label="Delivery Address"
                        value={addressSelection}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAddressSelection(value);
                          if (value === "new") setNewAddress(emptyAddress);
                        }}
                        options={[
                          { value: "", label: "Select a delivery address" },
                          ...addresses.map((a) => ({
                            value: a.id.toString(),
                            label: `${a.label} - ${a.address_line1}, ${a.city}, ${a.state}`,
                          })),
                          { value: "new", label: "+ Add a new address" },
                        ]}
                      />

                      {isAddingNewAddress && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Select
                            label="Label"
                            value={newAddress.label}
                            onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                            options={[
                              { value: "", label: "Select Label" },
                              ...ADDRESS_LABELS.map((l) => ({ value: l, label: l })),
                            ]}
                            required
                          />
                          <Input
                            label="Recipient Name"
                            value={newAddress.recipient_name}
                            onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })}
                            required
                          />
                          <Input
                            label="Phone"
                            value={newAddress.phone}
                            onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                            required
                          />
                          <Input
                            label="Address Line 1"
                            value={newAddress.address_line1}
                            onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                            required
                            className="sm:col-span-2"
                          />
                          <Input
                            label="Address Line 2"
                            value={newAddress.address_line2}
                            onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                            className="sm:col-span-2"
                          />
                          <Input
                            label="City"
                            value={newAddress.city}
                            onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                            required
                          />
                          <Select
                            label="State"
                            value={newAddress.state}
                            onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                            options={[
                              { value: "", label: "Select State" },
                              ...MALAYSIA_STATES.map((s) => ({ value: s, label: s })),
                            ]}
                            required
                          />
                          <Input
                            label="Postal Code"
                            value={newAddress.postal_code}
                            onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                            required
                          />
                        </div>
                      )}

                      {eastUnavailable && (
                        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                          <p className="text-sm text-red-700">{EAST_UNAVAILABLE_NOTICE}</p>
                          <a
                            href={eastMalaysiaWhatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Contact Admin on WhatsApp
                          </a>
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        loading={addressSaving}
                        disabled={addressSelection === "" || eastUnavailable}
                        onClick={confirmAddress}
                        className="w-full"
                      >
                        {isAddingNewAddress ? "Save Address" : "Confirm Address"}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {isCollection && (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-700">Self Collection Details</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      type="date"
                      label="Collection Date"
                      min={today}
                      value={collectionDate}
                      onChange={(e) => setCollectionDate(e.target.value)}
                      required
                    />
                    <Select
                      label="Time Slot"
                      value={collectionTimeSlot}
                      onChange={(e) => setCollectionTimeSlot(e.target.value)}
                      options={[
                        { value: "", label: "Select Time Slot" },
                        ...TIME_SLOTS.map((s) => ({ value: s, label: s })),
                      ]}
                      required
                    />
                  </div>
                  <Textarea
                    label="Remarks (optional)"
                    value={collectionRemarks}
                    onChange={(e) => setCollectionRemarks(e.target.value)}
                    rows={2}
                  />
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600">
                    <p className="font-medium text-gray-700">Pickup Location</p>
                    <p>{PICKUP_ADDRESS}</p>
                  </div>
                </div>
              )}

              {readyForPayment && (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-700">Bank Transfer Details</p>
                  <div className="text-sm text-gray-600">
                    <p>Bank: Maybank</p>
                    <p>Account Name: VS GAMEOLOGY</p>
                    <p>Account No: 5123 4373 9288</p>
                  </div>
                  <p className="text-sm font-semibold text-brand-600">
                    Pending amount: {formatCurrency(displayedTotal ?? 0)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Please transfer the exact amount and upload your payment screenshot below.
                  </p>
                </div>
              )}

              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium text-gray-700">Upload Payment Screenshot</p>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptChange}
                    disabled={receiptUploading}
                    className="hidden"
                  />
                  {proofUrl ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
                      <Image src={proofUrl} alt="Payment screenshot preview" fill className="object-cover" />
                    </div>
                  ) : (
                    <UploadCloud className="h-8 w-8 text-gray-400" />
                  )}
                  <span className="text-sm text-gray-600">
                    {receiptUploading ? "Uploading…" : "Tap to upload"}
                  </span>
                </label>
                {!receiptUploading && proofUrl && selectedFileName && (
                  <p className="truncate text-sm text-green-600">✓ {selectedFileName}</p>
                )}

                <Button
                  type="submit"
                  loading={loading}
                  disabled={
                    eastUnavailable ||
                    receiptUploading ||
                    !proofUrl ||
                    (!isCollection && !addressConfirmed)
                  }
                  className="w-full"
                >
                  Submit Payment Proof
                </Button>
              </div>
            </form>
          )}

          {!isPending && (
            <div className="space-y-6 py-2 text-center">
              {isRejected ? (
                <XCircle className="mx-auto h-14 w-14 text-red-500" />
              ) : (
                <CheckCircle className="mx-auto h-14 w-14 text-green-500" />
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isRejected
                    ? "Payment Rejected"
                    : payment.payment_status === "delivered"
                      ? "Your Order Has Been Delivered - Thank you!"
                      : payment.payment_status === "dispatched"
                        ? "Your Order Has Been Dispatched"
                        : payment.payment_status === "collected"
                          ? `Thank You ${profile?.username ?? ""}!`
                          : payment.payment_status === "verified"
                            ? "Payment Verified - Preparing Your Item"
                            : `Thank You ${profile?.username ?? ""}!`}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {isRejected
                    ? "Your payment could not be verified."
                    : payment.payment_status === "collected"
                      ? "Your item has been collected. Thank you for shopping with VS GAMEOLOGY!"
                      : payment.payment_status === "delivered"
                        ? "Thank you for shopping with VS GAMEOLOGY!"
                        : payment.payment_status === "dispatched"
                          ? "Track your delivery using the details below."
                          : payment.payment_status === "verified"
                            ? "We're getting your item ready for delivery."
                            : "Your payment submission has been received."}
                </p>
              </div>

              {payment.admin_notes && (
                <Alert variant={isRejected ? "error" : "info"}>Admin note: {payment.admin_notes}</Alert>
              )}

              <div className="rounded-lg border border-gray-200 p-4 text-left text-sm">
                <p className="mb-2 font-semibold text-gray-700">Order Summary</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Item</span>
                    <span className="font-medium">{auction?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Auction Number</span>
                    <span className="font-medium">{auction?.auction_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Winning Bid</span>
                    <span>{formatCurrency(payment.winning_bid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping Fee</span>
                    <span>{formatCurrency(payment.shipping_fee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(payment.total_amount)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 text-left text-sm">
                <p className="mb-2 font-semibold text-gray-700">Receiver Information</p>
                <div className="space-y-1 text-gray-600">
                  <p>{receiverName}</p>
                  <p>{receiverPhone}</p>
                  <p>{userEmail}</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 text-left text-sm">
                {payment.fulfillment_type === "collection" ? (
                  <>
                    <p className="mb-2 font-semibold text-gray-700">In-store Self Collection</p>
                    <div className="space-y-1 text-gray-600">
                      <p>{PICKUP_ADDRESS}</p>
                      <p>
                        Collection Date:{" "}
                        {payment.collection_date ? formatDateOnly(payment.collection_date) : "-"}
                      </p>
                      <p>Time Slot: {payment.collection_time_slot ?? "-"}</p>
                      {payment.collection_remarks && <p>Remarks: {payment.collection_remarks}</p>}
                    </div>
                    {payment.collection_pin && (
                      <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-center">
                        <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
                          Your Collection PIN
                        </p>
                        <p className="mt-1 text-2xl font-bold text-brand-700">{payment.collection_pin}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Show this PIN to our staff when collecting your item.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mb-2 font-semibold text-gray-700">Billing Address</p>
                    {payment.shipping_address ? (
                      <div className="space-y-1 text-gray-600">
                        <p>
                          {payment.shipping_address.label} — {payment.shipping_address.recipient_name}
                        </p>
                        <p>{payment.shipping_address.address_line1}</p>
                        {payment.shipping_address.address_line2 && (
                          <p>{payment.shipping_address.address_line2}</p>
                        )}
                        <p>
                          {payment.shipping_address.city}, {payment.shipping_address.state}{" "}
                          {payment.shipping_address.postal_code}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-400">No address on file</p>
                    )}
                  </>
                )}
              </div>

              <p className="text-left text-sm text-gray-500">
                Billing method: <span className="font-medium text-gray-700">Bank Transfer</span>
              </p>

              {payment.tracking_number && payment.fulfillment_type !== "collection" && (
                <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-left">
                  <div className="flex items-center gap-2 text-brand-700">
                    <Truck className="h-5 w-5" />
                    <p className="font-semibold">Tracking Number</p>
                  </div>
                  <p className="mt-1 text-lg font-bold text-brand-700">{payment.tracking_number}</p>
                  {payment.courier && (
                    <p className="mt-1 text-sm text-brand-600">Courier: {payment.courier}</p>
                  )}
                  {trackingUrl && (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                      Track Your Order
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
