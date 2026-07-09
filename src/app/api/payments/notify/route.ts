import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import {
  buildPaymentSubmittedEmail,
  buildPaymentVerifiedEmail,
  buildPaymentRejectedEmail,
  buildOrderDispatchedEmail,
  buildCollectionConfirmedEmail,
  buildOrderDeliveredEmail,
  buildAuctionWonEmail,
  buildPaymentReminderEmail,
} from "@/lib/email-templates";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatShippingFeeLabel, resolveReceiverInfo } from "@/lib/shipping";

type NotifyEvent =
  | "submitted"
  | "reviewed"
  | "dispatched"
  | "collected"
  | "delivered"
  | "won"
  | "reminder";

type NotifyBody = {
  paymentId: number;
  event: NotifyEvent;
  approved?: boolean;
  // Admin-only: for "won", bypass the win_email_sent dedup gate to
  // manually resend an already-sent win email (see /admin/payments'
  // "Resend Win Email" button).
  force?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<NotifyBody>;
    const { paymentId, event, approved, force } = body;

    if (!paymentId || !event) {
      console.error("/api/payments/notify: missing paymentId or event", body);
      return NextResponse.json({ error: "Missing paymentId or event" }, { status: 400 });
    }

    const supabase = await createClient();
    let callerIsAdmin = false;

    if (event === "submitted") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.error(`/api/payments/notify: no authenticated user for '${event}' event`);
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
    } else if (event === "won") {
      // Triggered either by the winner loading their own pending payment
      // page, or by an admin loading /admin/payments (to catch anyone who
      // hasn't visited theirs yet) -- allow either.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.error("/api/payments/notify: no authenticated user for 'won' event");
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

      const isOwner = ownPayment?.winner_user_id === user.id;
      if (!isOwner) {
        try {
          await requireAdmin(supabase);
          callerIsAdmin = true;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unauthorized";
          console.error("/api/payments/notify: 'won' event caller is neither owner nor admin", message);
          return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 401 });
        }
      }
    } else {
      try {
        await requireAdmin(supabase);
        callerIsAdmin = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unauthorized";
        console.error("/api/payments/notify: admin check failed", message);
        return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 401 });
      }
    }

    const service = createServiceClient();

    const { data: payment, error: paymentError } = await service
      .from("payments")
      .select(
        "*, auction:auctions(title, auction_number, shipping_type, shipping_fee_west, shipping_fee_east, ships_to_west, ships_to_east), shipping_address:shipping_addresses(state, recipient_name, phone)"
      )
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("/api/payments/notify: payment not found", paymentId, paymentError);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const isCollection = payment.fulfillment_type === "collection";
    const shippingFeeLabel = formatShippingFeeLabel({
      isCollection,
      shippingFee: payment.shipping_fee,
      state: payment.shipping_address?.state ?? null,
    });

    const { data: winnerProfile, error: profileError } = await service
      .from("profiles")
      .select("username, real_name, whatsapp")
      .eq("id", payment.winner_user_id)
      .single();

    if (profileError) {
      console.error("/api/payments/notify: failed to load winner profile", profileError);
    }

    const { name: receiverName, phone: receiverPhone } = resolveReceiverInfo({
      shippingAddress: payment.shipping_address,
      profileRealName: winnerProfile?.real_name,
      profileWhatsapp: winnerProfile?.whatsapp,
    });

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
      const isResubmission = (payment.resubmission_count ?? 0) > 0;
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        console.error("/api/payments/notify: ADMIN_EMAIL env var is not set, skipping admin email");
      } else {
        const { subject, text, html } = buildPaymentSubmittedEmail({
          auctionTitle,
          auctionNumber: payment.auction?.auction_number ?? "-",
          winningBid: payment.winning_bid,
          shippingFeeLabel,
          totalAmount: payment.total_amount,
          username,
          submittedAt: formatDate(new Date().toISOString()),
          adminPanelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/payments`,
          isResubmission,
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
            shippingFeeLabel,
            totalAmount: payment.total_amount,
            receiverName,
            receiverPhone,
            isCollection,
            collectionDate: payment.collection_date,
            collectionTimeSlot: payment.collection_time_slot,
            collectionPin: payment.collection_pin,
            paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payments/${payment.auction_id}`,
          });
          const result = await sendEmail({ to: winnerEmail, subject, text, html });
          emailSent = result.ok;
          if (!result.ok) {
            console.error("/api/payments/notify: failed to send verified email", result.error);
          }
        }
      } else {
        if (!winnerEmail) {
          console.error("/api/payments/notify: no email on file for winner, skipping rejected email", payment.winner_user_id);
        } else {
          const whatsappMessage = [
            "Hi, my payment was rejected for auction :",
            "",
            auctionTitle,
            `(Auction No: ${payment.auction?.auction_number ?? "-"}).`,
            `Winning Bid: RM${payment.winning_bid.toFixed(2)}.`,
            `Shipping : RM${payment.shipping_fee.toFixed(2)}`,
            `Total: RM${payment.total_amount.toFixed(2)}.`,
            "",
            `Username: ${username}`,
            `Email: ${winnerEmail}`,
            "",
            "Please advise. Thank you.",
          ].join("\n");
          const { subject, text, html } = buildPaymentRejectedEmail({
            username,
            auctionTitle,
            auctionNumber: payment.auction?.auction_number ?? "-",
            winningBid: payment.winning_bid,
            shippingFeeLabel,
            totalAmount: payment.total_amount,
            paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payments/${payment.auction_id}`,
            whatsappUrl: `https://wa.me/60139681228?text=${encodeURIComponent(whatsappMessage)}`,
          });
          const result = await sendEmail({ to: winnerEmail, subject, text, html });
          emailSent = result.ok;
          if (!result.ok) {
            console.error("/api/payments/notify: failed to send rejected email", result.error);
          }
        }
      }

      const { error: notifyError } = await service.from("notifications").insert({
        user_id: payment.winner_user_id,
        notification_type: approved ? "payment_verified" : "payment_rejected",
        title: approved ? "Payment Verified" : "Payment Rejected",
        message: approved
          ? `Your payment for ${auctionTitle} has been verified.`
          : `Your payment for ${auctionTitle} has been rejected. Please resubmit your payment or contact us for assistance.`,
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
          auctionNumber: payment.auction?.auction_number ?? "-",
          winningBid: payment.winning_bid,
          shippingFeeLabel,
          totalAmount: payment.total_amount,
          receiverName,
          receiverPhone,
          trackingNumber: payment.tracking_number,
          courier: payment.courier ?? "-",
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
        message: `Your order has been dispatched via ${payment.courier ?? "our courier"}! Tracking number: ${payment.tracking_number}`,
        related_auction_id: payment.auction_id,
      });
      if (notifyError) {
        console.error("/api/payments/notify: failed to insert dispatched notification", notifyError);
      }
      notified = !notifyError;
    } else if (event === "collected") {
      if (!winnerEmail) {
        console.error("/api/payments/notify: no email on file for winner, skipping collection confirmed email", payment.winner_user_id);
      } else {
        const { subject, text, html } = buildCollectionConfirmedEmail({
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
        emailSent = result.ok;
        if (!result.ok) {
          console.error("/api/payments/notify: failed to send collection confirmed email", result.error);
        }
      }

      const { error: notifyError } = await service.from("notifications").insert({
        user_id: payment.winner_user_id,
        notification_type: "collection_confirmed",
        title: "Collection Confirmed",
        message: "Your collection has been confirmed! Thank you for shopping with VS GAMEOLOGY!",
        related_auction_id: payment.auction_id,
      });
      if (notifyError) {
        console.error("/api/payments/notify: failed to insert collection confirmed notification", notifyError);
      }
      notified = !notifyError;
    } else if (event === "delivered") {
      if (!winnerEmail) {
        console.error("/api/payments/notify: no email on file for winner, skipping delivered email", payment.winner_user_id);
      } else {
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
        emailSent = result.ok;
        if (!result.ok) {
          console.error("/api/payments/notify: failed to send delivered email", result.error);
        }
      }

      const { error: notifyError } = await service.from("notifications").insert({
        user_id: payment.winner_user_id,
        notification_type: "order_delivered",
        title: "Order Delivered",
        message: `Your order for ${auctionTitle} has been delivered. We hope you enjoy your item!`,
        related_auction_id: payment.auction_id,
      });
      if (notifyError) {
        console.error("/api/payments/notify: failed to insert delivered notification", notifyError);
      }
      notified = !notifyError;
    } else if (event === "won") {
      // Atomic claim: only the caller that flips win_email_sent from false
      // to true actually sends the email, so re-firing this (e.g. the
      // page effect running twice) never double-sends. Admins can pass
      // force:true (the "Resend Win Email" button) to bypass this gate
      // and resend regardless of win_email_sent's current value.
      const forceResend = force === true && callerIsAdmin;
      let claim = service.from("payments").update({ win_email_sent: true }).eq("id", paymentId);
      if (!forceResend) claim = claim.eq("win_email_sent", false);
      const { data: claimedPayment, error: claimError } = await claim.select("id").maybeSingle();

      if (claimError) {
        console.error("/api/payments/notify: failed to claim win-email send", claimError);
      } else if (!claimedPayment) {
        // Already sent (or lost the race) -- nothing to do.
      } else if (!winnerEmail) {
        console.error("/api/payments/notify: no email on file for winner, skipping win email", payment.winner_user_id);
      } else {
        const { subject, text, html } = buildAuctionWonEmail({
          username,
          auctionTitle,
          auctionNumber: payment.auction?.auction_number ?? "-",
          winningBid: payment.winning_bid,
          shippingType: payment.auction?.shipping_type ?? null,
          shippingFeeWest: payment.auction?.shipping_fee_west ?? null,
          shippingFeeEast: payment.auction?.shipping_fee_east ?? null,
          shipsToWest: payment.auction?.ships_to_west ?? true,
          shipsToEast: payment.auction?.ships_to_east ?? true,
          paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payments/${payment.auction_id}`,
        });
        const result = await sendEmail({ to: winnerEmail, subject, text, html });
        emailSent = result.ok;
        if (!result.ok) {
          console.error("/api/payments/notify: failed to send win email", result.error);
        }
      }
      notified = true;
    } else if (event === "reminder") {
      if (payment.payment_status !== "pending") {
        return NextResponse.json({ error: "Payment is no longer pending" }, { status: 400 });
      }

      if (!winnerEmail) {
        console.error("/api/payments/notify: no email on file for winner, skipping reminder email", payment.winner_user_id);
      } else {
        const { subject, text, html } = buildPaymentReminderEmail({
          username,
          auctionTitle,
          auctionNumber: payment.auction?.auction_number ?? "-",
          winningBid: payment.winning_bid,
          shippingType: payment.auction?.shipping_type ?? null,
          shippingFeeWest: payment.auction?.shipping_fee_west ?? null,
          shippingFeeEast: payment.auction?.shipping_fee_east ?? null,
          shipsToWest: payment.auction?.ships_to_west ?? true,
          shipsToEast: payment.auction?.ships_to_east ?? true,
          totalAmount: payment.total_amount,
          paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payments/${payment.auction_id}`,
        });
        const result = await sendEmail({ to: winnerEmail, subject, text, html });
        emailSent = result.ok;
        if (!result.ok) {
          console.error("/api/payments/notify: failed to send reminder email", result.error);
        }
      }

      const { error: reminderError } = await service
        .from("payments")
        .update({ payment_reminder_sent_at: new Date().toISOString() })
        .eq("id", paymentId);
      if (reminderError) {
        console.error("/api/payments/notify: failed to update payment_reminder_sent_at", reminderError);
      }
      notified = true;
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
