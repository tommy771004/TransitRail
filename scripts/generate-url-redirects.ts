/**
 * Maintain the route redirects and SPA rewrites in vercel.json.
 *
 * Slugs are derived from the scraped station names, so renaming the tidy rule
 * (tidyStationName) silently moves every affected page's URL, and withdrawing a
 * source removes pages outright. Vercel resolves vercel.json before the build
 * and Express never sees these paths, so anything Google has already indexed
 * needs a 301 here or it becomes a 404.
 *
 * Ownership: this script owns every redirect whose source is a
 * (locale-prefixed) country path or sits under one, and every rewrite to
 * /index.html. The hand-written sitemap redirects and the /api rewrite are
 * never touched. The rules themselves live in scripts/lib/urlRedirects.ts.
 *
 * Run: npx tsx scripts/generate-url-redirects.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { SPA_COUNTRY_PATHS } from "../src/utils/countryPath";
import { PRERENDER_LOCALES, collectRoutePages, collectScrapedRoutes } from "./lib/routePages";
import {
  buildRouteRedirects,
  buildSpaRewrites,
  isRouteRedirect,
  type Redirect,
  type Rewrite,
} from "./lib/urlRedirects";

const VERCEL_JSON = resolve("vercel.json");

function main(): void {
  const config = JSON.parse(readFileSync(VERCEL_JSON, "utf8")) as {
    redirects?: Redirect[];
    rewrites?: Rewrite[];
  };
  const keptRedirects = (config.redirects || []).filter((redirect) => !isRouteRedirect(redirect));
  const routeRedirects = buildRouteRedirects(collectRoutePages(), collectScrapedRoutes(), SPA_COUNTRY_PATHS);
  config.redirects = [...keptRedirects, ...routeRedirects];

  const keptRewrites = (config.rewrites || []).filter((rewrite) => rewrite.destination !== "/index.html");
  config.rewrites = [...keptRewrites, ...buildSpaRewrites(SPA_COUNTRY_PATHS)];

  writeFileSync(VERCEL_JSON, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  const perPath = PRERENDER_LOCALES.length * 2;
  console.log(
    `vercel.json: ${routeRedirects.length} route redirects (~${Math.round(routeRedirects.length / perPath)} paths × ${PRERENDER_LOCALES.length} locales × 2 slash forms), ` +
      `${keptRedirects.length} hand-written kept, ${config.rewrites.length - keptRewrites.length} SPA rewrites.`,
  );
}

main();
