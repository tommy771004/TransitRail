/**
 * Turn a market's official station directory into reviewable zh-TW / ja / ko
 * display labels.
 *
 * Every label this module emits is *sourced*, never transliterated by us. The
 * order below is fixed, and each emitted label records which step produced it
 * so a reviewer can check the claim:
 *
 *   1. the station's Wikipedia article title in that language;
 *   2. an operator-published label in that language (only where the operator
 *      actually publishes one — see the `official` field on {@link StationEntry});
 *   3. the Wikidata label in that language.
 *
 * A station that none of the three answers for gets **no entry**. The app then
 * displays the operator's own name, which is always a correct thing to show and
 * keeps the provider query identity visible. Inventing a transliteration — or
 * gluing "站" onto a Latin name — would be a fabricated translation, so this
 * module never does it.
 *
 * Chinese sources are Simplified far more often than not (zhwiki articles for
 * European stations, operator sites in mainland China). Anything Chinese is
 * therefore pushed through MediaWiki's own zh-tw variant conversion before it
 * is written, and the artifact records `converted: true` for those labels.
 *
 * Wikidata joins are exact wherever the directory carries an external ID: for
 * European rail that is the UIC station code (P722), which iRail, DB and SNCF
 * all embed in their station IDs. Name search is the fallback, and it only
 * accepts a candidate whose own English label matches the directory name after
 * normalisation — a near-miss is dropped rather than guessed at, because a
 * wrong match here renames a station in the UI.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getStaticMenuStations } from "../../src/data/stationIdentity";
import { japanRailLines } from "../../src/data/stations";
import { seoulSubwayLines } from "../../src/data/seoulSubway";
import { hongKongMtrLines } from "../../src/data/hongKongMtr";
import type { Country } from "../../src/types";

/** Locales the app ships station labels for. English is the source language. */
export const STATION_LOCALES = ["zh-TW", "ja", "ko"] as const;
export type StationLocale = (typeof STATION_LOCALES)[number];

export type LabelSourceKind = "wikipedia" | "official" | "wikidata";

export interface StationLabel {
  label: string;
  sourceKind: LabelSourceKind;
  /** First-party URL for the claim. A reviewer must be able to open this. */
  sourceUrl: string;
  /** Language of the source text *before* any script conversion. */
  sourceLocale: string;
  /** Set when Simplified source text was converted to Traditional for zh-TW. */
  converted?: boolean;
  wikidataId?: string;
  wikipediaTitle?: string;
}

export interface OfficialLabel {
  label: string;
  sourceUrl: string;
  /** e.g. "zh-hans" for an operator site published in Simplified Chinese. */
  sourceLocale: string;
}

export interface StationEntry {
  /** Provider query name. Must stay byte-identical to the directory. */
  name: string;
  /** UIC station code (Wikidata P722), when the directory carries one. */
  uic?: string;
  /** Pre-resolved Wikidata item, when the directory already knows it. */
  wikidataId?: string;
  /** Operator-published labels. Outranked only by a Wikipedia article title. */
  official?: Partial<Record<StationLocale, OfficialLabel>>;
}

export interface CountryDirectory {
  country: Country;
  /** URL or repo path the station names were read from. */
  directorySource: string;
  /** Wikidata QID of the country, used to reject cross-border name matches. */
  countryQid?: string;
  entries: StationEntry[];
}

export type StationLabels = Partial<Record<StationLocale, StationLabel>>;

/**
 * Line graphs whose stations the menu shows but {@link getStaticMenuStations}
 * does not union in — Tokyo's subway lines carry 121 stations that never appear
 * in the intercity list. Every other static market already unions its lines.
 */
const EXTRA_LINE_SETS: Partial<Record<Country, ReadonlyArray<{ stations: ReadonlyArray<{ name: string }> }>>> = {
  japan: japanRailLines,
  korea: seoulSubwayLines,
  hong_kong: hongKongMtrLines,
};

/**
 * Every station name a static market can put on screen. The sync and the audit
 * both call this so the set they reason about cannot drift apart — the same
 * rule {@link getStaticMenuStations} exists to enforce between menu and search.
 */
export function staticStationUniverse(country: Country): string[] {
  const names = new Set(getStaticMenuStations(country) || []);
  for (const line of EXTRA_LINE_SETS[country] || []) {
    for (const station of line.stations) names.add(station.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const ZH_WIKIPEDIA_API = "https://zh.wikipedia.org/w/api.php";
const USER_AGENT = "TransitRail/1.0 (station i18n; https://github.com/ transit-rail)";
const CACHE_DIR = resolve(".cache/station-i18n");
export const ARTIFACT_DIR = resolve("src/data/catalog/station-i18n");
export const RUNTIME_LABELS_FILE = resolve(ARTIFACT_DIR, "labels.json");

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

function cachePath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 180);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return resolve(CACHE_DIR, `${safe}_${(hash >>> 0).toString(36)}.json`);
}

/**
 * Wikimedia rate limits are shared across everyone and tighten without notice
 * (WDQS drops to one request per minute during an outage). Requests are
 * therefore serialised, spaced, retried with the server's own Retry-After, and
 * cached on disk so a re-run — or a second market that overlaps this one —
 * costs nothing.
 */
export class WikimediaClient {
  private next = Promise.resolve();
  private lastRequestAt = 0;

  constructor(private readonly minIntervalMs = 200, private readonly useCache = true) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  private schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.next.then(async () => {
      const wait = this.minIntervalMs - (Date.now() - this.lastRequestAt);
      if (wait > 0) await sleep(wait);
      try {
        return await task();
      } finally {
        this.lastRequestAt = Date.now();
      }
    });
    this.next = run.then(() => undefined, () => undefined);
    return run;
  }

  async getJson<T>(url: string, cacheKey = url): Promise<T> {
    const file = cachePath(cacheKey);
    if (this.useCache && existsSync(file)) {
      return JSON.parse(readFileSync(file, "utf8")) as T;
    }
    const payload = await this.schedule(() => this.request<T>(url));
    if (this.useCache) writeFileSync(file, JSON.stringify(payload), "utf8");
    return payload;
  }

  private async request<T>(url: string): Promise<T> {
    let backoff = 5_000;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      });
      if (response.ok) return (await response.json()) as T;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 5) {
        throw new Error(`${response.status} ${response.statusText} from ${url}`);
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
      console.warn(`  … ${response.status} from Wikimedia; waiting ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      backoff = Math.min(backoff * 2, 120_000);
    }
    throw new Error(`Request did not complete: ${url}`);
  }
}

export interface WikidataEntity {
  id: string;
  labels?: Record<string, { value?: string }>;
  aliases?: Record<string, Array<{ value?: string }>>;
  sitelinks?: Record<string, { title?: string }>;
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

const WIKI_SITES = ["zhwiki", "jawiki", "kowiki"] as const;
const WIKI_LANGUAGES = ["zh", "zh-hans", "zh-hant", "zh-tw", "zh-hk", "ja", "ko", "en"] as const;

/** Batch fetch of the label/sitelink/claim slice this module reasons about. */
export async function fetchEntities(
  client: WikimediaClient,
  ids: readonly string[],
): Promise<Map<string, WikidataEntity>> {
  const entities = new Map<string, WikidataEntity>();
  for (const batch of chunks([...new Set(ids)], 50)) {
    if (batch.length === 0) continue;
    const url = new URL(WIKIDATA_API);
    url.search = new URLSearchParams({
      action: "wbgetentities",
      format: "json",
      props: "labels|aliases|sitelinks|claims",
      languages: WIKI_LANGUAGES.join("|"),
      sitefilter: WIKI_SITES.join("|"),
      ids: batch.join("|"),
    }).toString();
    const payload = await client.getJson<{ entities?: Record<string, WikidataEntity> }>(url.toString());
    for (const entity of Object.values(payload.entities || {})) {
      if (entity.id) entities.set(entity.id, entity);
    }
  }
  return entities;
}

/**
 * Exact join on the UIC station code. One SPARQL round trip covers a few
 * hundred stations, which is the only way to stay inside WDQS' limits for a
 * 700-station directory.
 */
export async function resolveByUic(
  client: WikimediaClient,
  uicCodes: readonly string[],
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const codes = [...new Set(uicCodes.filter(Boolean))];
  for (const batch of chunks(codes, 150)) {
    // Both spellings: some items store the code with the leading country digits.
    const values = batch.flatMap((code) => [code, code.padStart(9, "0")])
      .map((code) => `"${code}"`)
      .join(" ");
    const query = `SELECT ?uic ?item WHERE { VALUES ?uic { ${values} } ?item wdt:P722 ?uic . }`;
    const url = `${WIKIDATA_SPARQL}?${new URLSearchParams({ query, format: "json" }).toString()}`;
    const payload = await client.getJson<{
      results?: { bindings?: Array<{ uic?: { value: string }; item?: { value: string } }> };
    }>(url, `sparql:uic:${batch.join(",")}`);
    for (const row of payload.results?.bindings || []) {
      const code = row.uic?.value?.replace(/^0+/, "");
      const qid = row.item?.value?.split("/").pop();
      if (code && qid && !resolved.has(code)) resolved.set(code, qid);
    }
  }
  return resolved;
}

const STATION_DESCRIPTION =
  /(?:railway|railroad|train|metro|subway|light rail|tram|underground|rapid transit)\s+(?:station|stop|halt)|station in |railway halt|gare (?:ferroviaire|de)|bahnhof|treinstation|spoorwegstation|estación|stazione|駅$|역$/i;

interface SearchResult {
  id: string;
  label?: string;
  description?: string;
  aliases?: string[];
  match?: { text?: string };
}

/** Punctuation, case and the word "station" are never identity-bearing here. */
export function normalizeStationName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:railway|train|metro|subway|underground|tube|dlr|rail)\b/g, " ")
    .replace(/\bstation\b/g, " ")
    .replace(/\bst\b/g, "saint")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Name search fallback. Returns candidate QIDs, most promising first; the
 * caller still has to confirm the match against the entity's own labels.
 */
export async function searchByName(client: WikimediaClient, name: string): Promise<string[]> {
  const seen: string[] = [];
  for (const term of [name, `${name} station`]) {
    const url = new URL(WIKIDATA_API);
    url.search = new URLSearchParams({
      action: "wbsearchentities",
      format: "json",
      type: "item",
      language: "en",
      uselang: "en",
      limit: "10",
      search: term,
    }).toString();
    const payload = await client.getJson<{ search?: SearchResult[] }>(url.toString());
    for (const result of payload.search || []) {
      const haystack = `${result.description || ""} ${result.label || ""} ${result.match?.text || ""}`;
      if (!STATION_DESCRIPTION.test(haystack)) continue;
      if (!seen.includes(result.id)) seen.push(result.id);
    }
    if (seen.length > 0) break;
  }
  return seen.slice(0, 5);
}

function claimValues(entity: WikidataEntity, property: string): string[] {
  return (entity.claims?.[property] || [])
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object" && "id" in value) return String((value as { id: unknown }).id);
      return "";
    })
    .filter(Boolean);
}

/**
 * Confirm a name-searched candidate really is this station: its English label
 * or one of its aliases has to match the directory name once "station" and
 * punctuation are normalised away, and — when the caller knows the country —
 * P17 has to agree. Anything less is dropped.
 */
export function isConfirmedMatch(entity: WikidataEntity, name: string, countryQid?: string): boolean {
  if (countryQid) {
    const countries = claimValues(entity, "P17");
    if (countries.length > 0 && !countries.includes(countryQid)) return false;
  }
  const target = normalizeStationName(name);
  if (!target) return false;
  const candidates = [
    entity.labels?.en?.value,
    ...(entity.aliases?.en || []).map((alias) => alias.value),
  ].filter((value): value is string => Boolean(value));
  return candidates.some((candidate) => normalizeStationName(candidate) === target);
}

/** Drop a Wikipedia title's disambiguator: "滑鐵盧站 (比利時)" → "滑鐵盧站". */
export function cleanWikipediaTitle(title: string): string {
  return title.replace(/\s*[（(][^()（）]*[)）]\s*$/u, "").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * Convert Simplified Chinese to Traditional through MediaWiki's own zh-tw
 * variant converter — the same table zh.wikipedia.org serves Taiwanese readers,
 * so an operator's Simplified name and a zhwiki title both come out in the
 * form the app's zh-TW users expect.
 *
 * The batch call is one request per 60 labels; if a batch comes back
 * misaligned (a label that happens to be wikitext-significant) each label in it
 * is converted on its own rather than risking a shifted mapping.
 */
export async function toTraditionalChinese(
  client: WikimediaClient,
  labels: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(labels.filter(Boolean))];
  const converted = new Map<string, string>();

  const convertBatch = async (batch: string[]): Promise<string[] | undefined> => {
    const url = new URL(ZH_WIKIPEDIA_API);
    url.search = new URLSearchParams({
      action: "parse",
      format: "json",
      contentmodel: "wikitext",
      prop: "text",
      disablelimitreport: "1",
      variant: "zh-tw",
      text: batch.join("\n\n"),
    }).toString();
    const payload = await client.getJson<{ parse?: { text?: { "*"?: string } } }>(url.toString());
    const lines = decodeHtml((payload.parse?.text?.["*"] || "").replace(/<[^>]*>/g, ""))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.length === batch.length ? lines : undefined;
  };

  for (const batch of chunks(unique, 60)) {
    const lines = await convertBatch(batch);
    if (lines) {
      batch.forEach((source, index) => converted.set(source, lines[index]));
      continue;
    }
    for (const single of batch) {
      const one = await convertBatch([single]);
      converted.set(single, one?.[0] || single);
    }
  }
  return converted;
}

const SITE_FOR_LOCALE: Record<StationLocale, string> = {
  "zh-TW": "zhwiki",
  ja: "jawiki",
  ko: "kowiki",
};

const WIKIPEDIA_HOST: Record<StationLocale, string> = {
  "zh-TW": "zh.wikipedia.org",
  ja: "ja.wikipedia.org",
  ko: "ko.wikipedia.org",
};

function wikidataLabelFor(entity: WikidataEntity, locale: StationLocale): { value: string; lang: string } | undefined {
  const order = locale === "zh-TW" ? ["zh-tw", "zh-hant", "zh-hk", "zh", "zh-hans"] : [locale];
  for (const lang of order) {
    const value = entity.labels?.[lang]?.value;
    if (value) return { value, lang };
  }
  return undefined;
}

function wikipediaUrl(locale: StationLocale, title: string): string {
  return `https://${WIKIPEDIA_HOST[locale]}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/**
 * Assemble one station's labels from its resolved Wikidata item plus whatever
 * the operator publishes. Chinese text is returned unconverted; the caller
 * converts in one batch and rewrites the labels.
 */
export function buildLabels(
  entry: StationEntry,
  entity: WikidataEntity | undefined,
  locales: readonly StationLocale[],
): StationLabels {
  const labels: StationLabels = {};
  for (const locale of locales) {
    const wikiTitle = entity?.sitelinks?.[SITE_FOR_LOCALE[locale]]?.title;
    if (wikiTitle) {
      labels[locale] = {
        label: cleanWikipediaTitle(wikiTitle),
        sourceKind: "wikipedia",
        sourceUrl: wikipediaUrl(locale, wikiTitle),
        sourceLocale: locale === "zh-TW" ? "zh" : locale,
        wikidataId: entity?.id,
        wikipediaTitle: wikiTitle,
      };
      continue;
    }
    const official = entry.official?.[locale];
    if (official) {
      labels[locale] = {
        label: official.label,
        sourceKind: "official",
        sourceUrl: official.sourceUrl,
        sourceLocale: official.sourceLocale,
      };
      continue;
    }
    const fromWikidata = entity ? wikidataLabelFor(entity, locale) : undefined;
    if (fromWikidata) {
      labels[locale] = {
        label: fromWikidata.value,
        sourceKind: "wikidata",
        sourceUrl: `https://www.wikidata.org/wiki/${entity!.id}`,
        sourceLocale: fromWikidata.lang,
        wikidataId: entity!.id,
      };
    }
  }
  return labels;
}

/** True when text still contains Simplified-only forms after sourcing. */
export function needsConversion(locale: StationLocale, sourceLocale: string): boolean {
  return locale === "zh-TW" && sourceLocale !== "zh-tw" && sourceLocale !== "zh-hant";
}

export interface CountryArtifact {
  country: Country;
  retrievedAt: string;
  directorySource: string;
  locales: StationLocale[];
  counts: Record<string, number>;
  /** Directory names with no sourced label in any locale. */
  unresolved: string[];
  stations: Record<string, StationLabels>;
}

export function artifactPath(country: Country): string {
  return resolve(ARTIFACT_DIR, `${country}.json`);
}

export function readArtifact(country: Country): CountryArtifact | undefined {
  const file = artifactPath(country);
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8")) as CountryArtifact;
}

export function writeArtifact(artifact: CountryArtifact): void {
  mkdirSync(dirname(artifactPath(artifact.country)), { recursive: true });
  writeFileSync(artifactPath(artifact.country), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

/**
 * Rebuild the compact file the app imports. Only the label survives here: the
 * provenance stays in the per-country artifact so the browser bundle carries
 * display strings and nothing else.
 */
export function rebuildRuntimeLabels(): { countries: number; labels: number } {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const files = readdirSync(ARTIFACT_DIR).filter((file) => file.endsWith(".json") && file !== "labels.json");
  const byCountry: Record<string, Partial<Record<StationLocale, Record<string, string>>>> = {};
  let labelCount = 0;
  for (const file of files.sort()) {
    const artifact = JSON.parse(readFileSync(resolve(ARTIFACT_DIR, file), "utf8")) as CountryArtifact;
    const perLocale: Partial<Record<StationLocale, Record<string, string>>> = {};
    for (const [name, labels] of Object.entries(artifact.stations)) {
      for (const locale of STATION_LOCALES) {
        const entry = labels[locale];
        if (!entry?.label || entry.label === name) continue;
        (perLocale[locale] ||= {})[name] = entry.label;
        labelCount += 1;
      }
    }
    for (const locale of STATION_LOCALES) {
      if (perLocale[locale]) perLocale[locale] = Object.fromEntries(Object.entries(perLocale[locale]!).sort());
    }
    if (Object.keys(perLocale).length > 0) byCountry[artifact.country] = perLocale;
  }
  writeFileSync(RUNTIME_LABELS_FILE, `${JSON.stringify(byCountry, null, 2)}\n`, "utf8");
  return { countries: Object.keys(byCountry).length, labels: labelCount };
}
