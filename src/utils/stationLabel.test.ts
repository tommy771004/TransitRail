import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { countryConfig } from "../data/countries";
import { getStaticMenuStations } from "../data/stationIdentity";
import type { Country } from "../types";
import { stationLabel } from "./stationLabel";

describe("zh-TW station labels", () => {
  it("translates every station in each static country menu", () => {
    const t = i18n.getFixedT("zh-TW", "translation");

    for (const country of Object.keys(countryConfig) as Country[]) {
      const stations = getStaticMenuStations(country);
      if (!stations) continue;

      for (const station of stations) {
        expect(stationLabel(t, station, country), `${country}: ${station}`)
          .not.toBe(station);
      }
    }
  });
});
