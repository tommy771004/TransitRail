import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { configuredCountryOptions } from "../src/data/countries";
import { isServiceRegionCatalog } from "../src/data/serviceRegionCatalog";
import { auditCountry, buildReport } from "./audit-source-coverage";

const catalogDir = resolve("public/catalog");

describe("generated nightly publication", () => {
  it("contains one structurally valid, date-consistent station catalog per configured market", () => {
    const files = readdirSync(catalogDir)
      .filter((file) => file.endsWith(".json"))
      .sort();
    expect(files).toEqual(configuredCountryOptions.map((country) => `${country}.json`).sort());

    for (const file of files) {
      const parsed: unknown = JSON.parse(readFileSync(resolve(catalogDir, file), "utf8"));
      expect(isServiceRegionCatalog(parsed, { country: basename(file, ".json") }), `${file} must satisfy the shared catalog contract`).toBe(true);
    }
  });

  it("publishes a complete source coverage report for every configured market", async () => {
    const report = readFileSync(resolve("SOURCE_COVERAGE.md"), "utf8");
    expect(report).toContain("Generated ");
    if (process.env.PUBLICATION_STARTED_AT) {
      const generated = report.match(/Generated (\S+) by/)?.[1];
      expect(generated).toBeDefined();
      const date = new Date(generated!);
      expect(date.getTime()).toBeGreaterThanOrEqual(Date.parse(process.env.PUBLICATION_STARTED_AT));
      expect(date.getTime()).toBeLessThanOrEqual(Date.now());
      const audits = await Promise.all(configuredCountryOptions.map(country => auditCountry(country, date)));
      expect(report).toBe(buildReport(audits, date));
    }
    expect(report).toContain("src/data/sourceRegistry.ts");
    expect(report).toContain(`${configuredCountryOptions.length} configured markets`);
    for (const country of configuredCountryOptions) {
      expect(report, `coverage report is missing ${country}`).toMatch(
        new RegExp(`\\| [^\\n|]*\\b${country} \\|`),
      );
    }
  }, 60_000);
});
