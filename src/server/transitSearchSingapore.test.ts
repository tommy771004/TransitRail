import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { serviceDayArtifactFixture } from "./serviceDayArtifactFixture";
import { collectSingaporeServiceDayArtifact, resetSingaporeSmrtCache } from "./singaporeSmrt";
import { runTransitSearch } from "./transitSearch";

const artifact = serviceDayArtifactFixture(new URL("../data/service-day/singapore.json", import.meta.url));
const payload = {
  results: [{ name: "Woodlands", train_times: [{
    last_trains: "2308",
    first_trains: { weekday: "0527", sat: "0527", sun_public_holiday: "0543" },
    station_line: "North-South Line",
    description: "First/Last train service terminating at NS28 Marina South Pier",
  }] }],
};

describe("Singapore scheduled SMRT advisory integration", () => {
  beforeAll(() => artifact.stash());
  afterAll(() => artifact.restore());
  afterEach(() => { artifact.clear(); resetSingaporeSmrtCache(); vi.unstubAllGlobals(); });

  it("serves the scheduled artifact without fetching SMRT during traveler search", async () => {
    await collectSingaporeServiceDayArtifact([{ origin: "Woodlands", destination: "Orchard" }], "2026-08-03",
      async () => new Response(JSON.stringify(payload), { status: 200 }));
    const searchFetch = vi.fn(async () => { throw new Error("search must remain offline"); });
    vi.stubGlobal("fetch", searchFetch);

    const result = await runTransitSearch({
      country: "singapore", origin: "Woodlands", destination: "Orchard", date: "2026-08-03", time: "22:30",
    });

    expect(result.payload.serviceDayAdvisory).toEqual(expect.objectContaining({
      coverage: "partial", firstDeparture: "05:27", lastDeparture: "23:08", minutesToLastDeparture: 38,
    }));
    expect(searchFetch).not.toHaveBeenCalled();
  });
});
