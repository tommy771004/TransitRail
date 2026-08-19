/**
 * Snapshot Singapore's official MRT/LRT line directory and Wikipedia
 * language links into src/data/catalog/singapore.json.
 *
 * This is an intentional, reviewable update step. Runtime code reads the
 * checked-in JSON; it never calls mytransport.sg or Wikipedia while a user is
 * opening the station picker.
 *
 * Run: npm run sync:singapore-stations
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OFFICIAL_STATION_XML = "https://www.mytransport.sg/map/mrt/index.xml";
const OFFICIAL_MAP_URL = "https://www.mytransport.sg/trainstatus";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIPEDIA_ZH_API = "https://zh.wikipedia.org/w/api.php";
const OUTPUT_PATH = resolve("src/data/catalog/singapore.json");
/**
 * The slice the browser needs. The full directory keeps a per-station record
 * with its official URL and Wikipedia provenance, which is worth committing
 * but is dead weight in a mobile bundle — and Vite stringifies any JSON over
 * 10KB, so an unused key cannot be tree-shaken away. Both files are written in
 * the same pass, so they cannot drift.
 */
const MENU_OUTPUT_PATH = resolve("src/data/catalog/singapore-menu.json");
const USER_AGENT = "TransitRail/1.0 (Singapore station catalog)";
const sleep = (milliseconds: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const lineMeta: Record<string, { id: string; name: string; color: string }> = {
  EWL: { id: "sg-ewl", name: "East West Line", color: "#009645" },
  NSL: { id: "sg-nsl", name: "North South Line", color: "#D42E12" },
  NEL: { id: "sg-nel", name: "North East Line", color: "#9900AA" },
  CCL: { id: "sg-ccl", name: "Circle Line", color: "#FA9E0D" },
  DTL: { id: "sg-dtl", name: "Downtown Line", color: "#005EC4" },
  TEL: { id: "sg-tel", name: "Thomson–East Coast Line", color: "#9D5B25" },
  BPL: { id: "sg-bpl", name: "Bukit Panjang LRT", color: "#748477" },
  STL: { id: "sg-stl", name: "Sengkang LRT", color: "#748477" },
  PTL: { id: "sg-ptl", name: "Punggol LRT", color: "#748477" },
};

interface OfficialStation {
  id: string;
  name: string;
  code: string;
  line: string;
  file: string;
}

interface WikiLabel {
  "zh-TW"?: string;
  ja?: string;
  ko?: string;
}

interface WikiPage {
  title: string;
  labels: WikiLabel;
}

/** Provenance only — the labels themselves live once, in `stationTranslations`. */
interface WikiSource {
  title: string;
}

interface SingaporeStation {
  name: string;
  code: string;
  lines: string[];
  officialUrl: string;
  wikipedia?: WikiSource;
}

interface SingaporeCatalogLine {
  id: string;
  code: string;
  name: string;
  color: string;
  officialUrl: string;
  stations: Array<{ name: string; code: string }>;
}

function xmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function xmlAttribute(attributes: string, name: string): string {
  return xmlDecode(attributes.match(new RegExp(`${name}="([^"]+)"`, "i"))?.[1] || "");
}

function xmlTag(body: string, name: string): string {
  return xmlDecode(body.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"))?.[1]?.trim() || "");
}

function parseOfficialStations(xml: string): OfficialStation[] {
  return [...xml.matchAll(/<station\b([^>]*)>([\s\S]*?)<\/station>/gi)]
    .map(([, attributes, body]) => ({
      id: xmlAttribute(attributes, "id"),
      name: xmlAttribute(attributes, "name"),
      code: xmlTag(body, "code"),
      line: xmlTag(body, "line"),
      file: xmlTag(body, "file"),
    }))
    .filter((station) => station.name && station.code && station.line && lineMeta[station.line]);
}

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
    if (response.ok) return response.json() as Promise<T>;
    if (response.status !== 429 || attempt === 3) {
      throw new Error(`${response.status} ${response.statusText} from ${url}`);
    }
    await sleep(1_500 * (attempt + 1));
  }
  throw new Error(`Wikipedia request did not complete: ${url}`);
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function wikiKey(title: string): string {
  return title.replace(/_/g, " ").trim().toLowerCase();
}

function stationTitles(name: string): string[] {
  return [`${name} MRT station`, `${name} LRT station`, `${name} station`];
}

function labelsFromLanglinks(langlinks: Array<{ lang?: string; "*"?: string }> | undefined): WikiLabel {
  const links = new Map((langlinks || []).flatMap((link) => (
    link.lang && link["*"] ? [[link.lang, link["*"]] as const] : []
  )));
  // yue normally carries the Traditional Chinese title for Singapore station
  // articles and is the better zh-TW label. zh is the fallback when no yue
  // article exists; it is often Simplified, so `traditionalChineseTitle`
  // converts whatever lands here before it is written out.
  return {
    ...(links.get("yue") || links.get("zh") ? { "zh-TW": links.get("yue") || links.get("zh") } : {}),
    ...(links.get("ja") ? { ja: links.get("ja") } : {}),
    ...(links.get("ko") ? { ko: links.get("ko") } : {}),
  };
}

/**
 * Wikipedia stores article titles, not display names: they carry a station
 * word and, where two networks share a name, a disambiguation suffix. The
 * curated dictionaries in `src/i18n.ts` deliberately omit both, so strip them
 * here rather than shipping "紅山站 (星加坡)" as a station label.
 */
const stationWordSuffix: Record<keyof WikiLabel, RegExp> = {
  "zh-TW": /(?:地鐵站|輕軌站|捷運站|車站|站)$/,
  ja: /駅$/,
  ko: /역$/,
};

function normalizeStationLabel(value: string, locale: keyof WikiLabel): string {
  const withoutDisambiguation = value.replace(/\s*[（(][^（()）]*[)）]\s*$/u, "").trim();
  return withoutDisambiguation.replace(stationWordSuffix[locale], "").trim() || withoutDisambiguation;
}

/**
 * Convert zh labels to the Taiwan variant.
 *
 * zh Wikipedia stores many Singapore station names in Simplified, and only
 * MediaWiki's parser applies variant conversion — the batched `query` form
 * returns the stored title unchanged. Parsing the labels as wikitext converts
 * them all in one request and, unlike converting page titles one at a time,
 * does not depend on an article existing under that exact name. Conversion is
 * idempotent, so a label that is already Traditional passes through.
 *
 * Best-effort: if a chunk comes back a different length than it went in, the
 * alignment is not trustworthy and the originals are kept.
 */
async function toTraditionalChinese(labels: string[]): Promise<string[]> {
  const converted: string[] = [];
  for (const [index, batch] of chunks(labels, 60).entries()) {
    if (index > 0) await sleep(500);
    const url = new URL(WIKIPEDIA_ZH_API);
    url.search = new URLSearchParams({
      action: "parse",
      format: "json",
      contentmodel: "wikitext",
      prop: "text",
      disablelimitreport: "1",
      variant: "zh-tw",
      text: batch.join("\n"),
    }).toString();
    // A transient parser failure would otherwise silently leave a whole chunk
    // Simplified, so retry before giving up on it.
    let lines: string[] = [];
    for (let attempt = 0; attempt < 3 && lines.length !== batch.length; attempt += 1) {
      if (attempt > 0) await sleep(1_000 * attempt);
      try {
        const payload = await fetchJson<{ parse?: { text?: { "*"?: string } } }>(url.toString());
        lines = xmlDecode((payload.parse?.text?.["*"] || "").replace(/<[^>]*>/g, ""))
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
      } catch {
        lines = [];
      }
    }
    if (lines.length !== batch.length) {
      console.warn(`zh-TW conversion failed for ${batch.length} label(s) after 3 attempts; keeping them as published: ${batch.join(", ")}`);
      converted.push(...batch);
      continue;
    }
    converted.push(...lines);
  }
  return converted;
}

async function fetchWikipediaPages(titles: string[]): Promise<Map<string, WikiPage>> {
  const pages = new Map<string, WikiPage>();
  for (const [index, batch] of chunks(titles, 25).entries()) {
    if (index > 0) await sleep(500);
    const url = new URL(WIKIPEDIA_API);
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      prop: "langlinks",
      lllimit: "max",
      titles: batch.join("|"),
    }).toString();
    const payload = await fetchJson<{ query?: { pages?: Record<string, { title?: string; langlinks?: Array<{ lang?: string; "*"?: string }> }> } }>(url.toString());
    for (const page of Object.values(payload.query?.pages || {})) {
      if (!page.title) continue;
      pages.set(wikiKey(page.title), { title: page.title, labels: labelsFromLanglinks(page.langlinks) });
    }
  }
  return pages;
}

async function searchWikipediaTitle(name: string): Promise<string | undefined> {
  const url = new URL(WIKIPEDIA_API);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    list: "search",
    srlimit: "5",
    srsearch: `${name} station Singapore`,
  }).toString();
  const payload = await fetchJson<{ query?: { search?: Array<{ title?: string }> } }>(url.toString());
  return payload.query?.search?.find((result) => result.title)?.title;
}

async function fetchChineseStationTableLabels(): Promise<Map<string, string>> {
  const pages = [
    "新加坡地鐵車站列表",
    "新加坡輕軌車站列表",
  ];
  const labels = new Map<string, string>();
  for (const title of pages) {
    const url = `https://zh.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&printable=yes`;
    const response = await fetch(url, { headers: { Accept: "text/html", "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
    const html = await response.text();
    const rowPattern = /<td>\s*<a[^>]*title="([^"]+)"[^>]*>[^<]*<\/a>\s*<\/td>\s*<td>\s*([^<]+)\s*<\/td>/g;
    for (const match of html.matchAll(rowPattern)) {
      const chinese = xmlDecode(match[1].trim());
      const english = xmlDecode(match[2].trim());
      if (chinese && english) labels.set(english, chinese);
    }
  }
  return labels;
}

async function main() {
  const xmlResponse = await fetch(OFFICIAL_STATION_XML, { headers: { Accept: "application/xml", "User-Agent": USER_AGENT } });
  if (!xmlResponse.ok) throw new Error(`${xmlResponse.status} ${xmlResponse.statusText} from ${OFFICIAL_STATION_XML}`);
  const officialStations = parseOfficialStations(await xmlResponse.text());
  if (officialStations.length === 0) throw new Error("Official Singapore station XML contained no stations.");

  const uniqueNames = [...new Set(officialStations.map((station) => station.name))];
  const chineseTableLabels = await fetchChineseStationTableLabels();
  const directTitles = uniqueNames.map((name) => stationTitles(name)[0]);
  const pages = await fetchWikipediaPages(directTitles);
  const wikipediaByStation = new Map<string, WikiPage>();
  for (const name of uniqueNames) {
    const page = stationTitles(name).map(wikiKey).map((title) => pages.get(title)).find(Boolean);
    if (page) {
      wikipediaByStation.set(name, {
        ...page,
        labels: {
          ...page.labels,
          ...(!page.labels["zh-TW"] && chineseTableLabels.get(name)
            ? { "zh-TW": chineseTableLabels.get(name) }
            : {}),
        },
      });
    }
  }

  // Search only the uncommon names that do not follow Wikipedia's normal
  // station-title convention. This keeps the update bounded and reviewable.
  for (const name of uniqueNames.filter((station) => !wikipediaByStation.has(station))) {
    const title = await searchWikipediaTitle(name);
    if (!title) continue;
    const fallbackPages = await fetchWikipediaPages([title]);
    const page = fallbackPages.get(wikiKey(title));
    if (page) wikipediaByStation.set(name, page);
  }

  // Strip the article-title decoration first, then convert the zh labels in
  // one request, so what lands in the catalog is a display name.
  const labelled = [...wikipediaByStation].map(([name, page]) => ({
    name,
    page,
    labels: Object.fromEntries(
      (["zh-TW", "ja", "ko"] as const).flatMap((locale) => (
        page.labels[locale] ? [[locale, normalizeStationLabel(page.labels[locale]!, locale)]] : []
      )),
    ) as WikiLabel,
  }));
  const needsConversion = labelled.filter((entry) => entry.labels["zh-TW"]);
  const traditional = await toTraditionalChinese(needsConversion.map((entry) => entry.labels["zh-TW"]!));
  needsConversion.forEach((entry, index) => { entry.labels["zh-TW"] = traditional[index]; });
  for (const { name, page, labels } of labelled) wikipediaByStation.set(name, { ...page, labels });

  const lineStations = new Map<string, Array<{ name: string; code: string }>>();
  for (const station of officialStations) {
    const list = lineStations.get(station.line) || [];
    if (!list.some((item) => item.name === station.name)) list.push({ name: station.name, code: station.code });
    lineStations.set(station.line, list);
  }

  const lines: SingaporeCatalogLine[] = Object.keys(lineMeta)
    .filter((code) => lineStations.has(code))
    .map((code) => ({
      ...lineMeta[code],
      code,
      officialUrl: `https://www.mytransport.sg/map/mrt/${code}/station_list.html`,
      stations: lineStations.get(code) || [],
    }));

  const stationsByName = new Map<string, SingaporeStation>();
  for (const station of officialStations) {
    const current = stationsByName.get(station.name);
    const page = wikipediaByStation.get(station.name);
    if (current) {
      if (!current.lines.includes(station.line)) current.lines.push(station.line);
      continue;
    }
    stationsByName.set(station.name, {
      name: station.name,
      code: station.code,
      lines: [station.line],
      officialUrl: `https://www.mytransport.sg/map/mrt/${station.line}/${station.file.split("/").at(-1)}`,
      ...(page ? { wikipedia: { title: page.title } } : {}),
    });
  }

  const stationTranslations = Object.fromEntries(
    [...stationsByName.keys()].flatMap((name) => {
      const labels = wikipediaByStation.get(name)?.labels;
      return labels && Object.keys(labels).length > 0 ? [[name, labels] as const] : [];
    }),
  );
  const catalog = {
    country: "singapore",
    kind: "official_mytransport_station_directory",
    retrievedAt: new Date().toISOString(),
    source: OFFICIAL_MAP_URL,
    stationXml: OFFICIAL_STATION_XML,
    wikipediaApi: WIKIPEDIA_API,
    lines,
    stations: [...stationsByName.values()],
    stationTranslations,
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  const menu = { source: OFFICIAL_MAP_URL, lines, stationTranslations };
  writeFileSync(MENU_OUTPUT_PATH, `${JSON.stringify(menu, null, 2)}\n`, "utf8");
  console.log(`Wrote ${lines.length} lines and ${stationsByName.size} stations to ${OUTPUT_PATH}`);
  console.log(`Wrote the browser slice to ${MENU_OUTPUT_PATH}`);
  console.log(`Wikipedia language mappings: ${Object.keys(stationTranslations).length}/${stationsByName.size}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
