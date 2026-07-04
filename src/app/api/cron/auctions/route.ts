import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { buildAuctionWonEmail } from "@/lib/email-templates";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const timestamp = new Date().toISOString();
  const errors: string[] = [];

  const { error: activateError } = await supabase.rpc("activate_scheduled_auctions");
  if (activateError) errors.push(`activate: ${activateError.message}`);

  const { error: endError } = await supabase.rpc("end_expired_auctions");
  if (endError) errors.push(`end: ${endError.message}`);

  type PendingWinPayment = {
    id: number;
    auction_id: number;
    winner_user_id: string;
    winning_bid: number;
    auction: {
      title: string;
      auction_number: string;
      shipping_type: string | null;
      shipping_fee_west: number | null;
      shipping_fee_east: number | null;
    } | null;
  };

  const { data: pendingWinEmails, error: pendingError } = await supabase
    .from("payments")
    .select(
      "id, auction_id, winner_user_id, winning_bid, auction:auctions(title, auction_number, shipping_type, shipping_fee_west, shipping_fee_east)"
    )
    .is("win_email_sent_at", null)
    .returns<PendingWinPayment[]>();

  if (pendingError) {
    errors.push(`win emails lookup: ${pendingError.message}`);
  }

  let winEmailsSent = 0;

  for (const payment of pendingWinEmails ?? []) {
    const { data: winnerProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", payment.winner_user_id)
      .single();

    const { data: winnerAuth } = await supabase.auth.admin.getUserById(payment.winner_user_id);
    const winnerEmail = winnerAuth?.user?.email ?? null;
    const auctionTitle = payment.auction?.title ?? "Auction";

    if (winnerEmail) {
      const { subject, text, html } = buildAuctionWonEmail({
        username: winnerProfile?.username ?? "Customer",
        auctionTitle,
        auctionNumber: payment.auction?.auction_number ?? "-",
        winningBid: payment.winning_bid,
        shippingType: payment.auction?.shipping_type ?? null,
        shippingFeeWest: payment.auction?.shipping_fee_west ?? null,
        shippingFeeEast: payment.auction?.shipping_fee_east ?? null,
        paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payments/${payment.auction_id}`,
      });
      const result = await sendEmail({ to: winnerEmail, subject, text, html });
      if (!result.ok) errors.push(`win email for payment ${payment.id}: ${result.error}`);
      else winEmailsSent++;
    } else {
      errors.push(`win email for payment ${payment.id}: no email on file for winner`);
    }

    const { error: markSentError } = await supabase
      .from("payments")
      .update({ win_email_sent_at: new Date().toISOString() })
      .eq("id", payment.id);
    if (markSentError) errors.push(`win email mark-sent for payment ${payment.id}: ${markSentError.message}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ success: false, timestamp, winEmailsSent, errors }, { status: 500 });
  }

  return NextResponse.json({ success: true, timestamp, winEmailsSent });
}
