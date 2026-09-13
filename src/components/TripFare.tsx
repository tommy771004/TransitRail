import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TransitResult } from "../types";
import { fareSources } from "../data/fareSources";
import { hasDisplayableFare } from "../utils/fare";
import { loadOfficialFares, resolveOfficialFare, type FareDocument, type OfficialFare } from "../utils/officialFares";

interface Props {
  trip: TransitResult;
  active: boolean;
  formatPrice?: (trip: TransitResult) => string | null;
}

/** Presentation only: keep downloaded fares out of departures, sorting and saved results. */
export function TripFareContent({ trip, fare, formatPrice }: Omit<Props, "active"> & { fare?: OfficialFare | null }) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const original = hasDisplayableFare(trip);
  if (!original && !fare) return null;
  const priced = original ? trip : { ...trip, price: fare!.amount, currency: fare!.currency };
  return <div className="m3-card mb-6 flex flex-wrap items-center justify-between gap-3 bg-white p-4 dark:bg-slate-900" data-trip-fare>
    <div>
      <p className="m3-label-medium text-slate-500 dark:text-slate-400">{zh ? "此班次票價" : "Fare for this service"}</p>
      <p className="m3-title-large mt-1 font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatPrice?.(priced) || `${priced.price} ${priced.currency}`}</p>
    </div>
    {!original && fare && <div className="m3-body-small text-slate-500 dark:text-slate-400">
      <p>{zh ? fare.labelZh : fare.labelEn}</p>
      <a className="underline underline-offset-2" href={fare.sourceUrl} target="_blank" rel="noreferrer">{fare.publisher}</a>
    </div>}
  </div>;
}

export function TripFare({ trip, active, formatPrice }: Props) {
  const [doc, setDoc] = useState<FareDocument>();
  const original = hasDisplayableFare(trip);
  useEffect(() => {
    if (!active || original || !fareSources[trip.country]?.matching) return;
    let cancelled = false;
    void loadOfficialFares(trip.country).then(value => { if (!cancelled) setDoc(value); }).catch(() => {
      if (!cancelled) setDoc(undefined);
    });
    return () => { cancelled = true; };
  }, [active, original, trip.country]);
  const fare = !original && doc ? resolveOfficialFare(trip, doc) : null;
  return <TripFareContent trip={trip} fare={fare} formatPrice={formatPrice} />;
}
