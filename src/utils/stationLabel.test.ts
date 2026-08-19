import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { countryConfig } from "../data/countries";
import { getStaticMenuStations } from "../data/stationIdentity";
import type { Country } from "../types";
import { stationLabel, stationListLabel } from "./stationLabel";

describe("localised station labels", () => {
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

  it("covers live-provider aliases without changing their query identity", () => {
    const t = i18n.getFixedT("zh-TW", "translation");
    expect(stationLabel(t, "Canning Town Station", "united_kingdom")).toBe("景寧鎮站");
    expect(stationLabel(t, "Logan International Airport", "united_states")).toBe("洛根國際機場");
    expect(stationLabel(t, "Antwerpen-Centraal", "belgium")).toBe("安特衛普中央車站");
    expect(stationLabel(t, "Antwerp-Central", "belgium")).toBe("安特衛普中央車站");
  });

  it("uses sourced Traditional Chinese names for live Belgian stations", () => {
    const t = i18n.getFixedT("zh-TW", "translation");

    // Both come from the station's zh.wikipedia.org article title, converted to
    // Traditional: 亚琛火车总站 and 阿尔斯特站.
    expect(stationLabel(t, "Aachen Hbf", "belgium")).toBe("亞琛火車總站");
    expect(stationLabel(t, "Aalst", "belgium")).toBe("阿爾斯特站");
  });

  it("keeps the operator's own name when no source publishes a translation", () => {
    // 269 of iRail's 714 stations are halts no encyclopedia and no operator
    // names in Chinese, Japanese or Korean. Showing "Aarsele" is the correct
    // answer there; inventing a transliteration would not be.
    for (const locale of ["zh-TW", "ja", "ko"] as const) {
      expect(stationLabel(i18n.getFixedT(locale, "translation"), "Aarsele", "belgium"))
        .toBe("Aarsele");
    }
  });

  it("labels stations in Japanese and Korean, not just Chinese", () => {
    // Sourced from the ja/ko Wikipedia article titles for the same station.
    expect(stationLabel(i18n.getFixedT("ja", "translation"), "Akasaka-mitsuke", "japan"))
      .toBe("赤坂見附駅");
    expect(stationLabel(i18n.getFixedT("ko", "translation"), "Akasaka-mitsuke", "japan"))
      .toBe("아카사카미쓰케역");
    expect(stationLabel(i18n.getFixedT("ja", "translation"), "Aachen Hbf", "belgium"))
      .toBe("アーヘン中央駅");
  });

  it("localizes transfer-station lists without changing their stored names", () => {
    const names = ["Admiralty", "City Hall"];
    expect(stationListLabel(i18n.getFixedT("zh-TW", "translation"), names, "singapore"))
      .toBe("海軍部, 政府大廈");
    expect(names).toEqual(["Admiralty", "City Hall"]);
  });
});
