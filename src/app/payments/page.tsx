"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard } from "lucide-react";
import type { Payment } from "@/types/database";

const PAGE_SIZE = 20;

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  pending: "warning",
  submitted: "info",
  verified: "success",
  rejected: "danger",
  refunded: "default",
  collected: "success",
  dispatched: "info",
  delivered: "success",
};

type PaymentRow = Payment & {
  auction: { title: string; shipping_type: string | null; auction_number: string } | null;
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const supabase = createClient();

  async function loadPage(offset: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from("payments")
      .select("*, auction:auctions(title, shipping_type, auction_number)")
      .eq("winner_user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    return (data as PaymentRow[]) ?? [];
  }

  useEffect(() => {
    async function load() {
      const data = await loadPage(0);
      setPayments(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function loadMore() {
    setLoadingMore(true);
    const data = await loadPage(payments.length);
    setPayments((prev) => [...prev, ...data]);
    setHasMore(data.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <CreditCard className="h-7 w-7 text-brand-600" />
        <h1 className="text-2xl font-bold text-gray-900">My Payments</h1>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-gray-500">Loading...</p>
      ) : payments.length > 0 ? (
        <div className="mt-6 space-y-4">
          {payments.map((payment) => (
            <Link key={payment.id} href={`/payments/${payment.auction_id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {payment.auction?.title || "Auction"}
                    </p>
                    <p className="text-xs text-gray-400">
                      Auction #{payment.auction?.auction_number ?? "—"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(payment.created_at)} &middot;{" "}
                      {payment.auction?.shipping_type === "collection" ? "Collection" : "Shipping"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-brand-600">
                      {formatCurrency(payment.total_amount)}
                    </p>
                    <Badge variant={statusVariant[payment.payment_status]}>
                      {payment.payment_status.charAt(0).toUpperCase() + payment.payment_status.slice(1)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {hasMore && (
            <div className="pt-2 text-center">
              <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-12 text-center text-gray-500">
          <CreditCard className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4">No payments yet</p>
          <p className="mt-1 text-sm">Win an auction to see payment details here</p>
        </div>
      )}
    </div>
  );
}
