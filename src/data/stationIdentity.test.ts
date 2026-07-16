import { describe, expect, it } from "vitest";
import { stationSearchKey } from "./stationKey";
import {
  getHongKongStationCode,
  getHongKongStationName,
  getProviderStationCode,
  getProviderStationName,
  getStaticMenuStations,
  isStationInMenu,
  missingRouteEndpoints,
} from "./stationIdentity";

describe("stationSearchKey", () => {
  it("lowercases and trims so search matches menu names case-insensitively", () => {
    expect(stationSearchKey("  Tokyo ")).toBe("tokyo");
    expect(stationSearchKey("Shin-Osaka")).toBe("shin-osaka");
  });
});

describe("isStationInMenu", () => {
  it("matches menu membership by search key, not raw casing", () => {
    const menu = ["Tokyo", "Shin-Osaka", "Kyoto"];
    expect(isStationInMenu(menu, "tokyo")).toBe(true);
    expect(isStationInMenu(menu, "  SHIN-OSAKA ")).toBe(true);
    expect(isStationInMenu(menu, "Nagoya")).toBe(false);
  });
});

describe("getStaticMenuStations", () => {
  it("returns a non-empty static menu for Japan including scraped endpoints", () => {
    const menu = getStaticMenuStations("japan");
    expect(menu).not.toBeNull();
    expect(menu!.length).toBeGreaterThan(10);
    expect(isStationInMenu(menu!, "Tokyo")).toBe(true);
    expect(isStationInMenu(menu!, "Shin-Osaka")).toBe(true);
  });

  it("returns null for live-provider menus that cannot be audited offline", () => {
    expect(getStaticMenuStations("united_kingdom")).toBeNull();
    expect(getStaticMenuStations("united_states")).toBeNull();
    expect(getStaticMenuStations("belgium")).toBeNull();
  });

  it("unions featured list with line graph stations for Switzerland (no audit/catalog drift)", () => {
    // newCountryStationLists alone is incomplete if line topology adds names;
    // both catalog and audit must use the same union.
    const menu = getStaticMenuStations("switzerland");
    expect(menu).not.toBeNull();
    expect(isStationInMenu(menu!, "Zürich HB")).toBe(true);
    expect(isStationInMenu(menu!, "Genève")).toBe(true);
  });

  it("merges Korea rail + Seoul subway into one menu", () => {
    const menu = getStaticMenuStations("korea");
    expect(menu).not.toBeNull();
    expect(isStationInMenu(menu!, "Seoul (SNC)")).toBe(true);
    // Seoul subway name that is not a Korail long-distance station
    expect(menu!.length).toBeGreaterThan(100);
  });
});

describe("missingRouteEndpoints", () => {
  it("lists origin/destination names absent from the menu", () => {
    const menu = ["Tokyo", "Kyoto"];
    expect(missingRouteEndpoints(menu, "Tokyo", "Kyoto")).toEqual([]);
    expect(missingRouteEndpoints(menu, "Tokyo", "Nagoya")).toEqual(['destination "Nagoya"']);
    expect(missingRouteEndpoints(menu, "Osaka", "Nagoya")).toEqual([
      'origin "Osaka"',
      'destination "Nagoya"',
    ]);
  });

  it("skips name checks when menu is null (live provider)", () => {
    expect(missingRouteEndpoints(null, "Anywhere", "Else")).toEqual([]);
  });
});

describe("Hong Kong MTR provider codes", () => {
  it("resolves English station names to MTR Next Train station codes", () => {
    expect(getHongKongStationCode("Admiralty")).toBe("ADM");
    expect(getHongKongStationCode("Hong Kong")).toBe("HOK");
    expect(getHongKongStationCode("Central")).toBe("CEN");
    // Case / whitespace must match search key rules
    expect(getHongKongStationCode("  tsim sha tsui ")).toBe("TST");
    // Multi-country wrappers delegate to HK only
    expect(getProviderStationCode("hong_kong", "Admiralty")).toBe("ADM");
  });

  it("resolves MTR codes back to the canonical English menu name", () => {
    expect(getHongKongStationName("ADM")).toBe("Admiralty");
    expect(getHongKongStationName("HOK")).toBe("Hong Kong");
    expect(getHongKongStationName("adm")).toBe("Admiralty");
    expect(getProviderStationName("hong_kong", "ADM")).toBe("Admiralty");
  });

  it("returns undefined for unknown names, codes, or non-HK countries", () => {
    expect(getHongKongStationCode("Not A Station")).toBeUndefined();
    expect(getHongKongStationName("XXX")).toBeUndefined();
    expect(getProviderStationCode("japan", "Tokyo")).toBeUndefined();
    expect(getProviderStationName("japan", "ADM")).toBeUndefined();
  });

  it("every static HK menu station has a provider code", () => {
    const menu = getStaticMenuStations("hong_kong");
    expect(menu).not.toBeNull();
    for (const name of menu!) {
      expect(getHongKongStationCode(name), name).toBeTruthy();
    }
  });
});
