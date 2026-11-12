/**
 * The route redirects and SPA rewrites that vercel.json must carry.
 *
 * Pure derivation, so the rules can be tested without touching vercel.json:
 * scripts/generate-url-redirects.ts does the reading and writing.
 */
import {
  COUNTRY_PATHS,
  PRERENDER_LOCALES,
  localeUrlPath,
  type RoutePageData,
  type ScrapedRoute,
} from "./routePages";

export type Redirect = { source: string; destination: string; permanent: boolean };
export type Rewrite = { source: string; destination: string };

const ROUTES_INDEX = "/routes/";
const COUNTRY_PREFIXES = Object.values(COUNTRY_PATHS);

/**
 * Slug rules exactly as they were published before station names were tidied:
 * the raw name, NFKD-folded, with no transliteration of letters NFKD cannot
 * decompose. Pinned here on purpose. Deriving the legacy slug from the current
 * slugifyStation() would silently stop producing the old URL the moment those
 * rules change again, which is the one thing this module must not do.
 */
export function legacyStationSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Route pages that were published and whose URL nothing on disk remembers.
 *
 * Removing a page is not a slug change, so the legacy-slug derivation cannot
 * find these. Listing them keeps their six-locale URLs useful with a 301
 * instead of a 404 for a page Google still has indexed.
 *
 * `successor` names the slug that replaced a renamed page. It is followed only
 * while that page is published; otherwise the entry falls back like any other.
 *
 * The Singapore and Thailand entries were representative metro snapshots. The
 * China, Japan and Korea entries went with the official-sources refactor:
 * generated Shinkansen, Yamanote and Tokyo Metro pages, Korail's curated KTX
 * pages (including the "-snc" / "-bsn" station-code slugs they first shipped
 * under), and the "12306" pages, all of which stated departure times no
 * operator had published.
 *
 * An entry whose path a scraped route file answers again is skipped, so a
 * route that returns under its old slug is never shadowed by its own redirect.
 */
export const RETIRED_ROUTE_SLUGS: Array<{
  country: keyof typeof COUNTRY_PATHS;
  slug: string;
  successor?: string;
}> = [
  { country: "china", slug: "beijing-south-to-nanjing-south" },
  { country: "china", slug: "beijing-south-to-shanghai-hongqiao" },
  { country: "china", slug: "guangzhou-south-to-shenzhen-north" },
  { country: "china", slug: "shanghai-hongqiao-to-hangzhou-east" },
  { country: "japan", slug: "akihabara-to-tokyo" },
  { country: "japan", slug: "asakusa-to-nihombashi" },
  { country: "japan", slug: "ikebukuro-to-tokyo" },
  { country: "japan", slug: "jimbocho-to-otemachi" },
  { country: "japan", slug: "jimbocho-to-shinjuku" },
  { country: "japan", slug: "nihombashi-to-asakusa" },
  { country: "japan", slug: "otemachi-to-jimbocho" },
  { country: "japan", slug: "roppongi-to-shinjuku" },
  { country: "japan", slug: "sendai-to-tokyo" },
  { country: "japan", slug: "shibuya-to-tokyo" },
  { country: "japan", slug: "shin-osaka-to-hakata" },
  { country: "japan", slug: "shinagawa-to-tokyo" },
  { country: "japan", slug: "shinjuku-to-jimbocho" },
  { country: "japan", slug: "shinjuku-to-roppongi" },
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
  { country: "korea", slug: "busan-bsn-to-seoul-snc", successor: "busan-to-seoul" },
  { country: "korea", slug: "busan-to-seoul" },
  { country: "korea", slug: "daejeon-to-busan" },
  { country: "korea", slug: "daejeon-to-busan-bsn", successor: "daejeon-to-busan" },
  { country: "korea", slug: "seoul-snc-to-busan-bsn", successor: "seoul-to-busan" },
  { country: "korea", slug: "seoul-snc-to-daejeon", successor: "seoul-to-daejeon" },
  { country: "korea", slug: "seoul-snc-to-gangneung", successor: "seoul-to-gangneung" },
  { country: "korea", slug: "seoul-snc-to-gwangju-songjeong", successor: "seoul-to-gwangju-songjeong" },
  { country: "korea", slug: "seoul-snc-to-mokpo", successor: "seoul-to-mokpo" },
  { country: "korea", slug: "seoul-snc-to-yeosu-expo", successor: "seoul-to-yeosu-expo" },
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

/**
 * A redirect this module owns: one whose source is a (locale-prefixed) country
 * path or sits under one. The hand-written sitemap redirects live at /sitemap*
 * and are never touched.
 */
export function isRouteRedirect(redirect: Redirect): boolean {
  const source = redirect.source.replace(/\/$/, "");
  return PRERENDER_LOCALES.some((locale) =>
    COUNTRY_PREFIXES.some((countryPath) => {
      const base = localeUrlPath(countryPath, locale);
      return source === base || source.startsWith(`${base}/`);
    }),
  );
}

/**
 * Both spellings of one path. Vercel matches a source strictly, and Google
 * indexed the trailing-slash form, so a rule for "/japan/a-to-b" alone leaves
 * "/japan/a-to-b/" to fall through.
 */
function bothSlashForms(path: string): [string, string] {
  const bare = path.replace(/\/$/, "");
  return [bare, `${bare}/`];
}

export function buildRouteRedirects(
  pages: Array<Pick<RoutePageData, "countryPath" | "urlPath">>,
  scrapedRoutes: ScrapedRoute[],
  spaPaths: readonly string[],
): Redirect[] {
  const pagePaths = new Set(pages.map((page) => page.urlPath));
  const publishedCountryPaths = new Set(pages.map((page) => page.countryPath));
  const scrapedPaths = new Set(scrapedRoutes.map((route) => route.urlPath));
  // Locale-neutral path → locale-neutral destination. A Map so a path named by
  // both derivations yields one rule, not two competing ones.
  const moves = new Map<string, string>();

  // A route page is withheld on a night its timetable is thin, so a redirect
  // names it only while it is published and otherwise lands on something that
  // will still be there: the market's index, or the route index.
  const settle = (countryPath: string, target?: string) =>
    target && pagePaths.has(target)
      ? target
      : publishedCountryPaths.has(countryPath)
        ? `${countryPath}/`
        : ROUTES_INDEX;

  for (const route of scrapedRoutes) {
    const legacyPath = `${route.countryPath}/${legacyStationSlug(route.origin)}-to-${legacyStationSlug(route.destination)}/`;
    if (legacyPath === route.urlPath || scrapedPaths.has(legacyPath)) continue;
    moves.set(legacyPath, settle(route.countryPath, route.urlPath));
  }

  for (const { country, slug, successor } of RETIRED_ROUTE_SLUGS) {
    const countryPath = COUNTRY_PATHS[country];
    const retiredPath = `${countryPath}/${slug}/`;
    if (scrapedPaths.has(retiredPath) || moves.has(retiredPath)) continue;
    moves.set(retiredPath, settle(countryPath, successor && `${countryPath}/${successor}/`));
  }

  const redirects: Redirect[] = [];
  for (const [from, to] of moves) {
    for (const locale of PRERENDER_LOCALES) {
      for (const source of bothSlashForms(localeUrlPath(from, locale))) {
        redirects.push({ source, destination: localeUrlPath(to, locale), permanent: true });
      }
    }
  }

  // A market with no published page has no static index either. Its English
  // path is the SPA's own market page while the market is configured; every
  // other form is nothing the SPA recognises, so it goes to the route index.
  for (const countryPath of COUNTRY_PREFIXES) {
    if (publishedCountryPaths.has(countryPath)) continue;
    for (const locale of PRERENDER_LOCALES) {
      if (locale === "en" && spaPaths.includes(countryPath)) continue;
      for (const source of bothSlashForms(localeUrlPath(countryPath, locale))) {
        redirects.push({ source, destination: localeUrlPath(ROUTES_INDEX, locale), permanent: true });
      }
    }
  }
  return redirects;
}

/**
 * The only rewrites to the app shell: the market paths the SPA answers, in
 * both slash forms. "/" is the shell file itself and needs none. There is
 * deliberately no catch-all, so an unknown path gets Vercel's 404 (404.html).
 */
export function buildSpaRewrites(spaPaths: readonly string[]): Rewrite[] {
  return spaPaths.flatMap((spaPath) =>
    bothSlashForms(spaPath).map((source) => ({ source, destination: "/index.html" })),
  );
}
