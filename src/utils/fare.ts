import type { TransitResult } from "@/src/types";

/** Fare values come from the verified result; never substitute an estimate. */
export function hasDisplayableFare(trip: TransitResult): trip is TransitResult & { price: number; currency: string } {
  return typeof trip.price === "number" && Number.isFinite(trip.price)
    && trip.price >= 0 && Boolean(trip.currency?.trim());
}
