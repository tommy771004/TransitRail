import { useState } from "react";
import type { Country } from "../types";

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

const statusCopy: Record<LiveContext["status"], string> = {
  available: "",
  uncovered: "Transit does not currently confirm coverage for this station. This does not mean that service is unavailable.",
  unavailable: "Third-party live data is not configured right now.",
  ambiguous: "Transit coverage for this station could not be resolved safely.",
  empty_live_data: "Transit currently has no live departures or alerts to show. This is not a no-service notice.",
  error: "Third-party live data is temporarily unavailable.",
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

function formatTime(value?: string) {
  if (!value) return "Time unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** A separately attributed UI boundary; none of this data is a verified timetable. */
export function TransitAppSupplement({ country, origin, destination }: { country: Country; origin: string; destination: string }) {
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
    <aside className="mx-auto max-w-md space-y-3 px-4 pb-8" aria-label="Transit supplementary information">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm dark:border-indigo-900/70 dark:bg-indigo-950/20">
        <p className="font-bold text-indigo-950 dark:text-indigo-100">Third-party live data from Transit</p>
        <p className="mt-1 text-xs leading-relaxed text-indigo-800 dark:text-indigo-200">
          Live departures, alerts, and journey suggestions are supplementary. They never change TransitRail’s verified timetable.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadLive()} disabled={liveLoading} className="rounded-xl bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 dark:bg-indigo-400 dark:text-slate-950">
            {liveLoading ? "Loading live data…" : `Live data for ${origin}`}
          </button>
          <button type="button" onClick={() => void loadPlan()} disabled={planLoading} className="rounded-xl border border-indigo-300 px-3 py-2 text-xs font-bold text-indigo-900 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-100">
            {planLoading ? "Planning…" : "Plan complete trip with Transit"}
          </button>
        </div>
      </div>

      {live ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="font-bold text-slate-900 dark:text-white">Live information supplied by Transit</p>
          {statusCopy[live.status] ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{statusCopy[live.status]}</p> : null}
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Retrieved {formatTime(live.retrievedAt)}{live.freshness ? ` · Provider updated ${formatTime(live.freshness)}` : ""}</p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Departure times are shown in your local time zone.</p>
          {live.departures.length ? (
            <ul className="mt-3 space-y-2">
              {live.departures.map((departure, index) => (
                <li key={`${departure.time || "unknown"}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{formatTime(departure.time)}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-xs text-slate-700 dark:text-slate-200">{departure.route || "Route unavailable"}{departure.headsign ? ` → ${departure.headsign}` : ""}{departure.cancelled ? " · Cancelled" : ""}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {live.alerts.length ? (
            <ul className="mt-3 space-y-2">
              {live.alerts.map((alert, index) => <li key={`${alert.title}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><strong>{alert.title}</strong>{alert.description ? ` — ${alert.description}` : ""}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      {plan ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="font-bold text-slate-900 dark:text-white">Third-party journey suggestion from Transit</p>
          {plan.status !== "available" ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{plan.status === "empty_live_data" ? "Transit did not return a suggested journey. This does not mean there is no service." : "This journey suggestion is currently unavailable."}</p> : null}
          {plan.itineraries?.map((itinerary, index) => (
            <div key={index} className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <p className="font-bold text-slate-900 dark:text-white">{itinerary.durationMinutes ? `${itinerary.durationMinutes} min` : "Duration unavailable"}{itinerary.fare ? ` · ${itinerary.fare}` : ""}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-200">
                {itinerary.legs.map((leg, legIndex) => <li key={legIndex}>{leg.mode || "Travel"}{leg.route ? ` · ${leg.route}` : ""}{leg.durationMinutes ? ` · ${leg.durationMinutes} min` : ""}</li>)}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
