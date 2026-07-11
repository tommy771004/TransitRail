import { useEffect, useMemo, useState } from "react";
import { Clock3, MoonStar, Sunrise } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Country, TransitResult } from "../types";
import { countryConfig, providerDateValue } from "../data/countries";

interface RouteServiceOverviewProps {
  country: Country;
  date: string;
  results: TransitResult[];
}

function toMinutes(time: string | undefined): number | undefined {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return undefined;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatRemaining(minutes: number, isChinese: boolean) {
  if (minutes <= 0) return isChinese ? "末班車已發車" : "Last service has departed";
  if (isChinese) return `距離末班車還有 ${minutes} 分鐘`;
  return `${minutes} min until the last service`;
}

/** A compact, country-timezone-aware summary of the canonical-day timetable. */
export function RouteServiceOverview({ country, date, results }: RouteServiceOverviewProps) {
  const { i18n } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const isChinese = i18n.language.toLowerCase().startsWith("zh");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    let first: string | undefined;
    let last: string | undefined;
    let firstMinutes = Number.POSITIVE_INFINITY;
    let lastMinutes = Number.NEGATIVE_INFINITY;
    for (const trip of results) {
      const minutes = toMinutes(trip.departureTime);
      if (minutes === undefined) continue;
      if (minutes < firstMinutes) {
        firstMinutes = minutes;
        first = trip.departureTime;
      }
      if (minutes > lastMinutes) {
        lastMinutes = minutes;
        last = trip.departureTime;
      }
    }
    return { first, last, lastMinutes };
  }, [results]);

  if (!summary.first || !summary.last) return null;

  const serviceToday = date === providerDateValue(country);
  const serviceTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: countryConfig[country].timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const hour = Number(serviceTime.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(serviceTime.find((part) => part.type === "minute")?.value || 0);
  const remaining = summary.lastMinutes - (hour * 60 + minute);
  const showCountdown = serviceToday && remaining >= 0 && remaining <= 90;

  return (
    <section className="mx-auto max-w-md px-4 pt-3" aria-label={isChinese ? "路線時刻速覽" : "Route timetable overview"}>
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
          <Sunrise className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-[10px] font-bold text-amber-700/75 dark:text-amber-300/75">{isChinese ? "首班車" : "First service"}</p>
            <p className="font-mono text-sm font-black text-slate-900 dark:text-white">{summary.first}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 dark:bg-indigo-950/30">
          <MoonStar className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <div>
            <p className="text-[10px] font-bold text-indigo-700/75 dark:text-indigo-300/75">{isChinese ? "末班車" : "Last service"}</p>
            <p className="font-mono text-sm font-black text-slate-900 dark:text-white">{summary.last}</p>
          </div>
        </div>
      </div>
      {showCountdown ? (
        <p className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          <Clock3 className="h-3.5 w-3.5" />
          {formatRemaining(remaining, isChinese)}
        </p>
      ) : null}
    </section>
  );
}
