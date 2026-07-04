export const COURIERS = [
  { name: "SPX Express", trackingUrlPrefix: "https://spx.my/order/track?trackingNo=" },
  { name: "NinjaVan", trackingUrlPrefix: "https://www.ninjavan.co/en-my/tracking?id=" },
  { name: "LineClear", trackingUrlPrefix: "https://www.lineclear.com/tracking?tracking_no=" },
] as const;

export function getCourierTrackingUrl(
  courier?: string | null,
  trackingNumber?: string | null
): string | null {
  if (!courier || !trackingNumber) return null;
  const match = COURIERS.find((c) => c.name === courier);
  if (!match) return null;
  return `${match.trackingUrlPrefix}${encodeURIComponent(trackingNumber)}`;
}
