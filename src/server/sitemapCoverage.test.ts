import { describe, expect, it } from "vitest";
import { COUNTRY_PATHS, PRERENDER_LOCALES, collectRoutePages, localeUrlPath } from "../../scripts/lib/routePages";
import { SITE_URL, collectSitemapEntries } from "./sitemapXml";

/**
 * The sitemap and the page generator read the same route files, but they used
 * to disagree about country hubs: the sitemap listed a hub for every directory
 * under src/data/scraped/, while generate-route-pages.ts only emits one for a
 * country that produced route pages. Malaysia ships a station catalogue and no
 * timetables, so its six locale hubs were advertised to Google and answered by
 * the SPA catch-all — HTTP 200 with the wrong page, which is the shape of a
 * soft 404 rather than an honest miss.
 */
describe("sitemap coverage matches the generated pages", () => {
  const { allEntries, countryEntries } = collectSitemapEntries();
  const pages = collectRoutePages();
  const generatedPaths = new Set<string>([
    "/",
    ...PRERENDER_LOCALES.map((locale) => localeUrlPath("/routes/", locale)),
    ...pages.flatMap((page) => PRERENDER_LOCALES.map((locale) => localeUrlPath(page.urlPath, locale))),
    ...[...new Set(pages.map((page) => String(page.country)))].flatMap((country) =>
      PRERENDER_LOCALES.map((locale) => localeUrlPath(`${COUNTRY_PATHS[country]}/`, locale)),
    ),
  ]);

  it("lists no URL the generator does not build", () => {
    const orphans = allEntries
      .map((entry) => entry.url.replace(SITE_URL, ""))
      .filter((path) => !generatedPaths.has(path));

    expect(orphans).toEqual([]);
  });

  it("omits a country whose scraped directory holds no route file", () => {
    const countriesWithPages = new Set(pages.map((page) => String(page.country)));
    const listed = new Set(
      countryEntries.map((entry) => entry.url.replace(SITE_URL, "").replace(/^\/(?:zh|ja|ko|fr|de)/, "")),
    );

    for (const [country, countryPath] of Object.entries(COUNTRY_PATHS)) {
      if (countriesWithPages.has(country)) continue;
      expect(listed.has(`${countryPath}/`)).toBe(false);
    }
  });

  it("removes only representative Singapore and Thailand route pages", () => {
    expect(pages.some((page) => page.country === "singapore")).toBe(false);
    expect(pages.some((page) => page.country === "thailand")).toBe(false);
    expect(pages.some((page) => page.country === "korea")).toBe(true);
    expect(pages.some((page) => page.country === "china")).toBe(true);
    expect(allEntries.some((entry) => entry.url.includes("/singapore/"))).toBe(false);
    expect(allEntries.some((entry) => entry.url.includes("/thailand/"))).toBe(false);
  });

  it("covers every generated route page in every locale", () => {
    const listed = new Set(allEntries.map((entry) => entry.url.replace(SITE_URL, "")));

    for (const page of pages) {
      for (const locale of PRERENDER_LOCALES) {
        expect(listed.has(localeUrlPath(page.urlPath, locale))).toBe(true);
      }
    }
  });
});
