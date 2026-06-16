"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Payment, ShippingAddress } from "@/types/database";

export default function PaymentDetailPage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [addressId, setAddressId] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [fulfillmentChoice, setFulfillmentChoice] = useState<"shipping" | "collection">("shipping");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: pay } = await supabase
        .from("payments")
        .select("*, auction:auctions(*)")
        .eq("auction_id", auctionId)
        .eq("user_id", user.id)
        .single();
      if (pay) {
        setPayment(pay);
        const auctionShippingType = (pay.auction as { shipping_type?: string } | undefined)?.shipping_type;
        if (auctionShippingType === "collection") setFulfillmentChoice("collection");
      }

      const { data: addrs } = await supabase
        .from("shipping_addresses")
        .select("*")
        .eq("user_id", user.id);
      if (addrs) {
        setAddresses(addrs);
        const defaultAddr = addrs.find((a) => a.is_default);
        if (defaultAddr) setAddressId(defaultAddr.id);
      }
    }
    load();
  }, [auctionId, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payment) return;
    setError("");
    setMessage("");
    setLoading(true);

    const isCollection = fulfillmentChoice === "collection";
    const updates: Partial<Payment> = {
      payment_proof_url: proofUrl,
      status: "submitted",
      fulfillment_type: fulfillmentChoice,
      shipping_fee: isCollection ? 0 : payment.shipping_fee,
      total_amount: isCollection ? payment.amount : payment.total_amount,
    };
    if (!isCollection && addressId) {
      updates.shipping_address_id = addressId;
    }

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

  const auctionShippingType = (payment.auction as { shipping_type?: string } | undefined)?.shipping_type;
  const canChooseFulfillment = auctionShippingType === "both";
  const isCollection = fulfillmentChoice === "collection";
  const displayedShippingFee = isCollection ? 0 : payment.shipping_fee;
  const displayedTotal = payment.amount + displayedShippingFee;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{payment.auction?.title}</CardTitle>
            <Badge variant={payment.status === "verified" ? "success" : "warning"}>
              {payment.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canChooseFulfillment && payment.status === "pending" && (
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
              <p className="font-medium">{formatCurrency(payment.amount)}</p>
            </div>
            <div>
              <p className="text-gray-500">Shipping Fee</p>
              <p className="font-medium">
                {isCollection ? (
                  <span className="text-green-600">RM 0 (Self Collection)</span>
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

          {payment.status === "pending" && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
              {error && <Alert variant="error">{error}</Alert>}
              {message && <Alert variant="success">{message}</Alert>}

              {!isCollection && addresses.length > 0 && (
                <Select
                  label="Shipping Address"
                  value={addressId}
                  onChange={(e) => setAddressId(e.target.value)}
                  options={addresses.map((a) => ({
                    value: a.id,
                    label: `${a.label} - ${a.address_line1}, ${a.city}`,
                  }))}
                />
              )}

              <Input
                label="Payment Proof URL"
                placeholder="Link to bank transfer receipt or screenshot"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                required
              />

              <Button type="submit" loading={loading} className="w-full">
                Submit Payment Proof
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
