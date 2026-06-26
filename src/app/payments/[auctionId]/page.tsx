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
import type { Payment, Profile, ShippingAddress } from "@/types/database";

const EAST_MALAYSIA_STATES = ["Sabah", "Sarawak", "Labuan"];
const WHATSAPP_NUMBER = "60139681228";
const EAST_UNAVAILABLE_NOTICE =
  "This item does not ship to East Malaysia. Please choose Self Collection or contact us on WhatsApp to arrange.";

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
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [addressMode, setAddressMode] = useState<"saved" | "new">("saved");
  const [addressId, setAddressId] = useState("");
  const [newAddress, setNewAddress] = useState(emptyAddress);
  const [proofUrl, setProofUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [fulfillmentChoice, setFulfillmentChoice] = useState<"shipping" | "collection">("shipping");
  const [message, setMessage] = useState("");
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
          .select("*, auction:auctions(*)")
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
      }
      if (prof) setProfile(prof);
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
        setError(EAST_UNAVAILABLE_NOTICE);
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

  const paymentPageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/payments/${auctionId}`;

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
    "Please SHARE YOUR PAYMENT SCREENSHOT HERE and also UPLOAD IT ON THE WEBSITE to complete your payment.",
    "",
    `To upload your payment proof, please visit: ${paymentPageUrl}`,
    "",
    "Thank you!",
  ].join("\n");
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

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
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200">
                      <Image src={proofUrl} alt="Payment screenshot preview" fill className="object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptChange}
                      disabled={receiptUploading}
                      className="text-sm text-gray-600"
                    />
                    {receiptUploading && (
                      <p className="mt-1 text-sm text-gray-500">Uploading…</p>
                    )}
                    {!receiptUploading && proofUrl && selectedFileName && (
                      <p className="mt-1 truncate text-sm text-green-600">
                        ✓ {selectedFileName}
                      </p>
                    )}
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
