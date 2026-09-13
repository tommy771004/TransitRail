import { describe, expect, it } from "vitest";
import { languageForTimezone } from "./languagePreference";

describe("languageForTimezone", () => {
  it.each([
    ["Asia/Tokyo", "ja"],
    ["Japan", "ja"],
    ["Asia/Seoul", "ko"],
    ["ROK", "ko"],
    ["Asia/Shanghai", "zh-TW"],
    ["Asia/Chongqing", "zh-TW"],
    ["Asia/Urumqi", "zh-TW"],
    ["Asia/Taipei", "zh-TW"],
    ["PRC", "zh-TW"],
    ["ROC", "zh-TW"],
  ] as const)("uses the local language for %s", (timezone, expected) => {
    expect(languageForTimezone(timezone)).toBe(expected);
  });

  it.each(["Asia/Hong_Kong", "Asia/Singapore", "Europe/Paris", "America/New_York", "UTC", undefined])(
    "defaults %s to English",
    (timezone) => {
      expect(languageForTimezone(timezone)).toBe("en");
    },
  );
});
