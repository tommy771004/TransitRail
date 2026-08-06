import { describe, expect, it } from "vitest";
import {
  ARTIFACT_VERSION,
  buildSourceMeta,
  findOfficialSource,
  isRegisteredSource,
  isValidSourceMeta,
  officialSources,
  officialSourcesForCountry,
  tierForSourceType,
} from "./sourceRegistry";

describe("official source register", () => {
  it("keys every entry by its own id", () => {
    for (const [key, source] of Object.entries(officialSources)) {
      expect(source.id).toBe(key);
    }
  });

  it("gives every source a resolvable https URL a passenger can open", () => {
    for (const source of Object.values(officialSources)) {
      expect(source.sourceUrl).toMatch(/^https:\/\//);
      expect(source.provider.trim()).not.toBe("");
      expect(source.sourceName.trim()).not.toBe("");
    }
  });

  it("derives tier from the artifact type rather than storing it twice", () => {
    expect(tierForSourceType("official-gtfs")).toBe("A");
    expect(tierForSourceType("official-json")).toBe("A");
    expect(tierForSourceType("official-browser")).toBe("B");
    expect(tierForSourceType("official-html")).toBe("C");
    expect(tierForSourceType("official-pdf")).toBe("C");
  });

  it("treats an unregistered id as unverified rather than as a new source", () => {
    expect(isRegisteredSource("jp-odpt-toei")).toBe(true);
    expect(isRegisteredSource("some-blog-post")).toBe(false);
    expect(findOfficialSource(undefined)).toBeUndefined();
  });

  it("lists sources per country", () => {
    const japan = officialSourcesForCountry("japan").map((source) => source.id);
    expect(japan).toContain("jp-jr-central");
    expect(japan).not.toContain("uk-tfl-journey-planner");
  });
});

describe("buildSourceMeta", () => {
  it("stamps the registered facts so a route cannot describe itself", () => {
    const meta = buildSourceMeta({ sourceId: "de-gtfs", fetchedAt: "2026-08-06T00:00:00.000Z" });
    expect(meta).toMatchObject({
      sourceId: "de-gtfs",
      sourceType: "official-gtfs",
      sourceTier: "A",
      provider: "gtfs.de",
      country: "germany",
      completeness: "full-timetable",
      verified: true,
      artifactVersion: ARTIFACT_VERSION,
    });
  });

  it("lets a run report less than its source's ceiling", () => {
    const meta = buildSourceMeta({ sourceId: "uk-tfl-journey-planner", completeness: "service-hours" });
    expect(meta.completeness).toBe("service-hours");
  });

  it("refuses to let a frequency-only source claim a full timetable", () => {
    expect(() => buildSourceMeta({
      sourceId: "th-bem-service-hours",
      completeness: "full-timetable",
    })).toThrow(/at most frequency-only/);
  });

  it("refuses an unregistered source outright", () => {
    expect(() => buildSourceMeta({
      // @ts-expect-error deliberately unregistered
      sourceId: "cn-some-aggregator",
    })).toThrow(/Unregistered timetable source/);
  });
});

describe("isValidSourceMeta", () => {
  const valid = buildSourceMeta({ sourceId: "be-irail", fetchedAt: "2026-08-06T00:00:00.000Z" });

  it("accepts a block this pipeline wrote", () => {
    expect(isValidSourceMeta(valid)).toBe(true);
  });

  it("rejects a block whose url was edited away from the register", () => {
    expect(isValidSourceMeta({ ...valid, sourceUrl: "https://example.invalid" })).toBe(false);
  });

  it("rejects a block that upgrades its own tier", () => {
    expect(isValidSourceMeta({ ...valid, sourceTier: "A", sourceType: "official-pdf" })).toBe(false);
  });

  it("rejects a block claiming more completeness than its source supports", () => {
    const bem = buildSourceMeta({ sourceId: "th-bem-service-hours" });
    expect(isValidSourceMeta({ ...bem, completeness: "full-timetable" })).toBe(false);
  });

  it("rejects missing or unparseable fetch times", () => {
    expect(isValidSourceMeta({ ...valid, fetchedAt: "yesterday" })).toBe(false);
    expect(isValidSourceMeta({ ...valid, fetchedAt: undefined })).toBe(false);
  });

  it("rejects anything that is not an object", () => {
    expect(isValidSourceMeta(undefined)).toBe(false);
    expect(isValidSourceMeta("official")).toBe(false);
  });
});
