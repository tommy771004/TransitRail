// Author: AI Coding Agent
// OS support: Linux, macOS, Windows
// Description: Shared fixtures for the catalog suites — the one service day every
// shipped Japanese source covers, so a date-conditioned catalog test has a real day
// to pin its clock to.

import { getScrapedRoutes } from "../data/scraped";

export function firstJapanSnapshotDate(): string {
  const bySource = new Map<string, Set<string>>();
  for (const route of getScrapedRoutes("japan")) {
    const source = route.sourceMeta?.sourceId || route.source;
    const dates = bySource.get(source) ?? new Set<string>();
    for (const row of route.results) if (row.date) dates.add(row.date);
    bySource.set(source, dates);
  }
  // Scrapers refresh independently. Exercise the hierarchy on a day shared
  // by every shipped Japanese source, not an old day kept by just one.
  const sources = [...bySource.values()];
  const common = [...(sources[0] ?? [])].filter((date) => sources.every((dates) => dates.has(date))).sort();
  if (!common[0]) throw new Error("Japanese sources have no common service day for catalog integration");
  return common[0];
}

// --- End of catalogTestSupport.ts ---
