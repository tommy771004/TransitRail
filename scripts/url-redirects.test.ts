import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SPA_COUNTRY_PATHS } from "../src/utils/countryPath";
import { renderNotFoundPage } from "./generate-route-pages";
import { collectRoutePages, collectScrapedRoutes, type ScrapedRoute } from "./lib/routePages";
import {
  buildRouteRedirects,
  buildSpaRewrites,
  isRouteRedirect,
  type Redirect,
  type Rewrite,
} from "./lib/urlRedirects";

const page = (countryPath: string, slug: string) => ({ countryPath, urlPath: `${countryPath}/${slug}/` });
const scraped = (countryPath: string, origin: string, destination: string, slug: string): ScrapedRoute => ({
  countryPath,
  origin,
  destination,
  urlPath: `${countryPath}/${slug}/`,
});
const destinationOf = (redirects: Redirect[], source: string) =>
  redirects.find((redirect) => redirect.source === source)?.destination;

describe("buildRouteRedirects", () => {
  const spaPaths = ["/japan", "/korea", "/malaysia"];

  it("redirects both slash forms of a retired page, in every locale", () => {
    const redirects = buildRouteRedirects([page("/japan", "tokyo-to-kyoto")], [], spaPaths);
    // Google indexed the trailing-slash URL; a bare-path rule alone lets it fall through.
    expect(destinationOf(redirects, "/japan/shibuya-to-tokyo/")).toBe("/japan/");
    expect(destinationOf(redirects, "/japan/shibuya-to-tokyo")).toBe("/japan/");
    expect(destinationOf(redirects, "/zh/japan/shibuya-to-tokyo/")).toBe("/zh/japan/");
  });

  it("falls back to the route index when the market publishes nothing", () => {
    const redirects = buildRouteRedirects([page("/japan", "tokyo-to-kyoto")], [], spaPaths);
    expect(destinationOf(redirects, "/china/beijing-south-to-nanjing-south/")).toBe("/routes/");
    expect(destinationOf(redirects, "/de/china/beijing-south-to-nanjing-south/")).toBe("/de/routes/");
  });

  it("never shadows a path a scraped route answers, published tonight or not", () => {
    const redirects = buildRouteRedirects(
      [page("/korea", "seoul-to-daejeon")],
      [scraped("/korea", "Seoul", "Busan", "seoul-to-busan")],
      spaPaths,
    );
    expect(destinationOf(redirects, "/korea/seoul-to-busan/")).toBeUndefined();
    expect(destinationOf(redirects, "/korea/seoul-to-busan")).toBeUndefined();
  });

  it("follows a successor only while that page is published", () => {
    const published = buildRouteRedirects([page("/korea", "seoul-to-daejeon")], [], spaPaths);
    expect(destinationOf(published, "/korea/seoul-snc-to-daejeon/")).toBe("/korea/seoul-to-daejeon/");
    expect(destinationOf(published, "/korea/seoul-snc-to-mokpo/")).toBe("/korea/");
  });

  it("keeps a renamed slug's redirect on a night its page is withheld", () => {
    const renamed = scraped("/norway", "Trondheim S", "Bodø stasjon", "trondheim-s-to-bodo-stasjon");
    const withheld = buildRouteRedirects([page("/norway", "oslo-s-to-bergen")], [renamed], spaPaths);
    expect(destinationOf(withheld, "/norway/trondheim-s-to-bod-stasjon/")).toBe("/norway/");
    const publishedAgain = buildRouteRedirects(
      [page("/norway", "trondheim-s-to-bodo-stasjon")],
      [renamed],
      spaPaths,
    );
    expect(destinationOf(publishedAgain, "/norway/trondheim-s-to-bod-stasjon/")).toBe(
      "/norway/trondheim-s-to-bodo-stasjon/",
    );
  });

  it("sends the index of a market without pages to the route index, except the SPA's own path", () => {
    const redirects = buildRouteRedirects([page("/japan", "tokyo-to-kyoto")], [], spaPaths);
    // Configured but unpublished: the SPA answers /malaysia, nothing answers /zh/malaysia.
    expect(destinationOf(redirects, "/malaysia/")).toBeUndefined();
    expect(destinationOf(redirects, "/zh/malaysia/")).toBe("/zh/routes/");
    // Not configured: the SPA does not answer it either.
    expect(destinationOf(redirects, "/thailand")).toBe("/routes/");
    expect(destinationOf(redirects, "/thailand/")).toBe("/routes/");
    // A market with pages has a real index.
    expect(destinationOf(redirects, "/ja/japan/")).toBeUndefined();
  });

  it("emits one rule per source", () => {
    const redirects = buildRouteRedirects([page("/japan", "tokyo-to-kyoto")], [], spaPaths);
    const sources = redirects.map((redirect) => redirect.source);
    expect(new Set(sources).size).toBe(sources.length);
  });
});

describe("isRouteRedirect", () => {
  const rule = (source: string): Redirect => ({ source, destination: "/routes/", permanent: true });

  it("owns route and market-index sources in either slash form, and nothing else", () => {
    expect(isRouteRedirect(rule("/japan/a-to-b"))).toBe(true);
    expect(isRouteRedirect(rule("/zh/china"))).toBe(true);
    expect(isRouteRedirect(rule("/zh/china/"))).toBe(true);
    expect(isRouteRedirect(rule("/sitemap"))).toBe(false);
    expect(isRouteRedirect(rule("/japanese-rail"))).toBe(false);
  });
});

describe("renderNotFoundPage", () => {
  it("claims no address of its own", () => {
    const html = renderNotFoundPage();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("hreflang");
    expect(html).not.toContain("og:url");
  });
});

describe("committed vercel.json", () => {
  const config = JSON.parse(readFileSync(resolve("vercel.json"), "utf8")) as {
    redirects: Redirect[];
    rewrites: Rewrite[];
  };

  it("rewrites only the SPA's own paths to the shell, with no catch-all", () => {
    // A catch-all turns every withdrawn page into a 200 shell: a soft 404.
    const shellRewrites = config.rewrites.filter((rewrite) => rewrite.destination === "/index.html");
    expect(shellRewrites).toEqual(buildSpaRewrites(SPA_COUNTRY_PATHS));
    for (const { source } of shellRewrites) expect(source).not.toMatch(/[(*:]/);
  });

  it("redirects every route source in both slash forms", () => {
    const sources = new Set(config.redirects.filter(isRouteRedirect).map((redirect) => redirect.source));
    for (const source of sources) {
      const twin = source.endsWith("/") ? source.slice(0, -1) : `${source}/`;
      expect(sources.has(twin), `${source} has no ${twin} twin (run npm run redirects)`).toBe(true);
    }
  });

  it("shadows no route a scraped file answers and no market index that is published", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const live = new Set<string>([
      ...collectScrapedRoutes().map((route) => route.urlPath),
      ...collectRoutePages().map((routePage) => `${routePage.countryPath}/`),
    ]);
    warn.mockRestore();
    const sources = config.redirects.map((redirect) => redirect.source.replace(/\/?$/, "/"));
    const shadowed = sources.filter((source) => live.has(source.replace(/^\/(zh|ja|ko|fr|de)(?=\/)/, "")));
    expect(shadowed, "run npm run redirects").toEqual([]);
  });
});
