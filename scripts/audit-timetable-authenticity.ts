/** Print the shared authenticity classification for every committed route/date slice. */
import { existsSync, readFileSync } from "node:fs";
import { configuredCountryOptions } from "../src/data/countries";
import { getScrapedRoutes } from "../src/data/scraped";
import {
  authenticityOptionsFor,
  classifyTimetable,
  type TimetableSnapshot,
} from "../src/data/timetableAuthenticity";
import { decodeKoreanSubwayArtifact } from "../src/data/koreanSubwayArtifact";
import { SEOUL_SUBWAY_ARTIFACT_PATH } from "../src/server/seoulSubwayCsv";

for (const country of configuredCountryOptions) {
  if (country === "malaysia") continue;
  const routes = getScrapedRoutes(country);
  const options = authenticityOptionsFor(country);
  for (const route of routes) {
    const dates = [...new Set(route.results.map((result) => result.date).filter(Boolean))].sort();
    const routeDates = dates.length > 0 ? dates : [undefined];
    for (const date of routeDates) {
      const authenticity = classifyTimetable(route, date, options);
      console.log([
        country,
        `${route.origin} → ${route.destination}`,
        date || "(no date)",
        authenticity,
      ].join("\t"));
    }
  }
}

if (existsSync(SEOUL_SUBWAY_ARTIFACT_PATH)) {
  try {
    const artifact = decodeKoreanSubwayArtifact(readFileSync(SEOUL_SUBWAY_ARTIFACT_PATH));
    const snapshot: TimetableSnapshot = {
      origin: "Seoul Metro artifact",
      destination: "Seoul Metro artifact",
      source: artifact.source,
      results: [{
        id: `korea-artifact-${artifact.sourceSha256}`,
        country: "korea",
        operator: "Seoul Metro",
        service: "Lines 1–9",
        departureTime: "00:00",
        origin: "Seoul Metro artifact",
        destination: "Seoul Metro artifact",
        direct: true,
        stops: [],
      }],
    };
    console.log(["korea", "Seoul Metro official timetable artifact", "(service-day artifact)", classifyTimetable(snapshot)].join("\t"));
  } catch (error) {
    console.error(`[authenticity] Seoul artifact unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
}
