import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import {
  buildPaymentSubmittedEmail,
  buildPaymentVerifiedEmail,
  buildOrderDispatchedEmail,
} from "@/lib/email-templates";
import { formatCurrency, formatDate } from "@/lib/utils";

type NotifyEvent = "submitted" | "reviewed" | "dispatched";

type NotifyBody = {
  paymentId: number;
  event: NotifyEvent;
  approved?: boolean;
};

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<NotifyBody>;
  const { paymentId, event, approved } = body;

  if (!paymentId || !event) {
    return NextResponse.json({ error: "Missing paymentId or event" }, { status: 400 });
  }

  const supabase = await createClient();

  if (event === "submitted") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ownPayment } = await supabase
      .from("payments")
      .select("winner_user_id")
      .eq("id", paymentId)
      .single();

    if (!ownPayment || ownPayment.winner_user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    try {
      await requireAdmin(supabase);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 401 });
    }
  }

  const service = getServiceClient();

  const { data: payment } = await service
    .from("payments")
    .select("*, auction:auctions(title, auction_number)")
    .eq("id", paymentId)
    .single();

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const { data: winnerProfile } = await service
    .from("profiles")
    .select("username")
    .eq("id", payment.winner_user_id)
    .single();

  const { data: winnerAuth } = await service.auth.admin.getUserById(payment.winner_user_id);
  const winnerEmail = winnerAuth?.user?.email ?? null;

  const auctionTitle: string = payment.auction?.title ?? "Auction";
  const username: string = winnerProfile?.username ?? "Customer";

  let emailSent = false;
  let notified = false;

  if (event === "submitted") {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const { subject, text } = buildPaymentSubmittedEmail({
        auctionTitle,
        auctionNumber: payment.auction?.auction_number ?? "-",
        username,
        amount: payment.total_amount,
        submittedAt: formatDate(new Date().toISOString()),
      });
      emailSent = (await sendEmail({ to: adminEmail, subject, text })).ok;
    }

    const { data: admins } = await service.from("profiles").select("id").eq("role", "admin");
    if (admins && admins.length > 0) {
      const { error } = await service.from("notifications").insert(
        admins.map((admin) => ({
          user_id: admin.id,
          notification_type: "payment_submitted",
          title: "New Payment Submitted",
          message: `${username} submitted payment of ${formatCurrency(payment.total_amount)} for ${auctionTitle}.`,
          related_auction_id: payment.auction_id,
        }))
      );
      notified = !error;
    }
  } else if (event === "reviewed") {
    if (approved && winnerEmail) {
      const { subject, text } = buildPaymentVerifiedEmail({
        username,
        auctionTitle,
        isCollection: payment.fulfillment_type === "collection",
        collectionDate: payment.collection_date,
        collectionTimeSlot: payment.collection_time_slot,
      });
      emailSent = (await sendEmail({ to: winnerEmail, subject, text })).ok;
    }

    const { error } = await service.from("notifications").insert({
      user_id: payment.winner_user_id,
      notification_type: approved ? "payment_verified" : "payment_rejected",
      title: approved ? "Payment Verified" : "Payment Rejected",
      message: approved
        ? `Your payment for ${auctionTitle} has been verified.`
        : `Your payment for ${auctionTitle} was rejected. Please contact support.`,
      related_auction_id: payment.auction_id,
    });
    notified = !error;
  } else if (event === "dispatched") {
    if (!payment.tracking_number) {
      return NextResponse.json({ error: "No tracking number set" }, { status: 400 });
    }

    if (winnerEmail) {
      const { subject, text } = buildOrderDispatchedEmail({
        username,
        auctionTitle,
        trackingNumber: payment.tracking_number,
      });
      emailSent = (await sendEmail({ to: winnerEmail, subject, text })).ok;
    }

    const { error } = await service.from("notifications").insert({
      user_id: payment.winner_user_id,
      notification_type: "order_dispatched",
      title: "Order Dispatched",
      message: `Your order has been dispatched! Tracking number: ${payment.tracking_number}`,
      related_auction_id: payment.auction_id,
    });
    notified = !error;
  }

  return NextResponse.json({ ok: true, emailSent, notified });
}
