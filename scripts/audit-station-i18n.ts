/**
 * Report how much of each market's station directory the app can actually
 * display in zh-TW, ja and ko — and how much of it still falls back to the
 * operator's English/local spelling.
 *
 * The station universe is read offline: the static menu list for markets that
 * have one, plus the names in the committed station-i18n artifact for the
 * markets whose directory is a live provider feed (UK, US, Belgium). That keeps
 * the audit runnable in CI and honest about what shipped, rather than about
 * what a provider happens to return today.
 *
 * A label counts as `curated` when it comes from the hand-maintained i18next
 * dictionaries, `generated` when it comes from the sourced sync artifacts, and
 * `fallback` when nothing answers and the UI shows the provider's own name.
 *
 *   npx tsx scripts/audit-station-i18n.ts
 *   npx tsx scripts/audit-station-i18n.ts --locale zh-TW --show-missing belgium
 *   npx tsx scripts/audit-station-i18n.ts --conflicts
 */
import i18n from "../src/i18n";
import { configuredCountryOptions } from "../src/data/countries";
import { stationLabel } from "../src/utils/stationLabel";
import { stationOverrides } from "../src/data/stationOverrides";
import { generatedLabelsFor, generatedStationLabel } from "../src/data/generatedStationLabels";
import type { Country } from "../src/types";
import {
  STATION_LOCALES,
  readArtifact,
  staticStationUniverse,
  type StationLocale,
} from "./lib/stationI18n";

interface CountryCoverage {
  country: Country;
  total: number;
  perLocale: Record<StationLocale, { curated: number; generated: number; missing: string[] }>;
}

/** The curated answer for a name, or "" when only a generated source has one. */
function curatedLabel(
  t: ReturnType<typeof i18n.getFixedT>,
  name: string,
  country: Country,
  locale: StationLocale,
): string {
  if (locale === "zh-TW") {
    const override = stationOverrides[country]?.[name];
    if (override) return override;
  }
  const flat = t(`station.${name}`, { defaultValue: "" }) as string;
  return flat && flat !== name ? flat : "";
}

/** Every name the station browser and result views can put on screen. */
function stationUniverse(country: Country): string[] {
  const names = new Set(staticStationUniverse(country));
  for (const name of Object.keys(readArtifact(country)?.stations || {})) names.add(name);
  for (const name of readArtifact(country)?.unresolved || []) names.add(name);
  return [...names].sort();
}

function coverageFor(country: Country): CountryCoverage {
  const names = stationUniverse(country);
  const perLocale = {} as CountryCoverage["perLocale"];
  for (const locale of STATION_LOCALES) {
    const t = i18n.getFixedT(locale, "translation");
    const bucket = { curated: 0, generated: 0, missing: [] as string[] };
    for (const name of names) {
      const label = stationLabel(t, name, country);
      if (label === name) {
        bucket.missing.push(name);
        continue;
      }
      // Classify by which source *answered*, not by which string won: after a
      // sync the two often agree, and counting those as generated would read as
      // if the curated dictionaries had shrunk.
      const curated = curatedLabel(t, name, country, locale);
      if (curated) bucket.curated += 1;
      else bucket.generated += 1;
    }
    perLocale[locale] = bucket;
  }
  return { country, total: names.length, perLocale };
}

function main() {
  const args = process.argv.slice(2);
  const showMissing = args.includes("--show-missing");
  const showConflicts = args.includes("--conflicts");
  const localeArgIndex = args.indexOf("--locale");
  const onlyLocale = localeArgIndex >= 0 ? (args[localeArgIndex + 1] as StationLocale) : undefined;
  const requested = args.filter((arg, index) =>
    !arg.startsWith("--") && args[index - 1] !== "--locale") as Country[];
  const countries = requested.length > 0 ? requested : [...configuredCountryOptions];
  const locales = onlyLocale ? [onlyLocale] : [...STATION_LOCALES];

  const header = ["market", "names", ...locales.flatMap((locale) => [`${locale} labelled`, `${locale} fallback`])];
  const rows: string[][] = [];
  const totals = Object.fromEntries(locales.map((locale) => [locale, { labelled: 0, missing: 0 }]));

  for (const country of countries) {
    const coverage = coverageFor(country);
    if (coverage.total === 0) continue;
    const row = [country, String(coverage.total)];
    for (const locale of locales) {
      const bucket = coverage.perLocale[locale];
      const labelled = bucket.curated + bucket.generated;
      totals[locale].labelled += labelled;
      totals[locale].missing += bucket.missing.length;
      row.push(`${labelled} (${bucket.curated}c/${bucket.generated}g)`, String(bucket.missing.length));
    }
    rows.push(row);
    if (showMissing) {
      for (const locale of locales) {
        const missing = coverage.perLocale[locale].missing;
        if (missing.length > 0) {
          console.log(`\n${country} · ${locale} · ${missing.length} without a sourced label:`);
          console.log(missing.map((name) => `  ${name}`).join("\n"));
        }
      }
    }
  }

  // A flat dictionary entry that is really another market's name is the one
  // conflict that is always a bug: the shared key wins for every market, so the
  // station shows up under a name that belongs to a different network. These
  // need an entry in stationOverrides, not a curated value in the flat dict.
  const shadowed: string[] = [];
  for (const country of countries) {
    for (const locale of locales) {
      const t = i18n.getFixedT(locale, "translation");
      for (const [name, generated] of Object.entries(generatedLabelsFor(country, locale))) {
        // Compare against what the app actually renders, so a curated
        // country-scoped override does not read as a shadowed name.
        const shown = stationLabel(t, name, country);
        if (shown === generated) continue;
        const owner = configuredCountryOptions.find((other) =>
          other !== country && generatedLabelsFor(other, locale)[name] === shown);
        if (owner) {
          shadowed.push(`  ${locale} · ${name}: ${country} shows ${shown} (${owner}'s name) instead of ${generated}`);
        }
      }
    }
  }
  if (shadowed.length > 0) {
    console.log(`\n${shadowed.length} station name(s) shadowed by another market's label:`);
    console.log(shadowed.join("\n"));
  }

  if (showConflicts) {
    // A curated name and a sourced one disagreeing is not an error — the
    // curated one wins by design — but it is the only signal that one of the
    // two is wrong, so it is worth reading after every sync.
    for (const country of countries) {
      for (const locale of locales) {
        const t = i18n.getFixedT(locale, "translation");
        const rows = Object.entries(generatedLabelsFor(country, locale))
          .map(([name, generated]) => [name, t(`station.${name}`, { defaultValue: "" }), generated] as const)
          .filter(([name, curated, generated]) =>
            curated && curated !== generated && curated !== name);
        if (rows.length === 0) continue;
        console.log(`\n${country} · ${locale} · ${rows.length} curated names differ from the sourced label:`);
        for (const [name, curated, generated] of rows) {
          console.log(`  ${name}: curated ${curated} · sourced ${generated}`);
        }
      }
    }
  }

  const widths = header.map((_, column) =>
    Math.max(header[column].length, ...rows.map((row) => row[column].length)));
  const line = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index])).join("  ");
  console.log(`\n${line(header)}`);
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) console.log(line(row));
  console.log();
  for (const locale of locales) {
    const { labelled, missing } = totals[locale];
    const total = labelled + missing;
    const percent = total === 0 ? 0 : Math.round((labelled / total) * 1000) / 10;
    console.log(`${locale}: ${labelled}/${total} station names labelled (${percent}%)`);
  }
  console.log("\nc = curated dictionary, g = sourced sync artifact.");
}

main();
