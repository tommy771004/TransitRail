/**
 * Contract for the generated station labels.
 *
 * These files are written by `npm run sync:station-i18n` from each market's own
 * station directory, so the tests here guard the properties a generator can
 * silently break: that the shipped file is the one the artifacts describe, that
 * every label is sourced and Traditional where it claims to be, and — the rule
 * the Singapore catalog broke once already — that a generated label can never
 * take a name away from the curated dictionaries.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { configuredCountryOptions } from "./countries";
import { generatedLabelCountries, generatedLabelsFor, type GeneratedStationLocale } from "./generatedStationLabels";
import { stationLabel } from "../utils/stationLabel";
import { stationOverrides } from "./stationOverrides";
import type { Country } from "../types";

const LOCALES: GeneratedStationLocale[] = ["zh-TW", "ja", "ko"];
const ARTIFACT_DIR = resolve(__dirname, "catalog/station-i18n");

interface Artifact {
  country: Country;
  directorySource: string;
  stations: Record<string, Partial<Record<GeneratedStationLocale, {
    label: string;
    sourceKind: string;
    sourceUrl: string;
    sourceLocale: string;
    converted?: boolean;
  }>>>;
}

function artifacts(): Artifact[] {
  return readdirSync(ARTIFACT_DIR)
    .filter((file) => file.endsWith(".json") && file !== "labels.json")
    .map((file) => JSON.parse(readFileSync(resolve(ARTIFACT_DIR, file), "utf8")) as Artifact);
}

/**
 * Simplified-only forms that turn up in mainland Chinese station names. The
 * sync pushes every Chinese source through MediaWiki's zh-tw converter, so one
 * of these in a shipped label means a label bypassed the conversion.
 */
const SIMPLIFIED_ONLY = /[车铁东门尔华国际场园桥湾岛县兰罗纳维亚贝圣龙广汉阳达顿泽义丽苏学边岭满两师韦]/;

describe("generated station labels", () => {
  it("only ships configured markets and shipped locales", () => {
    for (const country of generatedLabelCountries()) {
      expect(configuredCountryOptions, `${country} is not a configured market`).toContain(country);
      for (const locale of LOCALES) {
        for (const [name, label] of Object.entries(generatedLabelsFor(country, locale))) {
          expect(label.trim(), `${country}/${locale}/${name}`).not.toBe("");
          expect(label, `${country}/${locale}/${name} repeats the English name`).not.toBe(name);
        }
      }
    }
  });

  it("ships Traditional Chinese, not the Simplified source text", () => {
    for (const country of generatedLabelCountries()) {
      for (const [name, label] of Object.entries(generatedLabelsFor(country, "zh-TW"))) {
        expect(SIMPLIFIED_ONLY.test(label), `${country}/${name}: ${label}`).toBe(false);
      }
    }
  });

  it("never overrides a curated dictionary name", () => {
    for (const locale of LOCALES) {
      const t = i18n.getFixedT(locale, "translation");
      for (const country of generatedLabelCountries()) {
        for (const name of Object.keys(generatedLabelsFor(country, locale))) {
          // A country-scoped override outranks the flat entry for this market;
          // everything else must render exactly what the flat dictionary says.
          const override = locale === "zh-TW" ? stationOverrides[country]?.[name] : undefined;
          const curated = override || t(`station.${name}`, { defaultValue: "" });
          if (!curated || curated === name) continue;
          expect(stationLabel(t, name, country), `${country}/${locale}/${name}`).toBe(curated);
        }
      }
    }
  });

  it("carries reviewable provenance for every shipped label", () => {
    for (const artifact of artifacts()) {
      for (const [name, labels] of Object.entries(artifact.stations)) {
        for (const locale of LOCALES) {
          const entry = labels[locale];
          if (!entry) continue;
          expect(["wikipedia", "official", "wikidata"], `${name}/${locale}`).toContain(entry.sourceKind);
          expect(entry.sourceUrl, `${name}/${locale}`).toMatch(/^https:\/\//);
          expect(entry.sourceLocale, `${name}/${locale}`).not.toBe("");
        }
      }
    }
  });

  it("keeps the shipped file in step with the per-market artifacts", () => {
    // labels.json is generated from the artifacts; a hand edit here is a
    // silent, unsourced translation, which is what the artifacts exist to
    // prevent. Read the file itself, not the runtime map, which additionally
    // folds in Singapore's own generated catalog.
    const shippedFile = JSON.parse(readFileSync(resolve(ARTIFACT_DIR, "labels.json"), "utf8")) as
      Record<string, Partial<Record<GeneratedStationLocale, Record<string, string>>>>;
    for (const artifact of artifacts()) {
      for (const locale of LOCALES) {
        const expected = Object.fromEntries(
          Object.entries(artifact.stations)
            .map(([name, labels]) => [name, labels[locale]?.label])
            .filter((entry): entry is [string, string] => Boolean(entry[1]) && entry[1] !== entry[0]),
        );
        expect(shippedFile[artifact.country]?.[locale] || {}, `${artifact.country}/${locale}`)
          .toEqual(expected);
      }
    }
  });

  it("keeps every artifact label reachable through the runtime map", () => {
    for (const artifact of artifacts()) {
      for (const locale of LOCALES) {
        const shipped = generatedLabelsFor(artifact.country, locale);
        for (const [name, labels] of Object.entries(artifact.stations)) {
          const label = labels[locale]?.label;
          if (!label || label === name) continue;
          expect(shipped[name], `${artifact.country}/${locale}/${name}`).toBeTruthy();
        }
      }
    }
  });
});
