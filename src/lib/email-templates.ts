import { formatCurrency, formatDateOnly } from "@/lib/utils";
import { getCourierTrackingUrl } from "@/lib/couriers";

const BRAND_BLUE = "#3B5BDB";
const PICKUP_ADDRESS =
  "NO 92-A (TINGKAT 1), JALAN BPU 1, BANDAR PUCHONG UTAMA, 47100 PUCHONG, SELANGOR";

const GAVEL_ICON_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${BRAND_BLUE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:8px;">
  <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"/>
  <path d="m16 16 6-6"/>
  <path d="m8 8 6-6"/>
  <path d="m9 7 8 8"/>
  <path d="m21 11-8-8"/>
</svg>`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell({
  heading,
  bodyHtml,
  footerText,
}: {
  heading: string;
  bodyHtml: string;
  footerText: string;
}) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
                <span style="font-size:20px;font-weight:700;color:${BRAND_BLUE};">${GAVEL_ICON_SVG}VS GAMEOLOGY</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827;">${heading}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;border-radius:0 0 8px 8px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#6b7280;">${footerText}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function summaryTable(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:6px;">
    ${rows
      .map(
        ([label, value], i) => `
      <tr style="${i % 2 === 1 ? "background-color:#f9fafb;" : ""}">
        <td style="padding:10px 16px;font-size:13px;color:#6b7280;">${escapeHtml(label)}</td>
        <td style="padding:10px 16px;font-size:13px;color:#111827;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
      </tr>`
      )
      .join("")}
  </table>`;
}

function buttonHtml(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="border-radius:6px;background-color:${BRAND_BLUE};">
        <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function highlightBox(label: string, value: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;">
    <tr>
      <td style="padding:16px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#4338ca;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(label)}</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#3730a3;letter-spacing:0.05em;">${escapeHtml(value)}</p>
      </td>
    </tr>
  </table>`;
}

export function buildPaymentSubmittedEmail({
  auctionTitle,
  auctionNumber,
  username,
  amount,
  submittedAt,
}: {
  auctionTitle: string;
  auctionNumber: string;
  username: string;
  amount: number;
  submittedAt: string;
}) {
  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:14px;color:#374151;">A customer has submitted payment for review.</p>
    ${summaryTable([
      ["Auction Title", auctionTitle],
      ["Auction Number", auctionNumber],
      ["Winner Username", username],
      ["Amount Paid", formatCurrency(amount)],
      ["Submission Time", submittedAt],
    ])}
    <p style="margin:16px 0 0;font-size:14px;color:#374151;">Please review and verify this payment in the admin panel.</p>
  `;

  return {
    subject: `New Payment Submitted - ${auctionTitle} - ${username}`,
    text: [
      "A customer has submitted payment for review.",
      "",
      `Auction: ${auctionTitle}`,
      `Auction No: ${auctionNumber}`,
      `Winner: ${username}`,
      `Amount Paid: ${formatCurrency(amount)}`,
      `Submitted At: ${submittedAt}`,
      "",
      "Please review and verify this payment in the admin panel.",
    ].join("\n"),
    html: emailShell({
      heading: "New Payment Received",
      bodyHtml,
      footerText: "VS GAMEOLOGY Auction Platform",
    }),
  };
}

export function buildPaymentVerifiedEmail({
  username,
  auctionTitle,
  auctionNumber,
  winningBid,
  shippingFee,
  totalAmount,
  isCollection,
  collectionDate,
  collectionTimeSlot,
  collectionPin,
  paymentUrl,
}: {
  username: string;
  auctionTitle: string;
  auctionNumber: string;
  winningBid: number;
  shippingFee: number;
  totalAmount: number;
  isCollection: boolean;
  collectionDate?: string | null;
  collectionTimeSlot?: string | null;
  collectionPin?: string | null;
  paymentUrl: string;
}) {
  const collectionDateLabel = collectionDate ? formatDateOnly(collectionDate) : "-";
  const timeSlotLabel = collectionTimeSlot ?? "-";

  const textLines = [`Dear ${username}, your payment has been received successfully!`, ""];
  let fulfillmentHtml: string;

  if (isCollection) {
    textLines.push(
      "Your item is ready for collection. Please refer to the collection details below:",
      `Pickup Location: ${PICKUP_ADDRESS}.`,
      `Collection Date: ${collectionDateLabel}.`,
      `Time Slot: ${timeSlotLabel}.`,
      ...(collectionPin ? [`Your Collection PIN: ${collectionPin}.`] : []),
      "Please bring along this email as reference. See you soon!"
    );
    fulfillmentHtml = `
      <p style="margin:16px 0 8px;font-size:14px;color:#374151;">Your item is ready for collection. Please refer to the collection details below:</p>
      ${summaryTable([
        ["Pickup Location", PICKUP_ADDRESS],
        ["Collection Date", collectionDateLabel],
        ["Time Slot", timeSlotLabel],
      ])}
      ${collectionPin ? highlightBox("Your Collection PIN", collectionPin) : ""}
      <p style="margin:16px 0 0;font-size:14px;color:#374151;">Please bring along this email as reference. See you soon!</p>
    `;
  } else {
    const note =
      "Please allow us some time to prepare your item. We will update your shipment tracking number once your order has been dispatched. Thank you for your patience!";
    textLines.push(note);
    fulfillmentHtml = `<p style="margin:16px 0 0;font-size:14px;color:#374151;">${note}</p>`;
  }

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:14px;color:#374151;">Dear ${escapeHtml(username)}, your payment has been received successfully!</p>
    ${summaryTable([
      ["Auction Title", auctionTitle],
      ["Auction Number", auctionNumber],
      ["Winning Bid", formatCurrency(winningBid)],
      ["Shipping Fee", formatCurrency(shippingFee)],
      ["Total Amount", formatCurrency(totalAmount)],
    ])}
    ${fulfillmentHtml}
    ${buttonHtml(paymentUrl, "View Payment Details")}
  `;

  return {
    subject: `Payment Verified - ${auctionTitle} - VS GAMEOLOGY`,
    text: textLines.join("\n"),
    html: emailShell({
      heading: "Thank You for Your Payment!",
      bodyHtml,
      footerText: "VS GAMEOLOGY Auction Platform | vs.gameology@gmail.com",
    }),
  };
}

export function buildOrderDispatchedEmail({
  username,
  auctionTitle,
  totalAmount,
  trackingNumber,
  courier,
}: {
  username: string;
  auctionTitle: string;
  totalAmount: number;
  trackingNumber: string;
  courier: string;
}) {
  const trackingUrl = getCourierTrackingUrl(courier, trackingNumber);

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:14px;color:#374151;">Dear ${escapeHtml(username)}, great news! Your order has been dispatched.</p>
    <p style="margin:16px 0 4px;font-size:13px;font-weight:600;color:#111827;">Track Your Order</p>
    ${highlightBox("Tracking Number", trackingNumber)}
    ${summaryTable([
      ["Auction Title", auctionTitle],
      ["Courier", courier],
      ["Total Amount", formatCurrency(totalAmount)],
    ])}
    ${trackingUrl ? buttonHtml(trackingUrl, "Track Your Order") : ""}
    <p style="margin:16px 0 0;font-size:14px;color:#374151;">Please use this tracking number to track your delivery. Thank you for shopping with VS GAMEOLOGY!</p>
  `;

  return {
    subject: `Your Order Has Been Dispatched! - ${auctionTitle} - VS GAMEOLOGY`,
    text: [
      `Dear ${username}, great news! Your order has been dispatched.`,
      `Courier: ${courier}.`,
      `Your tracking number is: ${trackingNumber}.`,
      ...(trackingUrl ? [`Track your order: ${trackingUrl}`] : []),
      "Thank you for shopping with VS GAMEOLOGY!",
    ].join("\n"),
    html: emailShell({
      heading: "Your Order Is On Its Way!",
      bodyHtml,
      footerText: "VS GAMEOLOGY Auction Platform | vs.gameology@gmail.com",
    }),
  };
}

export function buildCollectionConfirmedEmail({
  username,
  auctionTitle,
  auctionNumber,
}: {
  username: string;
  auctionTitle: string;
  auctionNumber: string;
}) {
  const message = "Your collection has been confirmed! Thank you for shopping with VS GAMEOLOGY!";
  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:14px;color:#374151;">Dear ${escapeHtml(username)}, ${message}</p>
    ${summaryTable([
      ["Auction Title", auctionTitle],
      ["Auction Number", auctionNumber],
    ])}
  `;

  return {
    subject: `Collection Confirmed - ${auctionTitle} - VS GAMEOLOGY`,
    text: [`Dear ${username}, ${message}`].join("\n"),
    html: emailShell({
      heading: "Collection Confirmed!",
      bodyHtml,
      footerText: "VS GAMEOLOGY Auction Platform | vs.gameology@gmail.com",
    }),
  };
}
