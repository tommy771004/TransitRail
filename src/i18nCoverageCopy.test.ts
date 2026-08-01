/**
 * The no-timetable copy must exist in every shipped locale.
 *
 * The pictured bug surfaced to a zh-TW user, and a missing key would have
 * rendered the raw key string in the panel that replaced the red error block.
 */
import { describe, expect, it } from "vitest";
import i18n from "./i18n";

describe("coverage copy exists in every shipped locale", () => {
  for (const lng of ["en", "zh-TW", "ja", "ko"]) {
    it(`${lng} renders the not-covered block and picker badge`, () => {
      const t = i18n.getFixedT(lng, "translation");
      const body = t("result.not_covered_body", { stations: "清涼里" });
      expect(body).toContain("清涼里");
      expect(body).not.toContain("not_covered_body");
      for (const key of [
        "result.not_covered_title",
        "result.not_covered_suggestions",
        "stations.no_timetable",
        "stations.no_timetable_hint",
      ]) {
        expect(t(key), `${lng} ${key}`).not.toContain(key.split(".")[1]);
      }
    });
  }
});
