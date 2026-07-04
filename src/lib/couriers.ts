export const COURIERS = [
  { name: "SPX Express", trackingUrlPrefix: "https://spx.com.my/track?", appendTrackingNumber: true },
  {
    name: "NinjaVan",
    trackingUrlPrefix: "https://www.ninjavan.co/en-my/tracking?id=",
    appendTrackingNumber: true,
  },
  { name: "LineClear", trackingUrlPrefix: "https://lineclearexpress.com/tracker", appendTrackingNumber: false },
] as const;

export function getCourierTrackingUrl(
  courier?: string | null,
  trackingNumber?: string | null
): string | null {
  if (!courier || !trackingNumber) return null;
  const match = COURIERS.find((c) => c.name === courier);
  if (!match) return null;
  return match.appendTrackingNumber
    ? `${match.trackingUrlPrefix}${encodeURIComponent(trackingNumber)}`
    : match.trackingUrlPrefix;
}
