"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDateOnly } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { Payment, ShippingAddress } from "@/types/database";

type AuctionSnippet = {
  auction_number: string;
  title: string;
  condition: string;
  starting_price: number;
  current_bid: number | null;
  shipping_type: string | null;
};

type WinnerSnippet = {
  username: string;
  real_name: string;
  whatsapp: string;
  completed_wins: number;
  unpaid_wins: number;
};

type PaymentRow = Omit<Payment, "auction" | "winner" | "shipping_address"> & {
  auction: AuctionSnippet | null;
  winner: WinnerSnippet | null;
  shipping_address: ShippingAddress | null;
};

type OpenDropdown = { paymentId: number; type: "auction" | "winner" | "delivery" } | null;

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [filter, setFilter] = useState("submitted");
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [customerEmails, setCustomerEmails] = useState<Record<string, string>>({});
  const [trackingDrafts, setTrackingDrafts] = useState<Record<number, string>>({});
  const [trackingSaving, setTrackingSaving] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      let query = supabase
        .from("payments")
        .select(
          "*, auction:auctions(auction_number, title, condition, starting_price, current_bid, shipping_type), winner:profiles!winner_user_id(username, real_name, whatsapp, completed_wins, unpaid_wins), shipping_address:shipping_addresses(*)"
        )
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("payment_status", filter);
      }

      const { data, error } = await query;
      if (error) setActionError(`Failed to load payments: ${error.message}`);
      if (data) {
        setPayments(data as PaymentRow[]);
        setTrackingDrafts(
          Object.fromEntries((data as PaymentRow[]).map((p) => [p.id, p.tracking_number ?? ""]))
        );
      }
      setLoading(false);
    }
    setOpenDropdown(null);
    load();
  }, [filter, supabase]);

  async function loadCustomerEmail(userId: string) {
    if (customerEmails[userId]) return;
    try {
      const res = await fetch(`/api/admin/customer-email?userId=${userId}`);
      const data = await res.json();
      if (res.ok && data.email) {
        setCustomerEmails((prev) => ({ ...prev, [userId]: data.email }));
      } else {
        console.error("Failed to load customer email:", res.status, data);
        setCustomerEmails((prev) => ({ ...prev, [userId]: "Unavailable" }));
      }
    } catch (err) {
      console.error("Failed to load customer email:", err);
      setCustomerEmails((prev) => ({ ...prev, [userId]: "Unavailable" }));
    }
  }

  function toggleDropdown(payment: PaymentRow, type: "auction" | "winner" | "delivery") {
    setOpenDropdown((prev) => {
      const isOpen = prev?.paymentId === payment.id && prev?.type === type;
      if (!isOpen && type === "delivery") loadCustomerEmail(payment.winner_user_id);
      return isOpen ? null : { paymentId: payment.id, type };
    });
  }

  async function notify(paymentId: number, event: "reviewed" | "dispatched", approved?: boolean) {
    try {
      const res = await fetch("/api/payments/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, event, approved }),
      });
      if (!res.ok) {
        console.error("Failed to send notification:", res.status, await res.text());
      }
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  }

  async function verifyPayment(payment: PaymentRow, approved: boolean) {
    setActionError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payment_status = approved ? "verified" : "rejected";
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        payment_status,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (updateError) {
      setActionError(`Failed to update payment: ${updateError.message}`);
      return;
    }

    await notify(payment.id, "reviewed", approved);

    await supabase.from("admin_activity_logs").insert({
      admin_id: user.id,
      action: approved ? "verify_payment" : "reject_payment",
      entity_type: "payments",
      entity_id: payment.id.toString(),
    });

    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    setFilter(payment_status);
  }

  async function saveTracking(payment: PaymentRow) {
    const trackingNumber = trackingDrafts[payment.id]?.trim() ?? "";
    if (!trackingNumber || trackingNumber === (payment.tracking_number ?? "")) return;

    setTrackingSaving(payment.id);
    setActionError("");

    const { error: updateError } = await supabase
      .from("payments")
      .update({ tracking_number: trackingNumber })
      .eq("id", payment.id);

    if (updateError) {
      setActionError(`Failed to save tracking number: ${updateError.message}`);
      setTrackingSaving(null);
      return;
    }

    setPayments((prev) =>
      prev.map((p) => (p.id === payment.id ? { ...p, tracking_number: trackingNumber } : p))
    );
    await notify(payment.id, "dispatched");
    setTrackingSaving(null);
  }

  const filters = ["all", "submitted", "pending", "verified", "rejected"];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Payment Verification</h1>

      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{actionError}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${
              filter === f ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-gray-500">Loading...</p>
      ) : payments.length > 0 ? (
        <div className="mt-6 space-y-4">
          {payments.map((payment) => {
            const auctionOpen = openDropdown?.paymentId === payment.id && openDropdown?.type === "auction";
            const winnerOpen = openDropdown?.paymentId === payment.id && openDropdown?.type === "winner";
            const deliveryOpen = openDropdown?.paymentId === payment.id && openDropdown?.type === "delivery";
            const isCollection = payment.fulfillment_type === "collection";
            const canTrack = payment.payment_status === "verified" && !isCollection;
            const draft = trackingDrafts[payment.id] ?? "";

            return (
              <Card key={payment.id}>
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* Auction title — clickable */}
                      <button
                        onClick={() => toggleDropdown(payment, "auction")}
                        className="flex items-center gap-1 font-medium text-gray-900 hover:text-brand-600 transition-colors text-left"
                      >
                        <span>{payment.auction?.title ?? "Unknown auction"}</span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${auctionOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {/* Auction dropdown */}
                      {auctionOpen && (
                        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm space-y-1">
                          <p>
                            <span className="text-gray-500">Auction #: </span>
                            {payment.auction?.auction_number ?? "—"}
                          </p>
                          <p>
                            <span className="text-gray-500">Condition: </span>
                            {payment.auction?.condition ?? "—"}
                          </p>
                          <p>
                            <span className="text-gray-500">Starting price: </span>
                            {payment.auction?.starting_price != null
                              ? formatCurrency(payment.auction.starting_price)
                              : "—"}
                          </p>
                          <p>
                            <span className="text-gray-500">Winning bid: </span>
                            {formatCurrency(payment.winning_bid)}
                          </p>
                          <p>
                            <span className="text-gray-500">Shipping: </span>
                            {payment.auction?.shipping_type ?? "N/A"}
                          </p>
                        </div>
                      )}

                      {/* Winner name — clickable */}
                      <button
                        onClick={() => toggleDropdown(payment, "winner")}
                        className="mt-1 flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 transition-colors text-left"
                      >
                        <span>{payment.winner?.real_name ?? "Unknown winner"}</span>
                        <ChevronDown
                          className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${winnerOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {/* Winner dropdown */}
                      {winnerOpen && (
                        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm space-y-1">
                          <p>
                            <span className="text-gray-500">Completed wins: </span>
                            {payment.winner?.completed_wins ?? 0}
                          </p>
                          <p>
                            <span className="text-gray-500">Unpaid wins: </span>
                            {payment.winner?.unpaid_wins ?? 0}
                          </p>
                        </div>
                      )}

                      {/* Delivery details — clickable, only meaningful once submitted */}
                      {payment.payment_status !== "pending" && (
                        <button
                          onClick={() => toggleDropdown(payment, "delivery")}
                          className="mt-1 flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 transition-colors text-left"
                        >
                          <span>Delivery Details</span>
                          <ChevronDown
                            className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${deliveryOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                      )}

                      {deliveryOpen && (
                        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm space-y-1">
                          <p>
                            <span className="text-gray-500">Full name: </span>
                            {payment.winner?.real_name ?? "—"}
                          </p>
                          <p>
                            <span className="text-gray-500">WhatsApp: </span>
                            {payment.winner?.whatsapp ?? "—"}
                          </p>
                          <p>
                            <span className="text-gray-500">Email: </span>
                            {customerEmails[payment.winner_user_id] ?? "Loading…"}
                          </p>
                          {isCollection ? (
                            <>
                              <p>
                                <span className="text-gray-500">Collection date: </span>
                                {payment.collection_date ? formatDateOnly(payment.collection_date) : "—"}
                              </p>
                              <p>
                                <span className="text-gray-500">Time slot: </span>
                                {payment.collection_time_slot ?? "—"}
                              </p>
                              {payment.collection_remarks && (
                                <p>
                                  <span className="text-gray-500">Remarks: </span>
                                  {payment.collection_remarks}
                                </p>
                              )}
                            </>
                          ) : payment.shipping_address ? (
                            <>
                              <p>
                                <span className="text-gray-500">Address label: </span>
                                {payment.shipping_address.label}
                              </p>
                              <p>
                                <span className="text-gray-500">Address: </span>
                                {payment.shipping_address.address_line1}
                                {payment.shipping_address.address_line2
                                  ? `, ${payment.shipping_address.address_line2}`
                                  : ""}
                              </p>
                              <p>
                                <span className="text-gray-500">City/State/Postcode: </span>
                                {payment.shipping_address.city}, {payment.shipping_address.state}{" "}
                                {payment.shipping_address.postal_code}
                              </p>
                            </>
                          ) : (
                            <p className="text-gray-400">No shipping address on file</p>
                          )}
                        </div>
                      )}

                      <p className="mt-2 text-lg font-bold text-brand-600">
                        {formatCurrency(payment.total_amount)}
                      </p>
                      {payment.receipt_url && (
                        <a
                          href={payment.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-sm text-brand-600 hover:underline"
                        >
                          View payment proof
                        </a>
                      )}

                      {canTrack && (
                        <div className="mt-3 flex items-center gap-2">
                          <Input
                            value={draft}
                            onChange={(e) =>
                              setTrackingDrafts((prev) => ({ ...prev, [payment.id]: e.target.value }))
                            }
                            placeholder="Tracking number"
                            className="max-w-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            loading={trackingSaving === payment.id}
                            disabled={!draft.trim() || draft.trim() === (payment.tracking_number ?? "")}
                            onClick={() => saveTracking(payment)}
                          >
                            Save
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={payment.payment_status === "verified" ? "success" : "warning"}>
                        {payment.payment_status}
                      </Badge>
                      {payment.payment_status === "submitted" && (
                        <>
                          <Button size="sm" onClick={() => verifyPayment(payment, true)}>
                            Verify
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => verifyPayment(payment, false)}>
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="mt-8 text-gray-500">No payments found</p>
      )}
    </div>
  );
}
