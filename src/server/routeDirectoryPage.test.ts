import { describe, expect, it } from "vitest";
import { renderHubPage } from "../../scripts/generate-route-pages";
import type { RoutePageData } from "../../scripts/lib/routePages";

function route(overrides: Pick<RoutePageData, "country" | "countryPath" | "origin" | "destination" | "urlPath">): RoutePageData {
  return {
    ...overrides,
    slug: overrides.urlPath.split("/").filter(Boolean).at(-1) || "route",
    canonicalDate: "2026-09-13",
    scrapedAt: "2026-09-13T00:00:00.000Z",
    source: "Official fixture",
    indicative: false,
    truthMode: "verified",
    provenance: "official",
    dayResults: [],
  };
}

const pages: RoutePageData[] = [
  route({
    country: "japan",
    countryPath: "/japan",
    origin: "Tokyo",
    destination: "Kyoto",
    urlPath: "/japan/tokyo-to-kyoto/",
  }),
  route({
    country: "korea",
    countryPath: "/korea",
    origin: "Seoul (SNC)",
    destination: "Busan (BSN)",
    urlPath: "/korea/seoul-to-busan/",
  }),
];

describe("route directory page", () => {
  it("collapses the route overview by default while keeping totals visible", () => {
    const html = renderHubPage(pages, "zh");
    const summary = html.match(/<summary class="hero-summary">([\s\S]*?)<\/summary>/)?.[1];
    const details = html.match(/<div class="hero-details">([\s\S]*?)<\/div>/)?.[1];

    expect(html).toContain('<details class="hero hero-disclosure">');
    expect(html).not.toContain('<details class="hero hero-disclosure" open>');
    expect(summary).toContain("所有列車路線時刻表");
    expect(summary).toContain("2 條路線");
    expect(summary).toContain("2 個國家");
    expect(summary).not.toContain("瀏覽 TransitRail 全部起訖站時刻表");
    expect(details).toContain("瀏覽 TransitRail 全部起訖站時刻表");
  });

  it("lays out country filters beside the route results with a mobile horizontal fallback", () => {
    const html = renderHubPage(pages, "en");

    expect(html).toContain('class="route-directory-layout"');
    expect(html).toContain('<aside class="directory-tools">');
    expect(html).toContain('class="route-results"');
    expect(html).toContain('data-country-filter="japan"');
    expect(html).toContain('data-country-section="japan"');
    expect(html).toContain("grid-template-columns:14.5rem minmax(0,1fr)");
    expect(html).toContain("@media(max-width:42rem)");
    expect(html).toContain(".country-filter{flex-direction:row");
  });

  it("keeps each station pair and timetable action in one compact row", () => {
    const html = renderHubPage(pages, "zh");

    expect(html).toContain(".route-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center");
    expect(html).toContain("min-height:3.2rem;padding:.65rem .8rem");
    expect(html).toContain('<span class="route-pair"><span>東京</span><span class="route-arrow"');
    expect(html).toContain('<span class="route-action">時刻表');
    expect(html).not.toContain(".route-card{display:flex;flex-direction:column");
  });

  it("reveals data rows as they enter the viewport and respects reduced motion", () => {
    const html = renderHubPage(pages, "zh");

    expect(html).toContain('querySelectorAll("tbody>tr, ul.links>li")');
    expect(html).toContain('new IntersectionObserver((entries)=>');
    expect(html).toContain('row.classList.add("scroll-fade")');
    expect(html).toContain('entry.target.classList.add("is-visible")');
    expect(html).toContain('(prefers-reduced-motion: reduce)');
    expect(html).toContain('.scroll-fade{opacity:1;transition:none}');
  });

  it("renders the language control as a select and includes timezone defaults", () => {
    const html = renderHubPage(pages, "en");

    expect(html).toContain('<select id="language-select" aria-label="Language">');
    expect(html).toContain('<option value="zh">中文</option>');
    expect(html).toContain('"Asia/Tokyo":"ja"');
    expect(html).toContain('"Asia/Seoul":"ko"');
    expect(html).toContain('"Asia/Taipei":"zh"');
    expect(html).toContain('||"en"');
  });

  it("localizes country controls, route labels and station names", () => {
    const html = renderHubPage(pages, "zh");

    expect(html).toContain("依國家篩選");
    expect(html).toContain("所有國家");
    expect(html).toContain("日本");
    expect(html).toContain("東京");
    expect(html).toContain("京都");
    expect(html).toContain("時刻表");
    expect(html).toContain('aria-label="東京 → 京都, 時刻表"');
  });
});
