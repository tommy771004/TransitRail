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
    "result.completeness_sampled",
    "result.completeness_unknown",
    "result.retry",
    "result.change_search",
    "result.date_unavailable_title",
    "result.no_matching_departures",
    "search.date_unavailable",
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

/**
 * The notifications page is read at a glance, so a missing key there does not
 * degrade quietly: i18next renders the key itself, and "alerts.no_situations"
 * is exactly the kind of engineer wording this page was cleaned of. Two of
 * these blocks shipped as inline zh/en ternaries, which meant ja and ko readers
 * got English on their own notifications page.
 */
describe("notification copy exists in every shipped locale", () => {
  const keys = [
    "alerts.service_status",
    "alerts.updating",
    "alerts.no_situations",
    "alerts.my_notifications",
    "alerts.related_situation",
    "alerts.timetable_updated",
    "alerts.empty_title",
    "alerts.empty_body",
    "alerts.severity.major",
    "alerts.severity.minor",
    "alerts.severity.info",
    "alerts.departure_approaching",
    "alerts.departure_approaching_body",
    "timetable_change.service_date",
    "timetable_change.service_day",
    "timetable_change.first_service",
    "timetable_change.last_service",
    "timetable_change.more_departures",
    "timetable_change.fewer_departures",
    "snack.offline_cached",
    "snack.trip_copied",
    "snack.share_failed",
    "snack.route_added",
    "snack.route_removed",
  ];

  for (const lng of LOCALES) {
    it(`${lng} speaks its own language on the notifications page`, () => {
      const t = i18n.getFixedT(lng, "translation");
      for (const key of keys) {
        const rendered = t(key, { count: 2, date: "Sep 8", type: "Saturday", time: "23:45", previous: "23:50", service: "Test" });
        expect(rendered, `${lng}: ${key}`).not.toContain(key.split(".").pop());
        expect(rendered.length, `${lng}: ${key}`).toBeGreaterThan(0);
      }
    });
  }
});

/**
 * The service-day enum is a key, never a label. It reached the notifications
 * page verbatim ("Service day changed from weekday to saturday") because the
 * message was built by string concatenation instead of through i18next.
 */
describe("service-day names are translated in every shipped locale", () => {
  for (const lng of LOCALES) {
    it(`${lng} names every service day`, () => {
      const t = i18n.getFixedT(lng, "translation");
      for (const type of ["weekday", "saturday", "sunday_holiday", "special"]) {
        const label = t(`service_day.type.${type}`);
        expect(label, `${lng}: ${type}`).not.toBe(type);
        expect(label, `${lng}: ${type}`).not.toContain("_");
      }
    });
  }
});
