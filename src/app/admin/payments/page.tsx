"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/utils";
import { COURIERS } from "@/lib/couriers";
import { resolveReceiverInfo } from "@/lib/shipping";
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
};

type WinCounts = {
  completed: number;
  pendingVerification: number;
  unpaid: number;
};

type PaymentRow = Omit<Payment, "auction" | "winner" | "shipping_address"> & {
  auction: AuctionSnippet | null;
  winner: WinnerSnippet | null;
  shipping_address: ShippingAddress | null;
};

type OpenDropdown = { paymentId: number; type: "auction" | "winner" | "delivery" } | null;

function isPendingOver24h(payment: PaymentRow): boolean {
  const createdAt = new Date(payment.created_at).getTime();
  return Date.now() - createdAt > 24 * 60 * 60 * 1000;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [filter, setFilter] = useState("submitted");
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [customerEmails, setCustomerEmails] = useState<Record<string, string>>({});
  const [customerEmailErrors, setCustomerEmailErrors] = useState<Record<string, string>>({});
  const [winCounts, setWinCounts] = useState<Record<string, WinCounts>>({});
  const [winCountsError, setWinCountsError] = useState<Record<string, string>>({});
  const [suspensionCounts, setSuspensionCounts] = useState<Record<string, number>>({});
  const [suspensionCountsError, setSuspensionCountsError] = useState<Record<string, string>>({});
  const [trackingDrafts, setTrackingDrafts] = useState<Record<number, string>>({});
  const [trackingSaving, setTrackingSaving] = useState<number | null>(null);
  const [courierDrafts, setCourierDrafts] = useState<Record<number, string>>({});
  const [collectionPinDrafts, setCollectionPinDrafts] = useState<Record<number, string>>({});
  const [collectionSaving, setCollectionSaving] = useState<number | null>(null);
  const [deliverySaving, setDeliverySaving] = useState<number | null>(null);
  const [winEmailSending, setWinEmailSending] = useState<number | null>(null);
  const [reminderSending, setReminderSending] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      let query = supabase
        .from("payments")
        .select(
          "*, auction:auctions(auction_number, title, condition, starting_price, current_bid, shipping_type), winner:profiles!winner_user_id(username, real_name, whatsapp), shipping_address:shipping_addresses(*)"
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
        setCourierDrafts(
          Object.fromEntries((data as PaymentRow[]).map((p) => [p.id, p.courier ?? ""]))
        );
      }
      setLoading(false);
    }
    setOpenDropdown(null);
    load();
  }, [filter, supabase]);

  useEffect(() => {
    async function sendPendingWinEmails() {
      const { data, error } = await supabase
        .from("payments")
        .select("id")
        .eq("payment_status", "pending")
        .eq("win_email_sent", false);

      if (error) {
        console.error("Failed to check for pending win emails:", error);
        return;
      }

      for (const p of data ?? []) {
        fetch("/api/payments/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: p.id, event: "won" }),
        }).catch((err) => console.error("Failed to trigger win email:", err));
      }
    }
    sendPendingWinEmails();
  }, [supabase]);

  async function loadCustomerEmail(userId: string) {
    if (customerEmails[userId]) return;
    setCustomerEmailErrors((prev) => {
      if (!(userId in prev)) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    try {
      const res = await fetch(`/api/admin/customer-email?userId=${userId}`);
      const data = await res.json();
      if (res.ok && data.email) {
        setCustomerEmails((prev) => ({ ...prev, [userId]: data.email }));
      } else {
        const reason = data?.error ?? `HTTP ${res.status}`;
        console.error("Failed to load customer email:", res.status, data);
        setCustomerEmailErrors((prev) => ({ ...prev, [userId]: reason }));
      }
    } catch (err) {
      console.error("Failed to load customer email:", err);
      setCustomerEmailErrors((prev) => ({
        ...prev,
        [userId]: err instanceof Error ? err.message : "Network error",
      }));
    }
  }

  async function loadWinCounts(userId: string) {
    if (winCounts[userId]) return;
    setWinCountsError((prev) => {
      if (!(userId in prev)) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    const { data, error } = await supabase
      .from("payments")
      .select("payment_status")
      .eq("winner_user_id", userId);

    if (error) {
      console.error("Failed to load win counts:", error);
      setWinCountsError((prev) => ({ ...prev, [userId]: error.message }));
      return;
    }

    const completedStatuses = ["verified", "collected", "dispatched", "delivered"];
    const counts: WinCounts = { completed: 0, pendingVerification: 0, unpaid: 0 };
    for (const row of data ?? []) {
      if (completedStatuses.includes(row.payment_status)) counts.completed++;
      else if (row.payment_status === "submitted") counts.pendingVerification++;
      else if (row.payment_status === "pending") counts.unpaid++;
    }
    setWinCounts((prev) => ({ ...prev, [userId]: counts }));
  }

  async function loadSuspensionCount(userId: string) {
    if (userId in suspensionCounts) return;
    setSuspensionCountsError((prev) => {
      if (!(userId in prev)) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    const { count, error } = await supabase
      .from("user_suspensions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to load suspension count:", error);
      setSuspensionCountsError((prev) => ({ ...prev, [userId]: error.message }));
      return;
    }
    setSuspensionCounts((prev) => ({ ...prev, [userId]: count ?? 0 }));
  }

  function toggleDropdown(payment: PaymentRow, type: "auction" | "winner" | "delivery") {
    setOpenDropdown((prev) => {
      const isOpen = prev?.paymentId === payment.id && prev?.type === type;
      if (!isOpen && (type === "delivery" || type === "winner")) loadCustomerEmail(payment.winner_user_id);
      if (!isOpen && type === "winner") {
        loadWinCounts(payment.winner_user_id);
        loadSuspensionCount(payment.winner_user_id);
      }
      return isOpen ? null : { paymentId: payment.id, type };
    });
  }

  async function notify(
    paymentId: number,
    event: "reviewed" | "dispatched" | "collected" | "delivered",
    approved?: boolean
  ) {
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

  async function resendWinEmail(payment: PaymentRow) {
    setActionError("");
    setWinEmailSending(payment.id);
    try {
      const res = await fetch("/api/payments/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id, event: "won", force: true }),
      });
      if (!res.ok) {
        setActionError(`Failed to resend win email: ${await res.text()}`);
      } else {
        setPayments((prev) =>
          prev.map((p) => (p.id === payment.id ? { ...p, win_email_sent: true } : p))
        );
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to resend win email");
    } finally {
      setWinEmailSending(null);
    }
  }

  async function sendPaymentReminder(payment: PaymentRow) {
    setActionError("");
    setReminderSending(payment.id);
    try {
      const res = await fetch("/api/payments/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id, event: "reminder" }),
      });
      if (!res.ok) {
        setActionError(`Failed to send payment reminder: ${await res.text()}`);
      } else {
        const sentAt = new Date().toISOString();
        setPayments((prev) =>
          prev.map((p) => (p.id === payment.id ? { ...p, payment_reminder_sent_at: sentAt } : p))
        );
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send payment reminder");
    } finally {
      setReminderSending(null);
    }
  }

  async function verifyPayment(payment: PaymentRow, approved: boolean) {
    setActionError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payment_status = approved ? "verified" : "rejected";
    const isCollectionOrder = payment.fulfillment_type === "collection";
    const collectionPin =
      approved && isCollectionOrder ? String(Math.floor(100000 + Math.random() * 900000)) : undefined;

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        payment_status,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        ...(collectionPin ? { collection_pin: collectionPin } : {}),
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
    const courier = courierDrafts[payment.id]?.trim() ?? "";
    if (
      !trackingNumber ||
      !courier ||
      (trackingNumber === (payment.tracking_number ?? "") && courier === (payment.courier ?? ""))
    )
      return;

    setTrackingSaving(payment.id);
    setActionError("");

    const dispatchedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        tracking_number: trackingNumber,
        courier,
        payment_status: "dispatched",
        dispatched_at: dispatchedAt,
      })
      .eq("id", payment.id);

    if (updateError) {
      setActionError(`Failed to save tracking number: ${updateError.message}`);
      setTrackingSaving(null);
      return;
    }

    await notify(payment.id, "dispatched");

    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    setFilter("dispatched");
    setTrackingSaving(null);
  }

  async function markDelivered(payment: PaymentRow) {
    setActionError("");
    setDeliverySaving(payment.id);

    const { error: updateError } = await supabase
      .from("payments")
      .update({ payment_status: "delivered" })
      .eq("id", payment.id);

    if (updateError) {
      setActionError(`Failed to mark as delivered: ${updateError.message}`);
      setDeliverySaving(null);
      return;
    }

    await notify(payment.id, "delivered");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("admin_activity_logs").insert({
        admin_id: user.id,
        action: "mark_delivered",
        entity_type: "payments",
        entity_id: payment.id.toString(),
      });
    }

    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    setFilter("delivered");
    setDeliverySaving(null);
  }

  async function revertToDispatched(payment: PaymentRow) {
    setActionError("");
    setDeliverySaving(payment.id);

    const dispatchedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("payments")
      .update({ payment_status: "dispatched", dispatched_at: dispatchedAt })
      .eq("id", payment.id);

    if (updateError) {
      setActionError(`Failed to revert to dispatched: ${updateError.message}`);
      setDeliverySaving(null);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("admin_activity_logs").insert({
        admin_id: user.id,
        action: "revert_to_dispatched",
        entity_type: "payments",
        entity_id: payment.id.toString(),
      });
    }

    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    setFilter("dispatched");
    setDeliverySaving(null);
  }

  async function confirmCollection(payment: PaymentRow) {
    setActionError("");
    const pin = collectionPinDrafts[payment.id]?.trim() ?? "";
    if (!pin) return;

    if (pin !== payment.collection_pin) {
      setActionError("Incorrect PIN. Please check and try again.");
      return;
    }

    setCollectionSaving(payment.id);

    const { error: updateError } = await supabase
      .from("payments")
      .update({ payment_status: "collected" })
      .eq("id", payment.id);

    if (updateError) {
      setActionError(`Failed to confirm collection: ${updateError.message}`);
      setCollectionSaving(null);
      return;
    }

    await notify(payment.id, "collected");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("admin_activity_logs").insert({
        admin_id: user.id,
        action: "confirm_collection",
        entity_type: "payments",
        entity_id: payment.id.toString(),
      });
    }

    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    setFilter("collected");
    setCollectionSaving(null);
  }

  const filters = [
    "all",
    "submitted",
    "pending",
    "verified",
    "dispatched",
    "delivered",
    "collected",
    "rejected",
  ];

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
            const canConfirmCollection = isCollection && payment.payment_status === "verified";
            const canMarkDelivered = payment.payment_status === "dispatched" && !isCollection;
            const canRevertToDispatched = payment.payment_status === "delivered" && !isCollection;
            const draft = trackingDrafts[payment.id] ?? "";
            const courierDraft = courierDrafts[payment.id] ?? "";
            const pinDraft = collectionPinDrafts[payment.id] ?? "";
            const { name: deliveryReceiverName, phone: deliveryReceiverPhone } = resolveReceiverInfo({
              shippingAddress: payment.shipping_address,
              profileRealName: payment.winner?.real_name,
              profileWhatsapp: payment.winner?.whatsapp,
            });

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
                            <span className="text-gray-500">Full name: </span>
                            {payment.winner?.real_name ?? "—"}
                          </p>
                          <p>
                            <span className="text-gray-500">WhatsApp: </span>
                            {payment.winner?.whatsapp ?? "—"}
                          </p>
                          <p>
                            <span className="text-gray-500">Email: </span>
                            {customerEmails[payment.winner_user_id] ??
                              (customerEmailErrors[payment.winner_user_id] ? (
                                <span className="text-red-500">
                                  Unavailable ({customerEmailErrors[payment.winner_user_id]})
                                </span>
                              ) : (
                                "Loading…"
                              ))}
                          </p>
                          {winCountsError[payment.winner_user_id] ? (
                            <p className="text-red-500">
                              Failed to load win counts ({winCountsError[payment.winner_user_id]})
                            </p>
                          ) : (
                            <>
                              <p>
                                <span className="text-gray-500">Completed Wins: </span>
                                {winCounts[payment.winner_user_id]?.completed ?? "…"}
                              </p>
                              <p>
                                <span className="text-gray-500">Pending Verification: </span>
                                {winCounts[payment.winner_user_id]?.pendingVerification ?? "…"}
                              </p>
                              <p>
                                <span className="text-gray-500">Unpaid: </span>
                                {winCounts[payment.winner_user_id]?.unpaid ?? "…"}
                              </p>
                            </>
                          )}
                          <p>
                            <span className="text-gray-500">Suspensions: </span>
                            {suspensionCountsError[payment.winner_user_id] ? (
                              <span className="text-red-500">
                                Unavailable ({suspensionCountsError[payment.winner_user_id]})
                              </span>
                            ) : suspensionCounts[payment.winner_user_id] === undefined ? (
                              "…"
                            ) : (
                              <span
                                className={
                                  suspensionCounts[payment.winner_user_id] > 0
                                    ? "font-semibold text-red-600"
                                    : undefined
                                }
                              >
                                {suspensionCounts[payment.winner_user_id]}
                              </span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* Delivery details — clickable */}
                      <button
                        onClick={() => toggleDropdown(payment, "delivery")}
                        className="mt-1 flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 transition-colors text-left"
                      >
                        <span>Delivery Details</span>
                        <ChevronDown
                          className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${deliveryOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {deliveryOpen && (
                        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm space-y-1">
                          {payment.payment_status === "pending" ? (
                            <p className="text-gray-400">
                              Awaiting customer to complete payment and delivery details
                            </p>
                          ) : (
                            <>
                              <p>
                                <span className="text-gray-500">Full name: </span>
                                {deliveryReceiverName || "—"}
                              </p>
                              <p>
                                <span className="text-gray-500">Phone: </span>
                                {deliveryReceiverPhone || "—"}
                              </p>
                              <p>
                                <span className="text-gray-500">Email: </span>
                                {customerEmails[payment.winner_user_id] ??
                                  (customerEmailErrors[payment.winner_user_id] ? (
                                    <span className="text-red-500">
                                      Unavailable ({customerEmailErrors[payment.winner_user_id]})
                                    </span>
                                  ) : (
                                    "Loading…"
                                  ))}
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
                                  {payment.collection_pin && (
                                    <p>
                                      <span className="text-gray-500">Collection PIN: </span>
                                      {payment.collection_pin}
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
                            </>
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

                      {payment.payment_status === "pending" && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant={payment.win_email_sent ? "success" : "warning"}>
                            {payment.win_email_sent ? "✅ Notified" : "⏳ Pending"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            loading={winEmailSending === payment.id}
                            onClick={() => resendWinEmail(payment)}
                          >
                            Resend Win Email
                          </Button>
                          {payment.win_email_sent && isPendingOver24h(payment) && (
                            payment.payment_reminder_sent_at ? (
                              <Button size="sm" variant="outline" disabled>
                                Reminder Sent {formatDate(payment.payment_reminder_sent_at)}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                loading={reminderSending === payment.id}
                                onClick={() => sendPaymentReminder(payment)}
                              >
                                Send Payment Reminder
                              </Button>
                            )
                          )}
                        </div>
                      )}

                      {canTrack && (
                        <div className="mt-3 space-y-2">
                          <Select
                            value={courierDraft}
                            onChange={(e) =>
                              setCourierDrafts((prev) => ({ ...prev, [payment.id]: e.target.value }))
                            }
                            options={[
                              { value: "", label: "Select courier" },
                              ...COURIERS.map((c) => ({ value: c.name, label: c.name })),
                            ]}
                            className="max-w-xs"
                          />
                          <div className="flex items-center gap-2">
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
                              disabled={
                                !draft.trim() ||
                                !courierDraft ||
                                (draft.trim() === (payment.tracking_number ?? "") &&
                                  courierDraft === (payment.courier ?? ""))
                              }
                              onClick={() => saveTracking(payment)}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      )}

                      {canConfirmCollection && (
                        <div className="mt-3 flex items-center gap-2">
                          <Input
                            value={pinDraft}
                            onChange={(e) =>
                              setCollectionPinDrafts((prev) => ({ ...prev, [payment.id]: e.target.value }))
                            }
                            placeholder="Enter PIN"
                            className="max-w-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            loading={collectionSaving === payment.id}
                            disabled={!pinDraft.trim()}
                            onClick={() => confirmCollection(payment)}
                          >
                            Confirm Collection
                          </Button>
                        </div>
                      )}

                      {canMarkDelivered && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            loading={deliverySaving === payment.id}
                            onClick={() => markDelivered(payment)}
                          >
                            Mark as Delivered
                          </Button>
                        </div>
                      )}

                      {canRevertToDispatched && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            loading={deliverySaving === payment.id}
                            onClick={() => revertToDispatched(payment)}
                          >
                            Revert to Dispatched
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
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
