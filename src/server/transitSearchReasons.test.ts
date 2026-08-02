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
    const result = await runTransitSearch({
      country: "japan",
      origin: "Akebonobashi",
      destination: "Asakusa",
      date: "2026-08-01",
    });

    expect(result.statusCode).toBe(404);
    expect(result.payload.noResultReason).toBe("unsupported_route");
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

  it("reports a country with no verified timetable data", async () => {
    const result = await runTransitSearch({
      country: "malaysia",
      origin: "KL Sentral",
      destination: "KLCC",
      date: "2026-08-01",
    });

    expect(result.statusCode).toBe(422);
    expect(result.payload.noResultReason).toBe("no_verified_data");
    expect(result.payload.officialSourceUrl).toContain("data.gov.my");
  });

  it("reports an otherwise covered route with no service on the selected day", async () => {
    const result = await runTransitSearch({
      country: "japan",
      origin: "Tokyo",
      destination: "Kyoto",
      date: "2026-08-14",
    });

    expect(result.statusCode).toBe(404);
    expect(result.payload.noResultReason).toBe("no_service");
  });
});
