import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { CHANGELOG, CHANGELOG_LOCALES, changelogLocale } from "./changelog";

describe("changelog", () => {
  it("lists days newest first, each once, as Taipei calendar dates", () => {
    const dates = CHANGELOG.map((day) => day.date);
    for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("writes every entry in every shipped locale", () => {
    for (const day of CHANGELOG) {
      expect(day.items.length).toBeGreaterThan(0);
      for (const item of day.items) {
        expect(["added", "changed", "removed"]).toContain(item.kind);
        for (const locale of CHANGELOG_LOCALES) expect(item.text[locale]?.trim()).toBeTruthy();
      }
    }
  });

  it("labels the dialog and each kind in every shipped locale", () => {
    for (const locale of CHANGELOG_LOCALES) {
      const t = i18n.getFixedT(locale, "translation");
      for (const key of ["title", "close", "added", "changed", "removed"]) {
        expect(t(`changelog.${key}`)).not.toBe(`changelog.${key}`);
      }
    }
  });

  it("reads an unshipped UI language in English", () => {
    expect(changelogLocale("ja")).toBe("ja");
    expect(changelogLocale("de")).toBe("en");
  });
});
