import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard } from "lucide-react";

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

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: payments } = await supabase
    .from("payments")
    .select("*, auction:auctions(title, shipping_type, auction_number)")
    .eq("winner_user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <CreditCard className="h-7 w-7 text-brand-600" />
        <h1 className="text-2xl font-bold text-gray-900">My Payments</h1>
      </div>

      {payments && payments.length > 0 ? (
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
