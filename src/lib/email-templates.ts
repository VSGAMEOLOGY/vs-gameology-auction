import { formatCurrency, formatDateOnly } from "@/lib/utils";

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
  };
}

export function buildPaymentVerifiedEmail({
  username,
  auctionTitle,
  isCollection,
  collectionDate,
  collectionTimeSlot,
}: {
  username: string;
  auctionTitle: string;
  isCollection: boolean;
  collectionDate?: string | null;
  collectionTimeSlot?: string | null;
}) {
  const lines = [`Dear ${username}, your payment has been received successfully!`, ""];

  if (isCollection) {
    lines.push(
      "Your item is ready for collection. Please refer to the collection details below:",
      "Pickup Location: NO 92-A (TINGKAT 1), JALAN BPU 1, BANDAR PUCHONG UTAMA, 47100 PUCHONG, SELANGOR.",
      `Collection Date: ${collectionDate ? formatDateOnly(collectionDate) : "-"}.`,
      `Time Slot: ${collectionTimeSlot ?? "-"}.`,
      "Please bring along this email as reference. See you soon!"
    );
  } else {
    lines.push(
      "Please allow us some time to prepare your item. We will update your shipment tracking number once your order has been dispatched. Thank you for your patience!"
    );
  }

  return {
    subject: `Payment Verified - ${auctionTitle} - VS GAMEOLOGY`,
    text: lines.join("\n"),
  };
}

export function buildOrderDispatchedEmail({
  username,
  auctionTitle,
  trackingNumber,
}: {
  username: string;
  auctionTitle: string;
  trackingNumber: string;
}) {
  return {
    subject: `Your Order Has Been Dispatched! - ${auctionTitle} - VS GAMEOLOGY`,
    text: [
      `Dear ${username}, great news! Your order has been dispatched.`,
      `Your tracking number is: ${trackingNumber}.`,
      "Please use this to track your delivery.",
      "Thank you for shopping with VS GAMEOLOGY!",
    ].join("\n"),
  };
}
