/**
 * Generated station display labels, keyed by market.
 *
 * `src/data/catalog/station-i18n/labels.json` is produced by
 * `npm run sync:station-i18n` from each market's own station directory. Every
 * label in it was sourced — a Wikipedia article title, an operator-published
 * name, or a Wikidata label — and the provenance for each one stays in the
 * per-country artifact next to it. A station no source answered for is simply
 * absent, so the UI keeps showing the operator's own name.
 *
 * The map is country-scoped on purpose. The i18next `station` dictionary is one
 * flat English→label map shared by every market, so two networks that use the
 * same station name can only hold one value there (see {@link stationOverrides}).
 * A generated file must never be the thing that decides that collision, so
 * these labels are only ever consulted for the market they were generated for,
 * and only when the flat dictionary has nothing for the name.
 */
import type { Country } from "../types";
import labels from "./catalog/station-i18n/labels.json";
import singaporeCatalog from "./catalog/singapore-menu.json";

/** Locales the generator emits. English is the source language. */
export type GeneratedStationLocale = "zh-TW" | "ja" | "ko";

type GeneratedLabels = Partial<Record<Country, Partial<Record<GeneratedStationLocale, Record<string, string>>>>>;

/**
 * Singapore's directory labels come from its own generated catalog rather than
 * from the shared sync. They used to be merged into the flat i18next dictionary,
 * where they became every market's answer for a shared name: Hong Kong's
 * Admiralty rendered as Singapore's アドミラルティ, and Korea's City Hall as
 * Singapore's. Folding them in here instead keeps them scoped to Singapore.
 */
function withSingaporeCatalog(base: GeneratedLabels): GeneratedLabels {
  const catalog = (singaporeCatalog as {
    stationTranslations?: Record<string, Partial<Record<GeneratedStationLocale, string>>>;
  }).stationTranslations || {};
  const singapore: Partial<Record<GeneratedStationLocale, Record<string, string>>> = {
    "zh-TW": { ...(base.singapore?.["zh-TW"] || {}) },
    ja: { ...(base.singapore?.ja || {}) },
    ko: { ...(base.singapore?.ko || {}) },
  };
  for (const [name, byLocale] of Object.entries(catalog)) {
    for (const locale of ["zh-TW", "ja", "ko"] as const) {
      const label = byLocale[locale];
      if (label && label !== name) singapore[locale]![name] = label;
    }
  }
  return { ...base, singapore };
}

const generated = withSingaporeCatalog(labels as GeneratedLabels);

/**
 * Sourced label for `name` in `country`, or undefined when the sync found no
 * source for it. Callers must fall back to the provider's own name.
 */
export function generatedStationLabel(
  locale: string,
  name: string,
  country?: Country,
): string | undefined {
  if (!country || !name) return undefined;
  const byLocale = generated[country];
  if (!byLocale) return undefined;
  return byLocale[locale as GeneratedStationLocale]?.[name];
}

/** Markets that currently ship generated labels, for audits and tests. */
export function generatedLabelCountries(): Country[] {
  return Object.keys(generated) as Country[];
}

/** Every generated label for one market/locale pair. Used by the audit. */
export function generatedLabelsFor(
  country: Country,
  locale: GeneratedStationLocale,
): Record<string, string> {
  return generated[country]?.[locale] || {};
}
