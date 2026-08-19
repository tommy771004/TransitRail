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

  it("uses the checked-in Wikipedia language mapping for Singapore stations", () => {
    // Display names, not Wikipedia article titles: no 站/駅/역 and no
    // disambiguation suffix, matching the curated dictionaries.
    expect(stationLabel(i18n.getFixedT("zh-TW", "translation"), "Jurong East", "singapore"))
      .toBe("裕廊東");
    expect(stationLabel(i18n.getFixedT("ja", "translation"), "Jurong East", "singapore"))
      .toBe("ジュロン・イースト");
    expect(stationLabel(i18n.getFixedT("ko", "translation"), "Jurong East", "singapore"))
      .toBe("주롱이스트");
    expect(stationLabel(i18n.getFixedT("zh-TW", "translation"), "Redhill", "singapore"))
      .toBe("紅山");
  });

  it("never lets the generated Singapore directory reassign a curated name", () => {
    const t = i18n.getFixedT("zh-TW", "translation");
    // "Admiralty" belongs to two networks. The flat dictionary holds Hong
    // Kong's 金鐘 and `stationOverrides` scopes Singapore's 海軍部, so a
    // generated file must never write over the shared key.
    expect(stationLabel(t, "Admiralty", "hong_kong")).toBe("金鐘");
    expect(stationLabel(t, "Admiralty", "singapore")).toBe("海軍部");
    expect(stationLabel(t, "City Hall", "korea")).toBe("市廳");
    expect(stationLabel(t, "City Hall", "singapore")).toBe("政府大廈");
  });
});
