import { describe, expect, it } from "vitest";
import { countryConfig } from "../data/countries";
import { hasTimezoneCity, timezoneCity } from "./timezoneCity";

describe("timezoneCity", () => {
  it("names every market's zone by its city", () => {
    for (const config of Object.values(countryConfig)) {
      expect(hasTimezoneCity(config.timeZone), config.timeZone).toBe(true);
    }
  });

  it("reads in the UI language, English for an unshipped one, and falls back to the IANA city", () => {
    expect(timezoneCity("Asia/Tokyo", "zh-TW")).toBe("東京");
    expect(timezoneCity("Asia/Seoul", "ko")).toBe("서울");
    expect(timezoneCity("Asia/Kuala_Lumpur", "de")).toBe("Kuala Lumpur");
    expect(timezoneCity("America/Port_of_Spain", "en")).toBe("Port of Spain");
  });
});
