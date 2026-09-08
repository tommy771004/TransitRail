import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { configuredCountryOptions } from "../src/data/countries";

const DATE_VALUE = /^\d{4}-\d{2}-\d{2}$/;
const catalogDir = resolve("public/catalog");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inclusiveDays(start: string, end: string): number {
  return Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  ) + 1;
}

describe("generated nightly publication", () => {
  it("contains one structurally valid, date-consistent station catalog per configured market", () => {
    const files = readdirSync(catalogDir)
      .filter((file) => file.endsWith(".json"))
      .sort();
    expect(files).toEqual(configuredCountryOptions.map((country) => `${country}.json`).sort());

    for (const file of files) {
      const parsed: unknown = JSON.parse(readFileSync(resolve(catalogDir, file), "utf8"));
      expect(isRecord(parsed), `${file} must contain an object`).toBe(true);
      if (!isRecord(parsed)) continue;

      expect(parsed.country).toBe(basename(file, ".json"));
      expect(configuredCountryOptions).toContain(parsed.country);
      expect(parsed.serviceDate).toMatch(DATE_VALUE);
      expect(Array.isArray(parsed.regions)).toBe(true);
      expect(Array.isArray(parsed.lines)).toBe(true);
      expect(Array.isArray(parsed.stations)).toBe(true);

      const stations = parsed.stations as unknown[];
      expect(stations.every((station) => typeof station === "string" && station.trim().length > 0)).toBe(true);
      expect(new Set(stations).size).toBe(stations.length);

      expect(isRecord(parsed.coverage), `${file} must contain coverage`).toBe(true);
      if (!isRecord(parsed.coverage)) continue;
      expect(["provider", "scraped"]).toContain(parsed.coverage.mode);
      if (parsed.coverage.date !== undefined) expect(parsed.coverage.date).toBe(parsed.serviceDate);

      const range = parsed.coverage.dateRange;
      if (range === undefined) continue;
      expect(isRecord(range), `${file} coverage.dateRange must be an object`).toBe(true);
      if (!isRecord(range)) continue;
      expect(range.start).toMatch(DATE_VALUE);
      expect(range.end).toMatch(DATE_VALUE);
      expect(range.liveOnly).toEqual(expect.any(Boolean));
      expect(range.days).toBe(inclusiveDays(String(range.start), String(range.end)));
      expect(String(range.start) <= String(parsed.serviceDate)).toBe(true);
      expect(String(parsed.serviceDate) <= String(range.end)).toBe(true);
    }
  });

  it("publishes a complete source coverage report for every configured market", () => {
    const report = readFileSync(resolve("SOURCE_COVERAGE.md"), "utf8");
    expect(report).toContain("Generated ");
    expect(report).toContain("src/data/sourceRegistry.ts");
    expect(report).toContain(`${configuredCountryOptions.length} configured markets`);
    for (const country of configuredCountryOptions) {
      expect(report, `coverage report is missing ${country}`).toMatch(
        new RegExp(`\\| [^\\n|]*\\b${country} \\|`),
      );
    }
  });
});
