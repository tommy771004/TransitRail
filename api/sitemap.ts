/**
 * Optional sitemap endpoint at /api/sitemap.
 * Canonical public URL is still /sitemap.xml (static file from build).
 *
 * Fully self-contained — no imports from scripts/ (Vercel @vercel/node
 * fails to resolve that graph → FUNCTION_INVOCATION_FAILED / HTTP 500).
 */
import type { IncomingMessage, ServerResponse } from "http";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const SITE = (process.env.SITE_URL || "https://rail-national.vercel.app").replace(/\/$/, "");

const COUNTRY_PATHS: Record<string, string> = {
  japan: "/japan",
  korea: "/korea",
  china: "/china",
  singapore: "/singapore",
  malaysia: "/malaysia",
  thailand: "/thailand",
  hong_kong: "/hong-kong",
  united_kingdom: "/united-kingdom",
  united_states: "/united-states",
  germany: "/germany",
  france: "/france",
  belgium: "/belgium",
  norway: "/norway",
  switzerland: "/switzerland",
};

const MIN_DAILY = 3;

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dateOnly(value: string | undefined) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10);
}

function slugify(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveScrapedDir(): string {
  const candidates = [
    resolve(process.cwd(), "src/data/scraped"),
    resolve(process.cwd(), "data/scraped"),
    join(__dirname, "..", "src", "data", "scraped"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0];
}

function buildXml(): string {
  const scrapedDir = resolveScrapedDir();
  const entries: Array<{ url: string; lastmod: string }> = [];
  let latest = dateOnly(undefined);

  if (!existsSync(scrapedDir)) {
    throw new Error(`Scraped data directory missing (cwd=${process.cwd()} tried=${scrapedDir})`);
  }

  const countries = readdirSync(scrapedDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name in COUNTRY_PATHS)
    .map((e) => e.name)
    .sort();

  for (const country of countries) {
    let lastmod = latest;
    try {
      const meta = JSON.parse(
        readFileSync(join(scrapedDir, country, "metadata.json"), "utf8"),
      ) as { lastScraped?: string };
      lastmod = dateOnly(meta.lastScraped);
      if (lastmod > latest) latest = lastmod;
    } catch {
      /* ignore */
    }
    entries.push({ url: `${SITE}${COUNTRY_PATHS[country]}/`, lastmod });

    const dir = join(scrapedDir, country);
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".json") || file === "metadata.json") continue;
      let route: {
        origin?: string;
        destination?: string;
        scrapedAt?: string;
        results?: Array<{ date?: string }>;
      };
      try {
        route = JSON.parse(readFileSync(join(dir, file), "utf8"));
      } catch {
        continue;
      }
      if (!route.origin || !route.destination || !Array.isArray(route.results)) continue;

      const dates = [
        ...new Set(route.results.map((r) => (r.date || "").trim()).filter(Boolean)),
      ].sort();
      const day = dates.length ? dates[dates.length - 1] : "";
      const slice = day
        ? route.results.filter((r) => (r.date || "").trim() === day)
        : route.results;
      if (slice.length < MIN_DAILY) continue;

      const o = slugify(route.origin);
      const d = slugify(route.destination);
      if (!o || !d) continue;
      const path = `${COUNTRY_PATHS[country]}/${o}-to-${d}/`;
      const lm = dateOnly(route.scrapedAt);
      entries.push(
        { url: `${SITE}${path}`, lastmod: lm },
        { url: `${SITE}/zh${path}`, lastmod: lm },
        { url: `${SITE}/ja${path}`, lastmod: lm },
        { url: `${SITE}/ko${path}`, lastmod: lm },
      );
    }
  }

  const routeLatest = entries.map((e) => e.lastmod).sort().at(-1) ?? latest;
  const all = [
    { url: `${SITE}/`, lastmod: latest },
    { url: `${SITE}/routes/`, lastmod: routeLatest },
    { url: `${SITE}/zh/routes/`, lastmod: routeLatest },
    { url: `${SITE}/ja/routes/`, lastmod: routeLatest },
    { url: `${SITE}/ko/routes/`, lastmod: routeLatest },
    ...entries,
  ];

  // Dedupe by loc (country list + routes may overlap hubs)
  const seen = new Set<string>();
  const unique = all.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique
  .map(
    (e) =>
      `  <url>\n    <loc>${esc(e.url)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const body = buildXml();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    res.end(body);
  } catch (error) {
    console.error("[api/sitemap]", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(
      `Sitemap generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
