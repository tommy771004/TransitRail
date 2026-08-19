import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTransitSearch } from "./transitSearch";

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

describe("search no-result reasons", () => {
  it("distinguishes a covered-but-unsupported station pair", async () => {
    // Both endpoints are searchable — Asakusa on the Toei Asakusa Line pair,
    // Roppongi on the Oedo one — but no committed route or chain links them.
    const result = await runTransitSearch({
      country: "japan",
      origin: "Asakusa",
      destination: "Roppongi",
      date: "2026-08-01",
    });

    expect(result.statusCode).toBe(404);
    expect(result.payload.noResultReason).toBe("unsupported_route");
  });

  it("calls a station search cannot answer for uncovered, not merely unsupported", async () => {
    // Akebonobashi is only ever an intermediate stop in the ODPT rows, which
    // carry no per-leg times, so no pair through it can be answered. It used to
    // count as covered and the pair came back "unsupported_route" — the station
    // browser then suggested it as a place to search from.
    const result = await runTransitSearch({
      country: "japan",
      origin: "Akebonobashi",
      destination: "Asakusa",
      date: "2026-08-01",
    });

    expect(result.statusCode).toBe(404);
    expect(result.payload.noResultReason).toBe("no_verified_data");
    expect(result.payload.coverageGap?.uncovered).toEqual(["Akebonobashi"]);
    expect(result.payload.coverageGap?.suggestions).not.toContain("Akebonobashi");
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
