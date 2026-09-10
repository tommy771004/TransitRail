import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTransitSearch } from "./transitSearch";
import { findInRoutes, getScrapedCoverageNames, getScrapedRoutes } from "../data/scraped";
import { getLinesForCountry } from "./catalog";

const DATE = "2026-08-01";

/**
 * Two searchable Japanese stations that no committed route or chain links.
 *
 * Named stations used to stand in for this — Asakusa to Roppongi — but which
 * pairs are unlinked moves with the data, and with `ODPT_API_KEY`: the nightly
 * job passes that secret, and the first scrape that ran with it linked the pair
 * through a Tokyo Metro line, turning this case into a failure with nothing
 * actually wrong.
 */
function unlinkedCoveredPair(): [string, string] | undefined {
  const routes = [...getScrapedRoutes("japan")];
  const covered = getScrapedCoverageNames("japan", DATE);
  for (const origin of covered) {
    for (const destination of covered) {
      if (origin === destination) continue;
      if (!findInRoutes(routes, origin, destination, DATE, "japan")?.length) return [origin, destination];
    }
  }
  return undefined;
}

// These cases assert which reason a rejected date gets, so the date's position
// relative to today is the whole point. Pin the clock or the reasons drift as
// the calendar moves.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-08-01T04:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("search no-result reasons", { timeout: 20_000 }, () => {
  it("distinguishes a covered-but-unsupported station pair", async () => {
    const pair = unlinkedCoveredPair();
    // Every shipped pair being linked is a healthy state, not a failure; there
    // is simply nothing for this rule to judge.
    if (!pair) return;
    const [origin, destination] = pair;

    const result = await runTransitSearch({ country: "japan", origin, destination, date: DATE });

    expect(result.statusCode).toBe(404);
    expect(result.payload.noResultReason, `${origin} → ${destination}`).toBe("unsupported_route");
  });

  it("calls a station search cannot answer for uncovered, not merely unsupported", async () => {
    // A station is uncovered when no committed row can act as an endpoint for
    // it, however completely a line map draws it. Which stations those are moves
    // with the data — it was Akebonobashi before the Toei lines carried per-stop
    // times, then the Tokyo Metro ones while ODPT_API_KEY was unset — so take
    // one from the map rather than naming it.
    const covered = getScrapedCoverageNames("japan", DATE);
    const lines = await getLinesForCountry("japan", DATE);
    const mapped = [...new Set(lines.flatMap((line) => line.stations.map((station) => station.name)))];
    const uncovered = mapped.find((station) => !covered.includes(station));
    // Nothing drawn beyond what search can answer is the healthy state.
    if (!uncovered || !covered[0]) return;

    const result = await runTransitSearch({
      country: "japan",
      origin: uncovered,
      destination: covered[0],
      date: DATE,
    });

    expect(result.statusCode).toBe(404);
    expect(result.payload.noResultReason, uncovered).toBe("no_verified_data");
    expect(result.payload.coverageGap?.uncovered).toEqual([uncovered]);
    expect(result.payload.coverageGap?.suggestions).not.toContain(uncovered);
  });

  it("reports a future date outside a live source's today-only contract", async () => {
    // Hong Kong's feed answers only the current service day, so the message
    // must name that rule rather than a published date range.
    const result = await runTransitSearch({
      country: "hong_kong",
      origin: "Central",
      destination: "Tsuen Wan",
      date: "2099-01-01",
    });

    expect(result.statusCode).toBe(422);
    expect(result.payload.noResultReason).toBe("future_date_unavailable");
    expect(result.payload.message).toContain("current local service day");
  });

  it("reports a future date outside a scheduled source's published range", async () => {
    // London is live at request time but not today-only: its planner answers
    // future dates, so past the published window the range is the reason.
    const result = await runTransitSearch({
      country: "united_kingdom",
      origin: "Green Park",
      destination: "Oxford Circus",
      date: "2099-01-01",
    });

    expect(result.statusCode).toBe(422);
    expect(result.payload.noResultReason).toBe("future_date_unavailable");
    expect(result.payload.message).toContain("service-date range");
  });

  it("reports an uncovered Malaysia station pair without claiming a timetable", async () => {
    const result = await runTransitSearch({
      country: "malaysia",
      origin: "KL Sentral",
      destination: "KLCC",
      date: "2026-08-01",
    });

    expect(result.statusCode).toBe(404);
    expect(result.payload.noResultReason).toBe("no_verified_data");
    expect(result.payload.officialSourceUrl).toBe("https://api.data.gov.my/gtfs-static/ktmb");
  });

  it("reports an otherwise covered route with no service on the selected day", async () => {
    const result = await runTransitSearch({
      country: "japan",
      origin: "Tokyo",
      destination: "Kyoto",
      // A day before the committed rolling scrape window. Keeping this inside
      // the product's non-enforced Japan date range exercises the "no service
      // on this day" outcome instead of the separate future-date guard.
      date: "2026-08-01",
    });

    expect(result.statusCode).toBe(404);
    expect(result.payload.noResultReason).toBe("no_service");
  });
});
