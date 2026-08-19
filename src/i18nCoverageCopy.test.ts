/**
 * The no-timetable copy must exist in every shipped locale.
 *
 * The pictured bug surfaced to a zh-TW user, and a missing key would have
 * rendered the raw key string in the panel that replaced the red error block.
 * The body is pluralised because a search can miss on one endpoint or both.
 */
import { describe, expect, it } from "vitest";
import i18n from "./i18n";
import { countryConfig } from "./data/countries";

const LOCALES = ["en", "zh-TW", "ja", "ko"];

describe("coverage copy exists in every shipped locale", () => {
  for (const lng of LOCALES) {
    it(`${lng} renders the not-covered block and picker badge`, () => {
      const t = i18n.getFixedT(lng, "translation");

      for (const count of [1, 2]) {
        const stations = count === 1 ? "清涼里" : "市廳、忠正路";
        const body = t("result.not_covered_body", { count, stations });
        expect(body, `${lng} body count=${count}`).toContain(stations);
        expect(body, `${lng} body count=${count}`).not.toContain("not_covered_body");

        const title = t("result.not_covered_title", { count });
        expect(title, `${lng} title count=${count}`).not.toContain("not_covered_title");
        expect(title.length, `${lng} title count=${count}`).toBeGreaterThan(0);
      }

      for (const key of [
        "result.not_covered_suggestions",
        "result.station_separator",
        "stations.no_timetable",
        "stations.no_timetable_hint",
      ]) {
        expect(t(key), `${lng} ${key}`).not.toContain(key.split(".")[1]);
      }
    });
  }
});

describe("English subject/verb agreement", () => {
  const t = i18n.getFixedT("en", "translation");

  it("uses a singular verb for one uncovered station", () => {
    expect(t("result.not_covered_body", { count: 1, stations: "Cheongnyangni" }))
      .toBe("Cheongnyangni appears on the network map, but TransitRail has no timetable data for it yet.");
    expect(t("result.not_covered_title", { count: 1 })).toBe("This station has no timetable yet");
  });

  it("uses a plural verb when both endpoints are uncovered", () => {
    // "City Hall, Chungjeongno appears" read as a grammar bug in the shipped UI.
    expect(t("result.not_covered_body", { count: 2, stations: "City Hall, Chungjeongno" }))
      .toBe("City Hall, Chungjeongno appear on the network map, but TransitRail has no timetable data for them yet.");
    expect(t("result.not_covered_title", { count: 2 })).toBe("These stations have no timetable yet");
  });
});

describe("station browser i18n coverage", () => {
  const stationKeys = [
    "stations.search_label",
    "stations.search_placeholder",
    "stations.clear_search",
    "stations.loading",
    "stations.unavailable",
    "stations.invalid_country",
    "stations.none",
    "stations.featured",
    "stations.accessible",
    "stations.direct_route",
    "stations.transfer",
    "stations.transfers",
    "stations.official_source",
    "stations.catalog_only_no_timetable",
    "stations.no_registered_timetable_source",
    "stations.no_verified_timetable_for_date",
    "stations.no_verified_timetable_current",
    "stations.no_verified_searchable_lines_for_date",
    "stations.no_verified_destinations_for_origin",
  ];
  const regionKeys = [...new Set(Object.values(countryConfig).flatMap((country) =>
    country.marketTopology.regions.map((region) => `service_region.${region.id}`),
  ))];

  for (const lng of LOCALES) {
    it(`${lng} has every station-browser UI key without falling back to English`, () => {
      for (const key of [...stationKeys, ...regionKeys]) {
        expect(i18n.exists(key, { lng, fallbackLng: false }), `${lng}: ${key}`).toBe(true);
      }
    });
  }
});

describe("result-slice copy exists in every shipped locale", () => {
  const keys = [
    "result.completeness_bounded_upcoming",
    "result.overview_label",
    "result.first_shown",
    "result.last_shown",
    "result.last_shown_departed",
    "result.minutes_until_last_shown",
  ];

  for (const lng of LOCALES) {
    it(`${lng} describes displayed rows without claiming they are first/last service`, () => {
      const t = i18n.getFixedT(lng, "translation");
      for (const key of keys) {
        expect(i18n.exists(key, { lng, fallbackLng: false }), `${lng}: ${key}`).toBe(true);
        expect(t(key, { count: 12 }), `${lng}: ${key}`).not.toContain(key.split(".")[1]);
      }
    });
  }
});
