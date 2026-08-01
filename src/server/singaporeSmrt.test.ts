import { describe, expect, it, vi } from "vitest";
import { buildSingaporeSmrtAdvisory, fetchSingaporeSmrtStation } from "./singaporeSmrt";

const stationPayload = {
  results: [{
    name: "Woodlands",
    train_times: [{
      last_trains: "2308",
      first_trains: { weekday: "0527", sat: "0527", sun_public_holiday: "0543" },
      station_line: "North-South Line",
      description: "First/Last train service terminating at NS28 Marina South Pier",
    }],
  }],
};

describe("Singapore SMRT scheduled service-day source", () => {
  it("builds a direction-specific weekday advisory without generating departures", () => {
    const advisory = buildSingaporeSmrtAdvisory(stationPayload, "Woodlands", "Orchard", "2026-08-03", "22:30");
    expect(advisory).toMatchObject({
      coverage: "partial",
      firstDeparture: "05:27",
      lastDeparture: "23:08",
      serviceDayType: "weekday",
      minutesToLastDeparture: 38,
      source: "SMRT official station information API",
    });
  });

  it("does not claim SMRT coverage for an unsupported operator or transfer route", () => {
    expect(buildSingaporeSmrtAdvisory(stationPayload, "HarbourFront", "Punggol", "2026-08-03").coverage).toBe("unavailable");
    expect(buildSingaporeSmrtAdvisory(stationPayload, "Changi Airport", "Jurong East", "2026-08-03").coverage).toBe("unavailable");
  });

  it("fetches the official JSON with the website origin headers", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(stationPayload), { status: 200 }));
    await fetchSingaporeSmrtStation("woodlands", fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("station_info/?name=woodlands"),
      expect.objectContaining({ headers: expect.objectContaining({ Referer: "https://journey.smrt.com.sg/" }) }),
    );
  });
});
