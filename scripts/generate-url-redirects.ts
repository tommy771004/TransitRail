/**
 * Maintain the 301s in vercel.json for route pages whose slug changed.
 *
 * Slugs are derived from the scraped station names, so renaming the tidy rule
 * (tidyStationName) silently moves every affected page's URL. Anything Google
 * has already indexed would then land on the SPA catch-all — a soft 404, since
 * Vercel resolves vercel.json before the build and Express never sees these
 * paths. This regenerates a redirect from the legacy slug to the current one,
 * for every prerender locale.
 *
 * The legacy slug is the untidied name, so the mapping is derivable from data
 * rather than hand-maintained: whenever tidying changes a name, the old URL is
 * exactly what the generator used to emit.
 *
 * Ownership rule: this script owns every redirect whose source sits under a
 * (locale-prefixed) country path. The hand-written sitemap redirects live at
 * /sitemap* and are never touched. Run: npx tsx scripts/generate-url-redirects.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  COUNTRY_PATHS,
  PRERENDER_LOCALES,
  collectRoutePages,
  localeUrlPath,
} from "./lib/routePages";

/**
 * Slug rules exactly as they were published before this branch: the raw,
 * untidied station name, NFKD-folded, with no transliteration of letters NFKD
 * cannot decompose. Pinned here on purpose — deriving the legacy slug from the
 * current slugifyStation() would silently stop producing the old URL the moment
 * those rules change again, which is the one thing this script must not do.
 */
function legacyStationSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Redirect = { source: string; destination: string; permanent: boolean };

const VERCEL_JSON = resolve("vercel.json");
const COUNTRY_PREFIXES = Object.values(COUNTRY_PATHS);

/**
 * Route pages that were published and no longer exist.
 *
 * Removing a page is not a slug change, so the derivation above cannot find
 * these: nothing on disk records that the URL ever existed. Listing them keeps
 * their six-locale URLs useful with a 301 to the crawlable route index rather
 * than letting the SPA answer a soft 404 for a page Google still has indexed.
 *
 * The Singapore and Thailand entries were representative metro snapshots. The
 * rest went with the official-sources refactor: Japan's generated Shinkansen
 * and Yamanote pages, Korail's curated KTX pages, and the "12306" pages, all of
 * which stated departure times no operator had published.
 */
const REMOVED_ROUTE_SLUGS: Array<{ country: keyof typeof COUNTRY_PATHS; slug: string }> = [
  { country: "china", slug: "beijing-south-to-nanjing-south" },
  { country: "china", slug: "beijing-south-to-shanghai-hongqiao" },
  { country: "china", slug: "guangzhou-south-to-shenzhen-north" },
  { country: "china", slug: "shanghai-hongqiao-to-hangzhou-east" },
  { country: "japan", slug: "akihabara-to-tokyo" },
  { country: "japan", slug: "ikebukuro-to-tokyo" },
  { country: "japan", slug: "sendai-to-tokyo" },
  { country: "japan", slug: "shibuya-to-tokyo" },
  { country: "japan", slug: "shin-osaka-to-hakata" },
  { country: "japan", slug: "shinagawa-to-tokyo" },
  { country: "japan", slug: "shinjuku-to-tokyo" },
  { country: "japan", slug: "tokyo-to-akihabara" },
  { country: "japan", slug: "tokyo-to-hakata" },
  { country: "japan", slug: "tokyo-to-ikebukuro" },
  { country: "japan", slug: "tokyo-to-kanazawa" },
  { country: "japan", slug: "tokyo-to-niigata" },
  { country: "japan", slug: "tokyo-to-sendai" },
  { country: "japan", slug: "tokyo-to-shibuya" },
  { country: "japan", slug: "tokyo-to-shinagawa" },
  { country: "japan", slug: "tokyo-to-shinjuku" },
  { country: "japan", slug: "tokyo-to-ueno" },
  { country: "japan", slug: "ueno-to-tokyo" },
  { country: "korea", slug: "busan-to-seoul" },
  { country: "korea", slug: "daejeon-to-busan" },
  { country: "korea", slug: "seoul-to-busan" },
  { country: "korea", slug: "seoul-to-daejeon" },
  { country: "korea", slug: "seoul-to-gangneung" },
  { country: "korea", slug: "seoul-to-gwangju-songjeong" },
  { country: "korea", slug: "seoul-to-mokpo" },
  { country: "korea", slug: "seoul-to-yeosu-expo" },
  { country: "korea", slug: "yongsan-to-mokpo" },
  { country: "singapore", slug: "changi-airport-to-jurong-east" },
  { country: "singapore", slug: "harbourfront-to-punggol" },
  { country: "singapore", slug: "jurong-east-to-raffles-place" },
  { country: "singapore", slug: "woodlands-to-orchard" },
  { country: "thailand", slug: "mo-chit-to-hua-lamphong" },
  { country: "thailand", slug: "siam-to-mo-chit" },
  { country: "thailand", slug: "siam-to-saphan-taksin" },
  { country: "thailand", slug: "sukhumvit-to-hua-lamphong" },
];

/** A redirect this script is responsible for, i.e. one under a country path. */
function isGenerated(redirect: Redirect): boolean {
  return PRERENDER_LOCALES.some((locale) =>
    COUNTRY_PREFIXES.some((countryPath) =>
      redirect.source.startsWith(`${localeUrlPath(`${countryPath}/`, locale)}`),
    ),
  );
}

function buildRedirects(): Redirect[] {
  const redirects: Redirect[] = [];
  for (const page of collectRoutePages()) {
    const legacySlug = `${legacyStationSlug(page.origin)}-to-${legacyStationSlug(page.destination)}`;
    if (legacySlug === page.slug) continue;
    const legacyPath = `${page.countryPath}/${legacySlug}/`;
    for (const locale of PRERENDER_LOCALES) {
      redirects.push({
        source: localeUrlPath(legacyPath, locale).replace(/\/$/, ""),
        destination: localeUrlPath(page.urlPath, locale),
        permanent: true,
      });
    }
  }

  for (const { country, slug } of REMOVED_ROUTE_SLUGS) {
    const legacyPath = `${COUNTRY_PATHS[country]}/${slug}/`;
    for (const locale of PRERENDER_LOCALES) {
      redirects.push({
        source: localeUrlPath(legacyPath, locale).replace(/\/$/, ""),
        destination: localeUrlPath("/routes/", locale),
        permanent: true,
      });
    }
  }
  return redirects;
}

function main(): void {
  const config = JSON.parse(readFileSync(VERCEL_JSON, "utf8")) as { redirects?: Redirect[] };
  const kept = (config.redirects || []).filter((redirect) => !isGenerated(redirect));
  const generated = buildRedirects();
  config.redirects = [...kept, ...generated];
  writeFileSync(VERCEL_JSON, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log(
    `vercel.json: ${generated.length} route redirects (${generated.length / PRERENDER_LOCALES.length} routes × ${PRERENDER_LOCALES.length} locales), ${kept.length} hand-written kept.`,
  );
}

main();
