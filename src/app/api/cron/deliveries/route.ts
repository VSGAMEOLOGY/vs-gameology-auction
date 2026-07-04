import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { buildOrderDeliveredEmail } from "@/lib/email-templates";
import { formatShippingFeeLabel, resolveReceiverInfo } from "@/lib/shipping";

export const maxDuration = 60;

const DELIVER_AFTER_DAYS = 14;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const cutoff = new Date(Date.now() - DELIVER_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: duePayments, error } = await service
    .from("payments")
    .select(
      "*, auction:auctions(title, auction_number), shipping_address:shipping_addresses(state, recipient_name, phone)"
    )
    .eq("payment_status", "dispatched")
    .not("dispatched_at", "is", null)
    .lte("dispatched_at", cutoff);

  if (error) {
    console.error("/api/cron/deliveries: failed to load due payments", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let delivered = 0;
  const errors: string[] = [];

  for (const payment of duePayments ?? []) {
    const { error: updateError } = await service
      .from("payments")
      .update({ payment_status: "delivered" })
      .eq("id", payment.id);

    if (updateError) {
      errors.push(`payment ${payment.id}: ${updateError.message}`);
      continue;
    }
    delivered++;

    const { data: winnerProfile } = await service
      .from("profiles")
      .select("username, real_name, whatsapp")
      .eq("id", payment.winner_user_id)
      .single();

    const { data: winnerAuth } = await service.auth.admin.getUserById(payment.winner_user_id);
    const winnerEmail = winnerAuth?.user?.email ?? null;
    const username = winnerProfile?.username ?? "Customer";
    const auctionTitle = payment.auction?.title ?? "Auction";

    if (winnerEmail) {
      const shippingFeeLabel = formatShippingFeeLabel({
        isCollection: payment.fulfillment_type === "collection",
        shippingFee: payment.shipping_fee,
        state: payment.shipping_address?.state ?? null,
      });
      const { name: receiverName, phone: receiverPhone } = resolveReceiverInfo({
        shippingAddress: payment.shipping_address,
        profileRealName: winnerProfile?.real_name,
        profileWhatsapp: winnerProfile?.whatsapp,
      });
      const { subject, text, html } = buildOrderDeliveredEmail({
        username,
        auctionTitle,
        auctionNumber: payment.auction?.auction_number ?? "-",
        winningBid: payment.winning_bid,
        shippingFeeLabel,
        totalAmount: payment.total_amount,
        receiverName,
        receiverPhone,
      });
      const result = await sendEmail({ to: winnerEmail, subject, text, html });
      if (!result.ok) {
        errors.push(`payment ${payment.id} email: ${result.error}`);
      }
    } else {
      errors.push(`payment ${payment.id}: no email on file for winner`);
    }

    const { error: notifyError } = await service.from("notifications").insert({
      user_id: payment.winner_user_id,
      notification_type: "order_delivered",
      title: "Order Delivered",
      message: `Your order for ${auctionTitle} has been delivered. We hope you enjoy your item!`,
      related_auction_id: payment.auction_id,
    });
    if (notifyError) {
      errors.push(`payment ${payment.id} notification: ${notifyError.message}`);
    }
  }

  return NextResponse.json({ success: errors.length === 0, delivered, errors });
}
