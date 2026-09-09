// Regression: ISSUE-002 — the UK service-day advisory reported first == last ==
// the sampled time and `risk: "critical"` at every hour of the day, because it
// read `adjustment=TripFirst`/`TripLast` on the journey planner as service-day
// bounds. TfL ignores that parameter, so both "bounds" were the trips around the
// requested time. Bounds now come from the line's published timetable.
// Found by /qa on 2026-09-09
// Report: .gstack/qa-reports/qa-report-localhost-2026-09-09.md

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchTflJourney, resetTflStationResolutionCache } from "./tfl";

const WEEKDAY = "2026-09-09";
const SUNDAY = "2026-09-13";

/** Bakerloo, Baker Street to Oxford Circus, as TfL actually publishes it. */
const SCHEDULES = [
  { name: "Monday - Friday", first: { hour: "5", minute: "50" }, last: { hour: "24", minute: "27" } },
  { name: "Sunday", first: { hour: "7", minute: "26" }, last: { hour: "23", minute: "46" } },
];

function installTfl(onTimetable?: () => Response) {
  const timetableCalls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));

    if (url.pathname.startsWith("/StopPoint/Search/")) {
      const query = decodeURIComponent(url.pathname.split("/").pop() || "");
      return new Response(JSON.stringify({
        matches: [{ id: query.includes("Baker") ? "940GZZLUBST" : "940GZZLUOXC", name: query }],
      }), { status: 200 });
    }

    if (url.pathname.includes("/Timetable/")) {
      timetableCalls.push(url.pathname);
      if (onTimetable) return onTimetable();
      return new Response(JSON.stringify({
        timetable: {
          routes: [{
            schedules: SCHEDULES.map((schedule) => ({
              name: schedule.name,
              knownJourneys: [schedule.first, schedule.last],
            })),
          }],
        },
      }), { status: 200 });
    }

    if (url.pathname.startsWith("/Journey/JourneyResults/")) {
      // The planner must never be asked for bounds: TfL ignores `adjustment`.
      expect(url.searchParams.get("adjustment")).toBeNull();
      const time = url.searchParams.get("time") || "1200";
      const start = `${WEEKDAY}T${time.slice(0, 2)}:${time.slice(2)}:00`;
      return new Response(JSON.stringify({
        journeys: [{
          startDateTime: start,
          arrivalDateTime: start,
          duration: 4,
          legs: [{
            departureTime: start,
            arrivalTime: start,
            duration: 4,
            mode: { name: "Tube" },
            departurePoint: { commonName: "Baker Street" },
            arrivalPoint: { commonName: "Oxford Circus" },
            routeOptions: [{ lineIdentifier: { id: "bakerloo", name: "Bakerloo" } }],
          }],
        }],
      }), { status: 200 });
    }

    throw new Error(`Unexpected TfL request: ${url}`);
  }));
  return timetableCalls;
}

beforeEach(() => { resetTflStationResolutionCache(); });
afterEach(() => { vi.unstubAllGlobals(); });

const search = (date: string, time: string) =>
  searchTflJourney("Baker Street Underground Station", "Oxford Circus Underground Station", date, time);

describe("TfL service-day bounds", () => {
  it.each(["06:00", "09:30", "14:00", "20:00"])("does not call %s the last departure", async (time) => {
    installTfl();
    const { body } = await search(WEEKDAY, time);
    // The exact defect: bounds that tracked the query instead of the service day.
    expect(body.serviceDayAdvisory?.firstDeparture).toBe("05:50");
    expect(body.serviceDayAdvisory?.lastDeparture).toBe("00:27");
    expect(body.serviceDayAdvisory?.firstDeparture).not.toBe(time);
    expect(body.serviceDayAdvisory?.risk).toBe("safe");
  });

  it("carries a post-midnight last departure onto the next calendar day", async () => {
    installTfl();
    const { body } = await search(WEEKDAY, "14:00");
    // 24:27 is 00:27 tomorrow — 627 minutes after 14:00, not 813 minutes before it.
    expect(body.serviceDayAdvisory?.minutesToLastDeparture).toBe(627);
  });

  it("warns only when the last departure really is close", async () => {
    installTfl();
    const { body } = await search(WEEKDAY, "23:30");
    expect(body.serviceDayAdvisory?.risk).toBe("approaching");
    expect(body.serviceDayAdvisory?.minutesToLastDeparture).toBe(57);
  });

  it("reads the schedule that matches the day, not the first one published", async () => {
    installTfl();
    const { body } = await search(SUNDAY, "14:00");
    expect(body.serviceDayAdvisory?.serviceDayType).toBe("sunday_holiday");
    expect(body.serviceDayAdvisory?.firstDeparture).toBe("07:26");
    expect(body.serviceDayAdvisory?.lastDeparture).toBe("23:46");
  });

  it("asks the line timetable once, and never the journey planner, for bounds", async () => {
    const calls = installTfl();
    await search(WEEKDAY, "14:00");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/Line/bakerloo/Timetable/");
  });

  it("reports the bounds as unavailable rather than guessing when TfL fails", async () => {
    // A date no other case here has fetched, so nothing is cached to fall back on.
    installTfl(() => new Response(JSON.stringify({ error: "down" }), { status: 503 }));
    const { body } = await search("2026-09-10", "14:00");
    expect(body.serviceDayAdvisory?.coverage).toBe("unavailable");
    expect(body.serviceDayAdvisory?.risk).toBe("unavailable");
    expect(body.serviceDayAdvisory?.lastDeparture).toBeUndefined();
    // Still a usable answer: the journey itself survives a bounds outage.
    expect(body.results.length).toBeGreaterThan(0);
  });

  it("shows the last known bounds, marked stale, when a later fetch fails", async () => {
    installTfl();
    await search("2026-09-11", "14:00");

    installTfl(() => new Response(JSON.stringify({ error: "down" }), { status: 503 }));
    const { body } = await search("2026-09-11", "14:00");
    expect(body.serviceDayAdvisory?.coverage).toBe("stale");
    expect(body.serviceDayAdvisory?.lastDeparture).toBe("00:27");
  });
});
