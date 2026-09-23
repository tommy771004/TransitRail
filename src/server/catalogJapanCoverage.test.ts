import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLinesForCountry, getStationsForCountry } from "./catalog";
import { getScrapedCoverageNames, getScrapedRoutes } from "../data/scraped";
import { findInRoutes } from "../data/scraped/timetableDay";
import { firstJapanSnapshotDate } from "./catalogTestSupport";

// This suite lives apart from catalog.test.ts because it is the single
// heaviest check in the repository: with the rest of the catalog integrity
// suite in one worker the file ran past a minute, and the worker stopped
// reaching the runner in time.
let catalogDate = "2026-08-01";

beforeEach(() => {
  catalogDate = firstJapanSnapshotDate();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${catalogDate}T04:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Japanese catalog coverage", () => {
  it("offers only Japanese stations a search can answer, in the menu and on the map", async () => {
    // Every name the browse map and the "covered stations" hint publish has to
    // be usable as an endpoint. The hint used to be built from each train's
    // calling pattern, so it advertised Akebonobashi, Asakusabashi and nine
    // more stops the matcher never reads, and the map still listed all 132
    // Tokyo stations — Nishi-magome → Oshiage was pickable and then answered
    // "no timetable for this station".
    //
    // Both halves moved once the Toei lines were scraped terminal to terminal
    // with each train's own per-stop times: those stops are now genuinely
    // answerable, so they belong in the hint. The rule is unchanged — publish a
    // name only if a search through it returns departures — and the stations
    // still failing it are the ones with no committed run at all: the Tokyo
    // Metro lines, which need ODPT_API_KEY, and the Shinkansen stations no
    // scraped pair reaches.
    const routes = [...getScrapedRoutes("japan")];
    const suggestions = getScrapedCoverageNames("japan", catalogDate);
    // Ask each name against the routes that actually list it, rather than
    // against all 105 other names: same assertion, one search per station
    // instead of a full cross product.
    const partnersFor = (station: string) => routes
      .filter((route) => route.results.some((result) => result.stops?.includes(station)))
      .flatMap((route) => [route.origin, route.destination])
      .filter((partner) => partner !== station);
    // One search per station is CPU-bound for tens of seconds; yield to the
    // event loop every few names so the worker keeps answering the runner
    // (a fully blocked worker times out its own reports back to Vitest).
    // Search answers a row only in the direction it runs, so a terminus served
    // one way (Kyoto, until Kyoto → Tokyo is scraped) is answerable as a
    // destination and not as an origin. Both are a search through it; the
    // destination map, not this list, says where an origin leads.
    const searchable = (from: string, to: string) => Boolean(findInRoutes(routes, from, to, catalogDate, "japan")?.length);
    const answerable: string[] = [];
    for (const [index, station] of suggestions.entries()) {
      if (index % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      const others = [...partnersFor(station), ...suggestions].filter((other) => other !== station);
      const found = others.some((other) => searchable(station, other))
        || others.some((other) => searchable(other, station));
      if (found) answerable.push(station);
    }
    expect(suggestions).toEqual(answerable);

    const lines = await getLinesForCountry("japan", catalogDate);
    const mapped = new Set(lines.flatMap((line) => line.stations.map((station) => station.name)));
    expect([...mapped].filter((station) => !suggestions.includes(station))).toEqual([]);
    // The station the report opened on: on the map, and answerable.
    expect(mapped.has("Nishi-magome")).toBe(true);
    expect(findInRoutes(routes, "Nishi-magome", "Oshiage", catalogDate, "japan")?.length).toBeGreaterThan(0);

    const menu = await getStationsForCountry("japan", undefined, catalogDate);
    expect(menu.stations).toEqual(expect.arrayContaining(["Asakusa", "Jimbocho", "Shin-Osaka", "Akebonobashi"]));
    // Whatever a line map draws, the menu offers only what a search can answer.
    // Named stations used to stand in for this rule — Shibuya for a Tokyo Metro
    // line with no committed run, Himeji for a Shinkansen stop none reaches —
    // but which stations those are moves with the data and with ODPT_API_KEY.
    expect(menu.stations.filter((station) => !suggestions.includes(station))).toEqual([]);
  // One search per published name over the whole Tokyo snapshot set takes
  // about 20 s on a shared runner; the bound is the work, not a hang.
  }, 60_000);
});
