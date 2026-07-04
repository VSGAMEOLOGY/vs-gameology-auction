import { formatCurrency } from "@/lib/utils";

export const EAST_MALAYSIA_STATES = ["Sabah", "Sarawak", "Labuan"];

export function resolveShippingZone(state?: string | null): "east" | "west" {
  return state && EAST_MALAYSIA_STATES.includes(state) ? "east" : "west";
}

export function formatShippingFeeLabel({
  isCollection,
  shippingFee,
  state,
}: {
  isCollection: boolean;
  shippingFee: number;
  state?: string | null;
}): string {
  if (isCollection) return `${formatCurrency(0)} (Self Collection)`;
  const zone = resolveShippingZone(state);
  return `${formatCurrency(shippingFee)} (${zone === "east" ? "East Malaysia" : "West Malaysia"})`;
}

/**
 * Receiver name/phone must come from the shipping address the customer
 * selected when submitting payment, not their profile -- profiles.real_name
 * and profiles.whatsapp only serve as a fallback for orders with no
 * shipping address on file (self collection).
 */
export function resolveReceiverInfo({
  shippingAddress,
  profileRealName,
  profileWhatsapp,
}: {
  shippingAddress?: { recipient_name?: string | null; phone?: string | null } | null;
  profileRealName?: string | null;
  profileWhatsapp?: string | null;
}): { name: string; phone: string } {
  return {
    name: shippingAddress?.recipient_name || profileRealName || "",
    phone: shippingAddress?.phone || profileWhatsapp || "",
  };
}
