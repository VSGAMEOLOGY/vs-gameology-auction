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
