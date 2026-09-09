import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Country } from "../types";
import { stationLabel } from "../utils/stationLabel";

type LiveContext = {
  status: "available" | "uncovered" | "unavailable" | "ambiguous" | "empty_live_data" | "error";
  provider: "Transit";
  retrievedAt: string;
  reason?: string;
  freshness?: string;
  departures: Array<{ time?: string; route?: string; headsign?: string; cancelled?: boolean; terminal?: string }>;
  alerts: Array<{ title: string; description?: string; severity?: string }>;
};

type Plan = {
  status: "available" | "uncovered" | "unavailable" | "ambiguous" | "empty_live_data" | "error";
  kind: "third_party_plan";
  provider: "Transit";
  retrievedAt: string;
  reason?: string;
  itineraries?: Array<{ durationMinutes?: number; legs: Array<{ mode?: string; route?: string; durationMinutes?: number; instructions?: string[] }>; fare?: string }>;
};

/** Every status but `available` explains itself; `available` needs no caption. */
const statusKey: Record<LiveContext["status"], string | null> = {
  available: null,
  uncovered: "transit_supplement.status_uncovered",
  unavailable: "transit_supplement.status_unavailable",
  ambiguous: "transit_supplement.status_ambiguous",
  empty_live_data: "transit_supplement.status_empty_live_data",
  error: "transit_supplement.status_error",
};

function isLiveContext(value: unknown): value is LiveContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<LiveContext>;
  return typeof context.status === "string" && Array.isArray(context.departures) && Array.isArray(context.alerts);
}

function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<Plan>;
  return typeof plan.status === "string" && plan.kind === "third_party_plan";
}

function formatTime(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** A separately attributed UI boundary; none of this data is a verified timetable. */
export function TransitAppSupplement({ country, origin, destination }: { country: Country; origin: string; destination: string }) {
  const { t } = useTranslation();
  const [live, setLive] = useState<LiveContext>();
  const [liveLoading, setLiveLoading] = useState(false);
  const [plan, setPlan] = useState<Plan>();
  const [planLoading, setPlanLoading] = useState(false);

  const loadLive = async () => {
    setLiveLoading(true);
    try {
      const params = new URLSearchParams({ country, station: origin });
      const response = await fetch(`/api/transit/transit-app/live?${params}`);
      const payload: unknown = await response.json();
      if (!response.ok || !isLiveContext(payload)) throw new Error("Invalid live-data response");
      setLive(payload);
    } catch {
      setLive({ status: "error", provider: "Transit", retrievedAt: new Date().toISOString(), reason: "request_failed", departures: [], alerts: [] });
    } finally {
      setLiveLoading(false);
    }
  };

  const loadPlan = async () => {
    setPlanLoading(true);
    try {
      const response = await fetch("/api/transit/transit-app/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ country, origin, destination }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isPlan(payload)) throw new Error("Invalid journey-plan response");
      setPlan(payload);
    } catch {
      setPlan({ status: "error", kind: "third_party_plan", provider: "Transit", retrievedAt: new Date().toISOString(), reason: "request_failed" });
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <aside className="mx-auto max-w-md space-y-3 px-4 pb-8" aria-label={t("transit_supplement.title")}>
      <div className="m3-card m3-card-large border border-indigo-200 bg-indigo-50/70 p-4 text-sm dark:border-indigo-900/70 dark:bg-indigo-950/20">
        <p className="font-bold text-indigo-950 dark:text-indigo-100">{t("transit_supplement.title")}</p>
        <p className="mt-1 text-xs leading-relaxed text-indigo-800 dark:text-indigo-200">
          {t("transit_supplement.disclaimer")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadLive()} disabled={liveLoading} className="m3-button m3-button-small m3-state bg-indigo-700 text-white disabled:opacity-50 dark:bg-indigo-400 dark:text-slate-950">
            {liveLoading ? t("transit_supplement.loading_live") : t("transit_supplement.load_live", { station: stationLabel(t, origin, country) })}
          </button>
          <button type="button" onClick={() => void loadPlan()} disabled={planLoading} className="m3-button m3-button-small m3-state border border-indigo-300 text-indigo-900 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-100">
            {planLoading ? t("transit_supplement.planning") : t("transit_supplement.plan_trip")}
          </button>
        </div>
      </div>

      {live ? (
        <div className="m3-card m3-card-large border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="font-bold text-slate-900 dark:text-white">{t("transit_supplement.live_title")}</p>
          {statusKey[live.status] ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t(statusKey[live.status] as string)}</p> : null}
          <p className="m3-body-small mt-1 text-slate-500 dark:text-slate-400">{t("transit_supplement.retrieved", { time: formatTime(live.retrievedAt, t("transit_supplement.time_unavailable")) })}{live.freshness ? ` · ${t("transit_supplement.provider_updated", { time: formatTime(live.freshness, t("transit_supplement.time_unavailable")) })}` : ""}</p>
          <p className="m3-body-small mt-1 text-slate-500 dark:text-slate-400">{t("transit_supplement.local_timezone")}</p>
          {live.departures.length ? (
            <ul className="mt-3 space-y-2">
              {live.departures.map((departure, index) => (
                <li key={`${departure.time || "unknown"}-${index}`} className="m3-card flex items-center justify-between gap-3 bg-slate-50 px-3 py-2 dark:bg-slate-800">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{formatTime(departure.time, t("transit_supplement.time_unavailable"))}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-xs text-slate-700 dark:text-slate-200">{departure.route || t("transit_supplement.route_unavailable")}{departure.headsign ? ` → ${departure.headsign}` : ""}{departure.cancelled ? ` · ${t("transit_supplement.cancelled")}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {live.alerts.length ? (
            <ul className="mt-3 space-y-2">
              {live.alerts.map((alert, index) => <li key={`${alert.title}-${index}`} className="m3-card border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><strong>{alert.title}</strong>{alert.description ? ` — ${alert.description}` : ""}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      {plan ? (
        <div className="m3-card m3-card-large border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="font-bold text-slate-900 dark:text-white">{t("transit_supplement.plan_title")}</p>
          {plan.status !== "available" ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{plan.status === "empty_live_data" ? t("transit_supplement.plan_empty") : t("transit_supplement.plan_unavailable")}</p> : null}
          {plan.itineraries?.map((itinerary, index) => (
            <div key={index} className="m3-card mt-3 bg-slate-50 p-3 dark:bg-slate-800">
              <p className="font-bold text-slate-900 dark:text-white">{itinerary.durationMinutes ? t("transit_supplement.minutes", { count: itinerary.durationMinutes }) : t("transit_supplement.duration_unavailable")}{itinerary.fare ? ` · ${itinerary.fare}` : ""}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-200">
                {itinerary.legs.map((leg, legIndex) => <li key={legIndex}>{leg.mode || t("transit_supplement.travel")}{leg.route ? ` · ${leg.route}` : ""}{leg.durationMinutes ? ` · ${t("transit_supplement.minutes", { count: leg.durationMinutes })}` : ""}</li>)}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
