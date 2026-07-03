import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<NotifyBody>;
    const { paymentId, event, approved } = body;

    if (!paymentId || !event) {
      console.error("/api/payments/notify: missing paymentId or event", body);
      return NextResponse.json({ error: "Missing paymentId or event" }, { status: 400 });
    }

    const supabase = await createClient();

    if (event === "submitted") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.error("/api/payments/notify: no authenticated user for 'submitted' event");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: ownPayment, error: ownPaymentError } = await supabase
        .from("payments")
        .select("winner_user_id")
        .eq("id", paymentId)
        .single();

      if (ownPaymentError) {
        console.error("/api/payments/notify: failed to load payment for auth check", ownPaymentError);
      }

      if (!ownPayment || ownPayment.winner_user_id !== user.id) {
        console.error("/api/payments/notify: caller does not own payment", { paymentId, userId: user.id });
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      try {
        await requireAdmin(supabase);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unauthorized";
        console.error("/api/payments/notify: admin check failed", message);
        return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 401 });
      }
    }

    const service = createServiceClient();

    const { data: payment, error: paymentError } = await service
      .from("payments")
      .select("*, auction:auctions(title, auction_number)")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("/api/payments/notify: payment not found", paymentId, paymentError);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const { data: winnerProfile, error: profileError } = await service
      .from("profiles")
      .select("username")
      .eq("id", payment.winner_user_id)
      .single();

    if (profileError) {
      console.error("/api/payments/notify: failed to load winner profile", profileError);
    }

    const { data: winnerAuth, error: winnerAuthError } = await service.auth.admin.getUserById(
      payment.winner_user_id
    );
    if (winnerAuthError) {
      console.error("/api/payments/notify: failed to look up winner auth user", winnerAuthError);
    }
    const winnerEmail = winnerAuth?.user?.email ?? null;

    const auctionTitle: string = payment.auction?.title ?? "Auction";
    const username: string = winnerProfile?.username ?? "Customer";

    let emailSent = false;
    let notified = false;

    if (event === "submitted") {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        console.error("/api/payments/notify: ADMIN_EMAIL env var is not set, skipping admin email");
      } else {
        const { subject, text, html } = buildPaymentSubmittedEmail({
          auctionTitle,
          auctionNumber: payment.auction?.auction_number ?? "-",
          username,
          amount: payment.total_amount,
          submittedAt: formatDate(new Date().toISOString()),
        });
        const result = await sendEmail({ to: adminEmail, subject, text, html });
        emailSent = result.ok;
        if (!result.ok) {
          console.error("/api/payments/notify: failed to send admin email", result.error);
        }
      }

      const { data: admins, error: adminsError } = await service
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      if (adminsError) {
        console.error("/api/payments/notify: failed to look up admin profiles", adminsError);
      }

      if (admins && admins.length > 0) {
        const { error: notifyError } = await service.from("notifications").insert(
          admins.map((admin) => ({
            user_id: admin.id,
            notification_type: "payment_submitted",
            title: "New Payment Submitted",
            message: `${username} submitted payment of ${formatCurrency(payment.total_amount)} for ${auctionTitle}.`,
            related_auction_id: payment.auction_id,
          }))
        );
        if (notifyError) {
          console.error("/api/payments/notify: failed to insert admin notifications", notifyError);
        }
        notified = !notifyError;
      } else {
        console.error("/api/payments/notify: no admin profiles found to notify");
      }
    } else if (event === "reviewed") {
      if (approved) {
        if (!winnerEmail) {
          console.error("/api/payments/notify: no email on file for winner, skipping verified email", payment.winner_user_id);
        } else {
          const { subject, text, html } = buildPaymentVerifiedEmail({
            username,
            auctionTitle,
            auctionNumber: payment.auction?.auction_number ?? "-",
            winningBid: payment.winning_bid,
            shippingFee: payment.shipping_fee,
            totalAmount: payment.total_amount,
            isCollection: payment.fulfillment_type === "collection",
            collectionDate: payment.collection_date,
            collectionTimeSlot: payment.collection_time_slot,
            paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payments/${payment.auction_id}`,
          });
          const result = await sendEmail({ to: winnerEmail, subject, text, html });
          emailSent = result.ok;
          if (!result.ok) {
            console.error("/api/payments/notify: failed to send verified email", result.error);
          }
        }
      }

      const { error: notifyError } = await service.from("notifications").insert({
        user_id: payment.winner_user_id,
        notification_type: approved ? "payment_verified" : "payment_rejected",
        title: approved ? "Payment Verified" : "Payment Rejected",
        message: approved
          ? `Your payment for ${auctionTitle} has been verified.`
          : `Your payment for ${auctionTitle} was rejected. Please contact support.`,
        related_auction_id: payment.auction_id,
      });
      if (notifyError) {
        console.error("/api/payments/notify: failed to insert reviewed notification", notifyError);
      }
      notified = !notifyError;
    } else if (event === "dispatched") {
      if (!payment.tracking_number) {
        console.error("/api/payments/notify: dispatched event with no tracking_number", paymentId);
        return NextResponse.json({ error: "No tracking number set" }, { status: 400 });
      }

      if (!winnerEmail) {
        console.error("/api/payments/notify: no email on file for winner, skipping dispatched email", payment.winner_user_id);
      } else {
        const { subject, text, html } = buildOrderDispatchedEmail({
          username,
          auctionTitle,
          totalAmount: payment.total_amount,
          trackingNumber: payment.tracking_number,
        });
        const result = await sendEmail({ to: winnerEmail, subject, text, html });
        emailSent = result.ok;
        if (!result.ok) {
          console.error("/api/payments/notify: failed to send dispatched email", result.error);
        }
      }

      const { error: notifyError } = await service.from("notifications").insert({
        user_id: payment.winner_user_id,
        notification_type: "order_dispatched",
        title: "Order Dispatched",
        message: `Your order has been dispatched! Tracking number: ${payment.tracking_number}`,
        related_auction_id: payment.auction_id,
      });
      if (notifyError) {
        console.error("/api/payments/notify: failed to insert dispatched notification", notifyError);
      }
      notified = !notifyError;
    }

    return NextResponse.json({ ok: true, emailSent, notified });
  } catch (err) {
    console.error("/api/payments/notify: unhandled error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
