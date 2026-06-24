"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Payment, ShippingAddress } from "@/types/database";

const EAST_MALAYSIA_STATES = ["Sabah", "Sarawak", "Labuan"];
const WHATSAPP_NUMBER = "60139681228";
const EAST_UNAVAILABLE_MESSAGE =
  "This item does not ship to East Malaysia. Please choose Self Collection or contact us at https://wa.me/60139681228";

const MALAYSIA_STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis",
  "Penang", "Sabah", "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur", "Putrajaya", "Labuan",
];

function resolveZone(state: string): "east" | "west" {
  return EAST_MALAYSIA_STATES.includes(state) ? "east" : "west";
}

const emptyAddress = {
  label: "Home",
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
  const [payment, setPayment] = useState<Payment | null>(null);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [addressMode, setAddressMode] = useState<"saved" | "new">("saved");
  const [addressId, setAddressId] = useState("");
  const [newAddress, setNewAddress] = useState(emptyAddress);
  const [proofUrl, setProofUrl] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [fulfillmentChoice, setFulfillmentChoice] = useState<"shipping" | "collection">("shipping");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
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

      const { data: pay } = await supabase
        .from("payments")
        .select("*, auction:auctions(*)")
        .eq("auction_id", auctionId)
        .eq("winner_user_id", user.id)
        .single();
      if (pay) {
        setPayment(pay);
        if (pay.fulfillment_type === "collection" || pay.auction?.shipping_type === "collection") {
          setFulfillmentChoice("collection");
        }
      }

      const { data: addrs } = await supabase
        .from("shipping_addresses")
        .select("*")
        .eq("user_id", user.id);
      if (addrs && addrs.length > 0) {
        setAddresses(addrs);
        const defaultAddr = addrs.find((a) => a.is_default);
        setAddressId((defaultAddr ?? addrs[0]).id.toString());
      } else {
        setAddressMode("new");
      }
    }
    load();
  }, [auctionId, supabase]);

  const auction = payment?.auction;
  const canChooseFulfillment = auction?.shipping_type === "both";
  const isCollection = fulfillmentChoice === "collection";

  const selectedSavedAddress = addresses.find((a) => a.id.toString() === addressId);
  const selectedState = addressMode === "saved" ? selectedSavedAddress?.state : newAddress.state;
  const zone = selectedState ? resolveZone(selectedState) : null;
  const eastUnavailable = zone === "east" && auction?.ships_to_east === false;

  const resolvedShippingFee = isCollection
    ? 0
    : zone === "east"
      ? auction?.shipping_fee_east ?? 0
      : auction?.shipping_fee_west ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payment) return;
    setError("");
    setMessage("");

    if (!proofUrl) {
      setError("Please upload your payment screenshot");
      return;
    }

    let finalState: string | undefined;

    if (!isCollection) {
      if (addressMode === "new") {
        if (
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
        if (!addressId) {
          setError("Please select a shipping address");
          return;
        }
        finalState = selectedSavedAddress?.state;
      }

      if (finalState && resolveZone(finalState) === "east" && auction?.ships_to_east === false) {
        setError(EAST_UNAVAILABLE_MESSAGE);
        return;
      }
    }

    setLoading(true);

    let shippingAddressId: number | null = null;
    if (!isCollection) {
      if (addressMode === "new") {
        const { data: savedAddress, error: addressError } = await supabase
          .from("shipping_addresses")
          .insert({ ...newAddress, user_id: userId })
          .select()
          .single();
        if (addressError) {
          setError(addressError.message);
          setLoading(false);
          return;
        }
        shippingAddressId = savedAddress.id;
      } else {
        shippingAddressId = Number(addressId);
      }
    }

    const shippingFee = isCollection || !finalState
      ? 0
      : resolveZone(finalState) === "east"
        ? auction?.shipping_fee_east ?? 0
        : auction?.shipping_fee_west ?? 0;

    const updates: Partial<Payment> = {
      receipt_url: proofUrl,
      payment_status: "submitted",
      fulfillment_type: fulfillmentChoice,
      shipping_fee: shippingFee,
      total_amount: payment.winning_bid + shippingFee,
      ...(shippingAddressId ? { shipping_address_id: shippingAddressId } : {}),
    };

    const { error: updateError } = await supabase
      .from("payments")
      .update(updates)
      .eq("id", payment.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Payment proof submitted. Awaiting admin verification.");
      setPayment({ ...payment, ...updates });
    }
    setLoading(false);
  }

  if (!payment) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-center text-gray-500">Loading...</div>;
  }

  const isPending = payment.payment_status === "pending";
  const displayedShippingFee = isPending ? resolvedShippingFee : payment.shipping_fee;
  const displayedTotal = isPending
    ? payment.winning_bid + (isCollection ? 0 : resolvedShippingFee)
    : payment.total_amount;

  const readyForPayment = isPending && !eastUnavailable && (isCollection || zone !== null);
  const zoneLabel = isCollection ? "Self Collection" : zone === "east" ? "East Malaysia" : "West Malaysia";

  const whatsappMessage = [
    "Congratulations! You won the auction! \u{1F389}",
    "",
    `Auction No: ${auction?.auction_number ?? ""}`,
    `Item: ${payment.auction?.title ?? ""}`,
    `Winning Bid: RM ${payment.winning_bid.toFixed(2)}`,
    `Shipping Fee: RM ${displayedShippingFee.toFixed(2)} (${zoneLabel})`,
    `Total Amount: RM ${displayedTotal.toFixed(2)}`,
    "",
    "Payment Details:",
    "Bank: Maybank",
    "Account No: 5123 4373 9288",
    "Account Name: VS GAMEOLOGY",
    "",
    "Please **SHARE YOUR PAYMENT SCREENSHOT HERE** and also **UPLOAD IT ON THE WEBSITE** to complete your payment. Thank you!",
  ].join("\n");
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{payment.auction?.title}</CardTitle>
            <Badge variant={payment.payment_status === "verified" ? "success" : "warning"}>
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

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Winning Bid</p>
              <p className="font-medium">{formatCurrency(payment.winning_bid)}</p>
            </div>
            <div>
              <p className="text-gray-500">Shipping Fee</p>
              <p className="font-medium">
                {isCollection ? (
                  <span className="text-green-600">RM 0 (Self Collection)</span>
                ) : isPending && !zone ? (
                  <span className="text-gray-400">Select an address</span>
                ) : (
                  formatCurrency(displayedShippingFee)
                )}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Total</p>
              <p className="text-xl font-bold text-brand-600">{formatCurrency(displayedTotal)}</p>
            </div>
          </div>

          {payment.admin_notes && (
            <Alert variant="info">Admin note: {payment.admin_notes}</Alert>
          )}

          {isPending && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
              {error && <Alert variant="error">{error}</Alert>}
              {message && <Alert variant="success">{message}</Alert>}

              {!isCollection && (
                <div className="space-y-3">
                  {addresses.length > 0 && (
                    <div className="flex gap-6 text-sm">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="addressMode"
                          checked={addressMode === "saved"}
                          onChange={() => setAddressMode("saved")}
                          className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        Use saved address
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="addressMode"
                          checked={addressMode === "new"}
                          onChange={() => setAddressMode("new")}
                          className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        Add new address
                      </label>
                    </div>
                  )}

                  {addressMode === "saved" && addresses.length > 0 ? (
                    <Select
                      label="Shipping Address"
                      value={addressId}
                      onChange={(e) => setAddressId(e.target.value)}
                      options={addresses.map((a) => ({
                        value: a.id.toString(),
                        label: `${a.label} - ${a.address_line1}, ${a.city}, ${a.state}`,
                      }))}
                    />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
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

                  {zone && !eastUnavailable && (
                    <p className="text-xs text-gray-500">
                      Detected zone: {zone === "east" ? "East Malaysia" : "West Malaysia"}
                    </p>
                  )}

                  {eastUnavailable && (
                    <Alert variant="error">{EAST_UNAVAILABLE_MESSAGE}</Alert>
                  )}
                </div>
              )}

              {readyForPayment && (
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-700">Payment Details</p>
                  <div className="text-sm text-gray-600">
                    <p>Bank: Maybank</p>
                    <p>Account No: 5123 4373 9288</p>
                    <p>Account Name: VS GAMEOLOGY</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
                  >
                    Pay via WhatsApp
                  </Button>
                </div>
              )}

              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium text-gray-700">Upload Payment Screenshot</p>
                <div className="flex items-center gap-4">
                  {proofUrl && (
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
                      <Image src={proofUrl} alt="Payment screenshot preview" fill className="object-cover" />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptChange}
                      disabled={receiptUploading}
                      className="text-sm text-gray-600"
                    />
                    {receiptUploading && <p className="mt-1 text-sm text-gray-500">Uploading...</p>}
                  </div>
                </div>

                <Button
                  type="submit"
                  loading={loading}
                  disabled={eastUnavailable || receiptUploading || !proofUrl}
                  className="w-full"
                >
                  Submit Payment Proof
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
