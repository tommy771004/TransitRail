/**
 * Build the zh-TW / ja / ko display labels for one market's station directory.
 *
 * The directory is always the market's own station list — the live provider
 * directory where the app uses one (iRail, TfL, MBTA), the static menu list
 * otherwise — so the keys written here are exactly the names the UI has to
 * label, and they stay byte-identical to the names search sends back to the
 * provider.
 *
 * Sourcing, conversion and the "no source, no label" rule all live in
 * scripts/lib/stationI18n.ts. This file only decides *which* stations to look
 * up, what external identifier can join them to Wikidata exactly, and which
 * operator-published names count as official for that market.
 *
 *   npx tsx scripts/sync-station-translations.ts belgium
 *   npx tsx scripts/sync-station-translations.ts korea --locales ja,ko
 *   npx tsx scripts/sync-station-translations.ts --all --limit 50
 *
 * Re-runs are cheap: every Wikimedia response is cached under .cache/.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configuredCountryOptions } from "../src/data/countries";
import { getTflStations } from "../src/server/tfl";
import { getMbtaStations } from "../src/server/mbta";
import type { Country } from "../src/types";
import {
  STATION_LOCALES,
  WikimediaClient,
  buildLabels,
  fetchEntities,
  isConfirmedMatch,
  needsConversion,
  rebuildRuntimeLabels,
  resolveByUic,
  searchByName,
  staticStationUniverse,
  toTraditionalChinese,
  writeArtifact,
  type CountryArtifact,
  type CountryDirectory,
  type StationEntry,
  type StationLabels,
  type StationLocale,
  type WikidataEntity,
} from "./lib/stationI18n";

/**
 * iRail's directory is the Belgian menu, and it is English-only for our
 * purposes: `lang` accepts nl/fr/de/en, and `lang=zh` silently returns the
 * English names. SNCB/NMBS publishes no Chinese, Japanese or Korean station
 * directory either, so Belgium has no `official` labels to offer and every
 * label for it comes from Wikipedia or Wikidata.
 */
const IRAIL_STATIONS_URL = "https://api.irail.be/stations/?format=json&lang=en";

/** Used to reject a name match that landed on a same-named station abroad. */
const COUNTRY_QID: Partial<Record<Country, string>> = {
  japan: "Q17",
  korea: "Q884",
  china: "Q148",
  singapore: "Q334",
  malaysia: "Q833",
  thailand: "Q869",
  hong_kong: "Q8646",
  united_kingdom: "Q145",
  united_states: "Q30",
  germany: "Q183",
  france: "Q142",
  norway: "Q20",
  switzerland: "Q39",
  // Belgium's directory is deliberately left unfiltered: iRail lists the
  // French, Dutch, German and British stations its international trains call
  // at, and a Q31 filter would drop every one of them.
};

/**
 * Seoul Metro publishes each station's Korean name in the same open dataset the
 * timetable adapter reads, so ko labels for Korea are operator-published rather
 * than sourced from an encyclopedia.
 */
const SEOUL_STATION_DATASET =
  "https://data.seoul.go.kr/dataList/OA-121/S/1/datasetView.do";

interface SeoulStationRecord {
  STATION_NM: string;
  STATION_NM_ENG: string;
}

function seoulOfficialKoreanNames(): Map<string, string> {
  const records = JSON.parse(
    readFileSync(resolve("src/data/seoulSubwayStations.json"), "utf8"),
  ) as SeoulStationRecord[];
  const byEnglish = new Map<string, string>();
  for (const record of records) {
    const english = record.STATION_NM_ENG?.trim();
    const korean = record.STATION_NM?.trim();
    if (english && korean && !byEnglish.has(english)) byEnglish.set(english, korean);
  }
  return byEnglish;
}

async function belgiumDirectory(): Promise<CountryDirectory> {
  const payload = (await (await fetch(IRAIL_STATIONS_URL, {
    headers: { Accept: "application/json", "User-Agent": "TransitRail/1.0 (station i18n)" },
  })).json()) as { station?: Array<{ id?: string; name?: string }> };
  const stations = payload.station || [];
  if (stations.length === 0) throw new Error("iRail returned no stations.");
  const entries: StationEntry[] = [];
  for (const station of stations) {
    const name = station.name?.trim();
    if (!name) continue;
    // "BE.NMBS.008892007" — the trailing digits are the UIC station code, which
    // is what Wikidata stores in P722 (without the leading zeros).
    const uic = /(\d{5,})$/.exec(station.id || "")?.[1]?.replace(/^0+/, "");
    entries.push({ name, ...(uic ? { uic } : {}) });
  }
  return { country: "belgium", directorySource: IRAIL_STATIONS_URL, entries };
}

async function directoryFor(country: Country): Promise<CountryDirectory> {
  if (country === "belgium") return belgiumDirectory();

  if (country === "united_kingdom") {
    const names = await getTflStations();
    return {
      country,
      directorySource: "https://api.tfl.gov.uk/StopPoint/Mode/tube,dlr,overground,elizabeth-line",
      countryQid: COUNTRY_QID[country],
      entries: names.map((name) => ({ name })),
    };
  }

  if (country === "united_states") {
    const names = await getMbtaStations();
    return {
      country,
      directorySource: "https://api-v3.mbta.com/stops",
      countryQid: COUNTRY_QID[country],
      entries: names.map((name) => ({ name })),
    };
  }

  const names = staticStationUniverse(country);
  if (names.length === 0) {
    throw new Error(`No station directory available for ${country}.`);
  }
  const official = country === "korea" ? seoulOfficialKoreanNames() : undefined;
  return {
    country,
    directorySource: `src/data/stationIdentity.ts + line graphs (${country} menu directory)`,
    countryQid: COUNTRY_QID[country],
    entries: names.map((name) => {
      const koreanName = official?.get(name);
      return {
        name,
        ...(koreanName
          ? {
              official: {
                ko: { label: koreanName, sourceUrl: SEOUL_STATION_DATASET, sourceLocale: "ko" },
              },
            }
          : {}),
      } satisfies StationEntry;
    }),
  };
}

/**
 * Resolve every directory entry to a Wikidata item: exactly by UIC code where
 * the directory carries one, otherwise by name search confirmed against the
 * candidate's own English label and country.
 */
async function resolveEntities(
  client: WikimediaClient,
  directory: CountryDirectory,
): Promise<Map<string, WikidataEntity>> {
  const byName = new Map<string, WikidataEntity>();
  const uicEntries = directory.entries.filter((entry) => entry.uic);
  if (uicEntries.length > 0) {
    console.log(`  joining ${uicEntries.length} stations on their UIC code…`);
    const byUic = await resolveByUic(client, uicEntries.map((entry) => entry.uic!));
    const ids = [...new Set([...byUic.values()])];
    const entities = await fetchEntities(client, ids);
    for (const entry of uicEntries) {
      const qid = byUic.get(entry.uic!);
      const entity = qid ? entities.get(qid) : undefined;
      if (entity) byName.set(entry.name, entity);
    }
    console.log(`  ${byName.size}/${uicEntries.length} matched an item by UIC code.`);
  }

  const remaining = directory.entries.filter((entry) => !byName.has(entry.name));
  if (remaining.length === 0) return byName;

  console.log(`  searching Wikidata by name for ${remaining.length} stations…`);
  const candidatesByName = new Map<string, string[]>();
  let searched = 0;
  for (const entry of remaining) {
    if (entry.wikidataId) {
      candidatesByName.set(entry.name, [entry.wikidataId]);
    } else {
      candidatesByName.set(entry.name, await searchByName(client, entry.name));
    }
    searched += 1;
    if (searched % 100 === 0) console.log(`    ${searched}/${remaining.length}`);
  }
  const entities = await fetchEntities(
    client,
    [...candidatesByName.values()].flat(),
  );
  let confirmed = 0;
  for (const entry of remaining) {
    for (const qid of candidatesByName.get(entry.name) || []) {
      const entity = entities.get(qid);
      if (!entity) continue;
      if (!isConfirmedMatch(entity, entry.name, directory.countryQid)) continue;
      byName.set(entry.name, entity);
      confirmed += 1;
      break;
    }
  }
  console.log(`  ${confirmed}/${remaining.length} confirmed by name.`);
  return byName;
}

async function syncCountry(
  client: WikimediaClient,
  country: Country,
  locales: readonly StationLocale[],
  limit?: number,
): Promise<void> {
  console.log(`\n${country}`);
  const directory = await directoryFor(country);
  if (limit) directory.entries = directory.entries.slice(0, limit);
  console.log(`  ${directory.entries.length} directory names from ${directory.directorySource}`);

  const entities = await resolveEntities(client, directory);

  const stations: Record<string, StationLabels> = {};
  for (const entry of directory.entries) {
    const labels = buildLabels(entry, entities.get(entry.name), locales);
    if (Object.keys(labels).length > 0) stations[entry.name] = labels;
  }

  // One conversion pass for every Chinese string that is not already
  // Traditional, whether it came from zhwiki or from an operator's Simplified
  // site. The label written to disk is the converted one; `converted` records
  // that the source text read differently.
  const pending = Object.values(stations)
    .map((labels) => labels["zh-TW"])
    .filter((label): label is NonNullable<typeof label> => Boolean(label) && needsConversion("zh-TW", label!.sourceLocale))
    .map((label) => label.label);
  if (pending.length > 0) {
    console.log(`  converting ${new Set(pending).size} Chinese labels to zh-TW…`);
    const converted = await toTraditionalChinese(client, pending);
    for (const labels of Object.values(stations)) {
      const zh = labels["zh-TW"];
      if (!zh || !needsConversion("zh-TW", zh.sourceLocale)) continue;
      const traditional = converted.get(zh.label);
      if (traditional && traditional !== zh.label) {
        zh.label = traditional;
        zh.converted = true;
      }
    }
  }

  const counts: Record<string, number> = {};
  for (const locale of locales) {
    for (const kind of ["wikipedia", "official", "wikidata"] as const) {
      counts[`${locale}:${kind}`] = 0;
    }
  }
  for (const labels of Object.values(stations)) {
    for (const locale of locales) {
      const label = labels[locale];
      if (label) counts[`${locale}:${label.sourceKind}`] += 1;
    }
  }
  const unresolved = directory.entries
    .map((entry) => entry.name)
    .filter((name) => !stations[name] || Object.keys(stations[name]).length === 0);

  const artifact: CountryArtifact = {
    country,
    retrievedAt: new Date().toISOString(),
    directorySource: directory.directorySource,
    locales: [...locales],
    counts,
    unresolved,
    stations: Object.fromEntries(Object.entries(stations).sort(([a], [b]) => a.localeCompare(b))),
  };
  writeArtifact(artifact);

  for (const locale of locales) {
    const found = directory.entries.filter((entry) => stations[entry.name]?.[locale]).length;
    console.log(`  ${locale}: ${found}/${directory.entries.length} labelled`);
  }
  if (unresolved.length > 0) {
    console.log(`  ${unresolved.length} names keep the operator's own spelling (no source found).`);
  }
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let locales: StationLocale[] = [...STATION_LOCALES];
  let limit: number | undefined;
  let all = false;
  let cache = true;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") all = true;
    else if (arg === "--no-cache") cache = false;
    else if (arg === "--limit") limit = Number(argv[++i]);
    else if (arg === "--locales") {
      locales = argv[++i].split(",").map((value) => value.trim()) as StationLocale[];
    } else positional.push(arg);
  }
  const unknown = locales.filter((locale) => !STATION_LOCALES.includes(locale));
  if (unknown.length > 0) throw new Error(`Unknown locale(s): ${unknown.join(", ")}`);
  return { countries: positional as Country[], locales, limit, all, cache };
}

async function main() {
  const { countries, locales, limit, all, cache } = parseArgs(process.argv.slice(2));
  const targets = all ? [...configuredCountryOptions] : countries;
  if (targets.length === 0) {
    throw new Error("Usage: tsx scripts/sync-station-translations.ts <country…> | --all");
  }
  const unknown = targets.filter((country) => !configuredCountryOptions.includes(country));
  if (unknown.length > 0) throw new Error(`Unknown country: ${unknown.join(", ")}`);

  const client = new WikimediaClient(200, cache);
  const failures: string[] = [];
  for (const country of targets) {
    try {
      await syncCountry(client, country, locales, limit);
    } catch (error) {
      // One market's directory being down must not discard the markets that
      // already succeeded; their artifacts are written per country.
      failures.push(`${country}: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`  ✗ ${country}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const summary = rebuildRuntimeLabels();
  console.log(`\nRuntime labels: ${summary.labels} across ${summary.countries} markets.`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} market(s) failed:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
