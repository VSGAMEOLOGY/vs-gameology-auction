"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Payment } from "@/types/database";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState("submitted");
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      let query = supabase
        .from("payments")
        .select("*, auction:auctions(title), winner:profiles!winner_user_id(real_name)")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("payment_status", filter);
      }

      const { data } = await query;
      if (data) setPayments(data as Payment[]);
      setLoading(false);
    }
    load();
  }, [filter, supabase]);

  async function verifyPayment(payment: Payment, approved: boolean) {
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

    await supabase.from("notifications").insert({
      user_id: payment.winner_user_id,
      notification_type: approved ? "payment_verified" : "payment_rejected",
      title: approved ? "Payment Verified" : "Payment Rejected",
      message: approved
        ? `Your payment for ${payment.auction?.title} has been verified.`
        : `Your payment for ${payment.auction?.title} was rejected. Please contact support.`,
      related_auction_id: payment.auction_id,
    });

    await supabase.from("admin_activity_logs").insert({
      admin_id: user.id,
      action: approved ? "verify_payment" : "reject_payment",
      entity_type: "payments",
      entity_id: payment.id.toString(),
    });

    // Remove from current list immediately then switch tab so the useEffect
    // reloads the correct filtered list from the DB.
    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    setFilter(payment_status);
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
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{payment.auction?.title}</p>
                    <p className="text-sm text-gray-500">
                    {payment.winner?.real_name}
                    </p>
                    <p className="mt-1 text-lg font-bold text-brand-600">
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
          ))}
        </div>
      ) : (
        <p className="mt-8 text-gray-500">No payments found</p>
      )}
    </div>
  );
}
