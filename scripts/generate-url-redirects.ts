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
  slugifyStation,
  tidyStationName,
} from "./lib/routePages";

type Redirect = { source: string; destination: string; permanent: boolean };

const VERCEL_JSON = resolve("vercel.json");
const COUNTRY_PREFIXES = Object.values(COUNTRY_PATHS);

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
    const legacySlug = `${slugifyStation(page.origin)}-to-${slugifyStation(page.destination)}`;
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
